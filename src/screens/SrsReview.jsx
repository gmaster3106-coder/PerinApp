import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { getValidToken } from '../utils/getValidToken.js';

const WORKER_URL = 'https://perin-proxy.gmaster3106.workers.dev';

// SRS intervals in days per strength level
const SRS_INTERVALS =  [1, 3, 7, 14, 30];
const SRS_ALMOST    =  [1, 2, 4, 7, 14]; // shorter intervals for "almost"

function getStrengthLabel(s) {
  return ['🌱 New', '📖 Learning', '🔄 Familiar', '💪 Strong', '⭐ Mastered'][s || 0];
}

function loadVocab() {
  try { return JSON.parse(localStorage.getItem('perin_vocab') || '[]'); }
  catch { return []; }
}

function saveVocab(vocab) {
  localStorage.setItem('perin_vocab', JSON.stringify(vocab));
}

function getDueWords(vocab) {
  const now = Date.now();
  return vocab.filter(v => !v.nextReview || v.nextReview <= now);
}

function applyCorrect(v) {
  const strength = Math.min(4, (v.strength || 0) + 1);
  return { ...v, strength, interval: SRS_INTERVALS[strength] || 30, nextReview: Date.now() + (SRS_INTERVALS[strength] || 30) * 86400000, reviews: (v.reviews || 0) + 1 };
}

function applyAlmost(v) {
  // Stay at same strength but review sooner
  const strength = v.strength || 0;
  const interval = SRS_ALMOST[strength] || 2;
  return { ...v, strength, interval, nextReview: Date.now() + interval * 86400000, reviews: (v.reviews || 0) + 1 };
}

function applyWrong(v) {
  return { ...v, strength: 0, interval: 1, nextReview: Date.now() + 86400000, reviews: (v.reviews || 0) + 1 };
}

function markMissionDoneIfMatch(types) {
  try {
    const key = 'perin_mission_' + new Date().toDateString();
    const mission = JSON.parse(localStorage.getItem(key) || '{}');
    if (types.includes(mission.type)) {
      localStorage.setItem('perin_mission_done_' + new Date().toDateString(), '1');
    }
  } catch { /* silent */ }
}

