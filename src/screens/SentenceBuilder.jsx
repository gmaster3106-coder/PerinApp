import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { getValidToken } from '../utils/getValidToken.js';

const WORKER_URL = 'https://perin-proxy.gmaster3106.workers.dev';

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
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

export default function SentenceBuilder() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();

  const languages = state.languages || [];
  const activeLang = state.activeLang?.lang ? state.activeLang : languages[0];
  const lang = activeLang?.lang || 'Spanish';
  const dialect = activeLang?.dialect || lang;

  const [phase, setPhase] = useState('loading');
  const [sentences, setSentences] = useState([]);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [bank, setBank] = useState([]);       // words available to tap
  const [built, setBuilt] = useState([]);     // words tapped into answer
  const [status, setStatus] = useState(null); // null | 'correct' | 'wrong'
  const [showTranslation, setShowTranslation] = useState(false);

  const generate = useCallback(async () => {
    setPhase('loading');
    setSentences([]);
    setIndex(0);
    setScore(0);

    try {
      const token = await getValidToken();
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${WORKER_URL}/api/chat`, {
        method: 'POST', headers,
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 800,
          messages: [{
            role: 'user',
            content: `Generate 8 sentence-building exercises for a ${dialect} ${lang} learner.

Each sentence should be 4-8 words. Use everyday ${dialect} vocabulary. Mix tenses and structures.

Return ONLY raw JSON:
{"sentences":[{"sentence":"¿Cómo te llamas tú?","translation":"What is your name?"},{"sentence":"Me gusta mucho el café.","translation":"I really like coffee."}]}

Make sentences authentic to ${dialect} ${lang} — natural, conversational, real-world.`,
          }],
        }),
      });

      const data = await res.json();
      const text = data.content?.[0]?.text || '';
      const m = text.match(/\{[\s\S]*\}/);
      if (!m) throw new Error('No JSON');
      const parsed = JSON.parse(m[0]);
      const qs = parsed.sentences || [];
      if (!qs.length) throw new Error('Empty');
      setSentences(qs);
      setPhase('question');
      setupQuestion(qs[0]);
    } catch {
      setPhase('error');
    }
  }, [lang, dialect]);

  useEffect(() => { generate(); }, []);

  function setupQuestion(q) {
    const words = q.sentence.split(/\s+/).map((w, i) => ({ id: i, word: w }));
    setBank(shuffle(words));
    setBuilt([]);
    setStatus(null);
    setShowTranslation(false);
  }

  function tapFromBank(item) {
    if (status) return;
    setBank(prev => prev.filter(w => w.id !== item.id));
    setBuilt(prev => [...prev, item]);
  }

  function tapFromBuilt(item) {
    if (status) return;
    setBuilt(prev => prev.filter(w => w.id !== item.id));
    setBank(prev => [...prev, item]);
  }

  function checkAnswer() {
    if (!built.length || status) return;
    const q = sentences[index];
    const attempt = built.map(w => w.word).join(' ');
    const correct = attempt.trim() === q.sentence.trim();
    setStatus(correct ? 'correct' : 'wrong');
    if (correct) setScore(s => s + 1);
  }

  function next() {
    const nextIdx = index + 1;
    if (nextIdx >= sentences.length) {
      const xp = score * 10 + (status === 'correct' ? 10 : 0);
      dispatch({ type: 'AWARD_XP', payload: xp });
      markMissionDoneIfMatch(['sentence', 'sentence_builder']);
      setPhase('score');
    } else {
      setIndex(nextIdx);
      setupQuestion(sentences[nextIdx]);
    }
  }

  function showAnswer() {
    const q = sentences[index];
    const words = q.sentence.split(/\s+/).map((w, i) => ({ id: i, word: w }));
    setBuilt(words);
    setBank([]);
    setStatus('wrong');
  }

  // ── Loading ──
  if (phase === 'loading') return (
    <div className="screen active" style={{ alignItems: 'center', padding: '28px 16px 60px' }}>
      <div className="fib-wrap">
        <Header />
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--muted)', fontSize: '.88rem' }}>
          <div style={{ marginBottom: 14 }}>Building your sentences…</div>
          <span className="fib-loading-dot" style={{ display: 'inline-block' }} />
          <span className="fib-loading-dot" style={{ display: 'inline-block', animationDelay: '.2s' }} />
          <span className="fib-loading-dot" style={{ display: 'inline-block', animationDelay: '.4s' }} />
        </div>
      </div>
    </div>
  );

  // ── Error ──
  if (phase === 'error') return (
    <div className="screen active" style={{ alignItems: 'center', padding: '28px 16px 60px' }}>
      <div className="fib-wrap">
        <Header />
        <div style={{ textAlign: 'center', padding: '32px 16px' }}>
          <p style={{ color: 'var(--danger)', marginBottom: 8, fontWeight: 600 }}>⚠️ Couldn't load sentences</p>
          <p style={{ color: 'var(--muted)', fontSize: '.82rem', marginBottom: 20 }}>Check your connection and try again.</p>
          <button className="fib-next-btn" onClick={generate}>Try Again</button>
        </div>
      </div>
    </div>
  );

  // ── Score ──
  if (phase === 'score') {
    const total = sentences.length;
    const finalScore = score;
    const pct = Math.round(finalScore / total * 100);
    const xp = finalScore * 10;
    return (
      <div className="screen active" style={{ alignItems: 'center', padding: '28px 16px 60px' }}>
        <div className="fib-wrap">
          <Header />
          <div className="fib-score-card">
            <p style={{ fontSize: '.72rem', textTransform: 'uppercase', letterSpacing: '.1em', color: 'rgba(255,255,255,.5)', marginBottom: 8 }}>
              🔤 Sentence Builder
            </p>
            <div className="fib-score-big">
              {finalScore}<span style={{ fontSize: '1.4rem', color: 'rgba(255,255,255,.5)' }}>/{total}</span>
            </div>
            <p>{pct}% correct · +{xp} XP</p>
            <div style={{ fontSize: '1.3rem', margin: '8px 0' }}>
              {'⭐'.repeat(Math.round(pct / 20))}{'☆'.repeat(5 - Math.round(pct / 20))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button className="fib-next-btn" onClick={generate} style={{ flex: 1 }}>New Set 🔄</button>
            <button className="fib-next-btn" onClick={() => navigate('/dashboard')}
              style={{ flex: 1, background: 'var(--card)', color: 'var(--ink)', border: '1.5px solid var(--border)' }}>
              Dashboard
            </button>
          </div>
          <div style={{ marginTop: 12, textAlign: 'center' }}>
            <p style={{ fontSize: '.75rem', color: 'var(--muted)', marginBottom: 8 }}>Now use these in a real conversation</p>
            <button onClick={() => navigate('/scenarios')}
              style={{ background: 'none', border: '1.5px solid var(--border)', borderRadius: 10, padding: '8px 16px', fontFamily: "'DM Sans',sans-serif", fontSize: '.8rem', color: 'var(--ink)', cursor: 'pointer', width: '100%' }}>
              💬 Start a Conversation →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Question ──
  const q = sentences[index];
  const total = sentences.length;
  const allPlaced = bank.length === 0 && built.length > 0;

  return (
    <div className="screen active" style={{ alignItems: 'center', padding: '28px 16px 60px' }}>
      <div className="fib-wrap">
        <Header />
        <div className="fib-card">

          {/* Progress */}
          <div className="fib-progress">
            {sentences.map((_, i) => (
              <div key={i} className={`fib-progress-dot${i < index ? ' done' : ''}`} />
            ))}
          </div>

          <div className="fib-counter">🔤 Build the sentence · {index + 1} of {total}</div>

          {/* Translation toggle */}
          <div style={{ marginBottom: 16 }}>
            {!showTranslation
              ? <button onClick={() => setShowTranslation(true)} style={{ background: 'none', border: 'none', fontFamily: "'DM Sans',sans-serif", fontSize: '.78rem', color: 'var(--accent)', cursor: 'pointer', textDecoration: 'underline', padding: '2px 0' }}>
                  See translation hint
                </button>
              : <div className="fib-translation">{q.translation}</div>
            }
          </div>

          {/* Answer zone */}
          <div style={{
            minHeight: '56px', border: `2px solid ${status === 'correct' ? '#22c55e' : status === 'wrong' ? 'var(--danger)' : 'var(--accent)'}`,
            borderRadius: '12px', padding: '10px 12px', display: 'flex', flexWrap: 'wrap',
            gap: '6px', alignItems: 'center', marginBottom: '16px', background: 'var(--cream)',
            transition: 'border-color .2s',
          }}>
            {built.length === 0 && (
              <span style={{ fontSize: '.82rem', color: 'var(--muted)', fontStyle: 'italic' }}>
                Tap words below to build the sentence
              </span>
            )}
            {built.map((item) => (
              <button
                key={item.id}
                onClick={() => tapFromBuilt(item)}
                style={{
                  padding: '6px 12px', borderRadius: '8px', border: '1.5px solid var(--accent)',
                  background: 'var(--accent)', color: '#fff', fontFamily: "'DM Sans',sans-serif",
                  fontSize: '.88rem', fontWeight: '600', cursor: status ? 'default' : 'pointer',
                  transition: 'all .15s',
                }}
              >
                {item.word}
              </button>
            ))}
          </div>

          {/* Word bank */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px', minHeight: '40px' }}>
            {bank.map((item) => (
              <button
                key={item.id}
                onClick={() => tapFromBank(item)}
                style={{
                  padding: '7px 13px', borderRadius: '8px', border: '1.5px solid var(--border)',
                  background: 'var(--card)', color: 'var(--ink)', fontFamily: "'DM Sans',sans-serif",
                  fontSize: '.88rem', fontWeight: '500', cursor: 'pointer', transition: 'all .15s',
                }}
              >
                {item.word}
              </button>
            ))}
          </div>

          {/* Feedback */}
          {status && (
            <div className={`fib-feedback ${status}`} style={{ marginBottom: 12 }}>
              {status === 'correct'
                ? <>✅ Correct! <strong>{q.sentence}</strong></>
                : <>❌ The correct order: <strong>{q.sentence}</strong></>
              }
            </div>
          )}

          {/* Actions */}
          {!status && (
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                className="fib-next-btn"
                onClick={checkAnswer}
                disabled={!allPlaced}
                style={{ flex: 2, opacity: allPlaced ? 1 : 0.5 }}
              >
                Check ✓
              </button>
              <button
                onClick={showAnswer}
                style={{
                  flex: 1, background: 'none', border: '1.5px solid var(--border)',
                  borderRadius: '14px', fontFamily: "'DM Sans',sans-serif",
                  fontSize: '.85rem', color: 'var(--muted)', cursor: 'pointer',
                }}
              >
                Show
              </button>
            </div>
          )}

          {status && (
            <button className="fib-next-btn" onClick={next}>
              {index + 1 < total ? 'Next →' : 'See Results 🎉'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Header() {
  return (
    <div style={{ marginBottom: 18 }}>
      <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: '1.45rem', marginBottom: 5 }}>
        🔤 Sentence Builder
      </h2>
      <p style={{ color: 'var(--muted)', fontSize: '.85rem' }}>
        Tap the words in the correct order to build the sentence.
      </p>
    </div>
  );
}