export default function SrsReview() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();

  const languages  = state.languages || [];
  const activeLang = state.activeLang?.lang ? state.activeLang : languages[0];
  const lang       = activeLang?.lang    || '';
  const dialect    = activeLang?.dialect || lang;

  const [phase, setPhase]         = useState('empty');
  const [queue, setQueue]         = useState([]);
  const [index, setIndex]         = useState(0);
  const [correct, setCorrect]     = useState(0);
  const [examples, setExamples]   = useState(null);
  const [remainingDue, setRemainingDue] = useState(0);
  const [filterLang, setFilterLang] = useState('all');

  // Get unique languages from vocab
  const allVocab = loadVocab();
  const vocabLangs = ['all', ...new Set(allVocab.map(v => v.lang).filter(Boolean))];

  useEffect(() => {
    loadQueue('all');
  }, []);

  function loadQueue(langFilter) {
    const vocab = loadVocab();
    const filtered = langFilter === 'all' ? vocab : vocab.filter(v => v.lang === langFilter);
    const due = getDueWords(filtered);
    if (!due.length) { setPhase('empty'); return; }
    setQueue(due);
    setRemainingDue(due.length);
    setIndex(0);
    setCorrect(0);
    setExamples(null);
    setPhase('card');
  }

  function handleFilterChange(newLang) {
    setFilterLang(newLang);
    loadQueue(newLang);
  }

  const loadExamples = useCallback(async (word, meaning) => {
    if (!lang) return;
    setExamples('loading');
    try {
      const token = await getValidToken();
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${WORKER_URL}/api/chat`, {
        method: 'POST', headers,
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001', max_tokens: 150,
          messages: [{ role: 'user', content: `Give 2 short natural example sentences using "${word}" (${meaning}) in ${dialect} ${lang}. Each sentence max 8 words. Return ONLY JSON: {"examples":[{"s":"sentence","t":"English translation"}]}` }],
        }),
      });
      const data = await res.json();
      const text = (data.content?.[0]?.text || '').replace(/```json|```/g, '').trim();
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) { setExamples([]); return; }
      const parsed = JSON.parse(match[0]);
      setExamples(parsed.examples || []);
    } catch { setExamples([]); }
  }, [lang, dialect]);

  function reveal() {
    setPhase('revealed');
    const v = queue[index];
    if (v?.word && v?.meaning) loadExamples(v.word, v.meaning);
  }

  function answer(result) {
    // result: 'correct' | 'almost' | 'wrong'
    const v = queue[index];
    let updated;
    if (result === 'correct') {
      updated = applyCorrect(v);
      setCorrect(c => c + 1);
    } else if (result === 'almost') {
      updated = applyAlmost(v);
    } else {
      updated = applyWrong(v);
    }

    const allVocab = loadVocab();
    const idx = allVocab.findIndex(sv => sv.word === v.word && sv.lang === v.lang);
    if (idx !== -1) allVocab[idx] = updated;
    saveVocab(allVocab);

    const nextIndex = index + 1;
    if (nextIndex >= queue.length) {
      const finalCorrect = result === 'correct' ? correct + 1 : correct;
      const xp = finalCorrect * 5;
      dispatch({ type: 'AWARD_XP', payload: xp });
      markMissionDoneIfMatch(['srs', 'vocab', 'vocabquiz']);
      setRemainingDue(getDueWords(loadVocab()).length);
      setPhase('done');
    } else {
      setIndex(nextIndex);
      setExamples(null);
      setPhase('card');
    }
  }

  function restart() {
    loadQueue(filterLang);
  }

  if (phase === 'empty') {
    return (
      <div className="screen active" style={{ alignItems: 'center', padding: '28px 16px 60px' }}>
        <div className="fib-wrap">
          <Header />
          {/* Language filter even on empty state */}
          {vocabLangs.length > 2 && (
            <LangFilter langs={vocabLangs} current={filterLang} onChange={handleFilterChange} />
          )}
          <div style={{ textAlign: 'center', padding: '48px 16px' }}>
            <div style={{ fontSize: '3rem', marginBottom: 12 }}>🎉</div>
            <p style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: 8 }}>Nothing due for review!</p>
            <p style={{ color: 'var(--muted)', fontSize: '.85rem', marginBottom: 24 }}>
              You're all caught up. Save words during conversations to build your review queue.
            </p>
            <button className="fib-next-btn" onClick={() => navigate('/dashboard')}>Back to Dashboard</button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'done') {
    const total = queue.length;
    const xp = correct * 5;
    return (
      <div className="screen active" style={{ alignItems: 'center', padding: '28px 16px 60px' }}>
        <div className="fib-wrap">
          <Header />
          <div className="fib-score-card">
            <p style={{ fontSize: '.72rem', textTransform: 'uppercase', letterSpacing: '.1em', color: 'rgba(255,255,255,.5)', marginBottom: 8 }}>🔁 Vocab Review</p>
            <div className="fib-score-big">{correct}<span style={{ fontSize: '1.4rem', color: 'rgba(255,255,255,.5)' }}>/{total}</span></div>
            <p>words remembered</p>
            <div className="quiz-score-badge" style={{ marginTop: 10 }}>+{xp} XP</div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            {remainingDue > 0 && <button className="fib-next-btn" onClick={restart} style={{ flex: 1 }}>Keep reviewing 🔁</button>}
            <button className="fib-next-btn" onClick={() => navigate('/dashboard')} style={{ flex: 1, background: 'var(--card)', color: 'var(--ink)', border: '1.5px solid var(--border)' }}>Dashboard</button>
          </div>
          <div style={{ marginTop: 12, textAlign: 'center' }}>
            <p style={{ fontSize: '.75rem', color: 'var(--muted)', marginBottom: 8 }}>Put these words in context</p>
            <button onClick={() => navigate('/fib')} style={{ background: 'none', border: '1.5px solid var(--border)', borderRadius: 10, padding: '8px 16px', fontFamily: "'DM Sans',sans-serif", fontSize: '.8rem', color: 'var(--ink)', cursor: 'pointer', width: '100%' }}>✏️ Try Fill the Blank →</button>
          </div>
        </div>
      </div>
    );
  }

  const v = queue[index];
  const total = queue.length;
  const revealed = phase === 'revealed';

  return (
    <div className="screen active" style={{ alignItems: 'center', padding: '28px 16px 60px' }}>
      <div className="fib-wrap">
        <Header />

        {/* Language filter */}
        {vocabLangs.length > 2 && (
          <LangFilter langs={vocabLangs} current={filterLang} onChange={handleFilterChange} />
        )}

        <div className="fib-card">
          <div className="fib-progress">
            {queue.map((_, i) => <div key={i} className={`fib-progress-dot${i < index ? ' done' : ''}`} />)}
          </div>
          <div className="fib-counter">{index + 1} of {total} · {getStrengthLabel(v.strength)}</div>
          <div style={{ textAlign: 'center', padding: '24px 0 16px' }}>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>{v.word}</div>
            <div style={{ fontSize: '.8rem', color: 'var(--muted)' }}>{v.lang || ''}</div>
          </div>
          {!revealed && <button className="fib-next-btn" onClick={reveal}>Show meaning</button>}
          {revealed && (
            <>
              <div style={{ background: 'var(--cream)', borderRadius: 12, padding: 16, margin: '14px 0', textAlign: 'center' }}>
                <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--ink)' }}>{v.meaning}</div>
              </div>
              <Examples examples={examples} />

              {/* 3-button rating */}
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button
                  className="fib-next-btn"
                  onClick={() => answer('wrong')}
                  style={{ flex: 1, background: '#fce8e8', color: 'var(--danger)', border: '2px solid var(--danger)', fontSize: '.78rem', padding: '10px 6px' }}
                >
                  ❌ Forgot
                </button>
                <button
                  className="fib-next-btn"
                  onClick={() => answer('almost')}
                  style={{ flex: 1, background: '#fef9c3', color: '#92400e', border: '2px solid #f59e0b', fontSize: '.78rem', padding: '10px 6px' }}
                >
                  🤔 Almost
                </button>
                <button
                  className="fib-next-btn"
                  onClick={() => answer('correct')}
                  style={{ flex: 1, background: '#e8f5e9', color: '#2e7d32', border: '2px solid #4caf50', fontSize: '.78rem', padding: '10px 6px' }}
                >
                  ✅ Got it
                </button>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: '.62rem', color: 'var(--muted)', padding: '0 2px' }}>
                <span>Reset to day 1</span>
                <span>Review sooner</span>
                <span>Advance level</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function LangFilter({ langs, current, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
      {langs.map(l => (
        <button
          key={l}
          onClick={() => onChange(l)}
          style={{
            padding: '4px 12px', borderRadius: 20, border: '1.5px solid',
            borderColor: current === l ? 'var(--accent)' : 'var(--border)',
            background: current === l ? 'var(--accent)' : 'var(--card)',
            color: current === l ? '#fff' : 'var(--muted)',
            fontFamily: "'DM Sans',sans-serif", fontSize: '.72rem', fontWeight: 600,
            cursor: 'pointer', transition: 'all .15s',
            textTransform: l === 'all' ? 'capitalize' : 'none',
          }}
        >
          {l === 'all' ? 'All languages' : l}
        </button>
      ))}
    </div>
  );
}

function Header() {
  return (
    <div style={{ marginBottom: 18 }}>
      <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: '1.45rem', marginBottom: 5 }}>🔁 Vocab Review</h2>
      <p style={{ color: 'var(--muted)', fontSize: '.85rem' }}>Review your saved words with spaced repetition.</p>
    </div>
  );
}

function Examples({ examples }) {
  if (!examples) return null;
  if (examples === 'loading') return <div style={{ fontSize: '.75rem', color: 'var(--muted)', margin: '12px 0' }}>Loading examples…</div>;
  if (!examples.length) return null;
  return (
    <div style={{ borderTop: '1px solid var(--border)', marginTop: 12, paddingTop: 12, marginBottom: 14 }}>
      <div style={{ fontSize: '.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--muted)', marginBottom: 8 }}>In context</div>
      {examples.map((ex, i) => (
        <div key={i} style={{ marginBottom: 8 }}>
          <div style={{ fontSize: '.88rem', fontWeight: 600, color: 'var(--ink)' }}>{ex.s}</div>
          <div style={{ fontSize: '.78rem', color: 'var(--muted)' }}>{ex.t}</div>
        </div>
      ))}
    </div>
  );
}
