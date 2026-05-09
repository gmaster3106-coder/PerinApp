import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { getValidToken } from '../utils/getValidToken.js';

const WORKER_URL = 'https://perin-proxy.gmaster3106.workers.dev';

const SRS_INTERVALS = [1, 3, 7, 14, 30];
const SRS_ALMOST    = [1, 2, 4, 7, 14];

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

export default function MyWords() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const [tab, setTab] = useState('collection'); // 'collection' | 'review'

  return (
    <div className="screen active" style={{ alignItems: 'center', padding: '28px 16px 60px' }}>
      <div style={{ width: '100%', maxWidth: '560px' }}>
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: '1.45rem', marginBottom: 5 }}>💭 My Words</h2>
          <p style={{ color: 'var(--muted)', fontSize: '.85rem' }}>Your saved vocabulary and session phrases.</p>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '2px solid var(--border)', marginBottom: 20 }}>
          {[['collection', 'Collection'], ['review', 'Review']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{
                flex: 1, padding: '9px', textAlign: 'center', fontSize: '.85rem', fontWeight: 600,
                cursor: 'pointer', background: 'none', border: 'none', fontFamily: "'DM Sans',sans-serif",
                color: tab === key ? 'var(--accent)' : 'var(--muted)',
                borderBottom: `3px solid ${tab === key ? 'var(--accent)' : 'transparent'}`,
                marginBottom: '-2px', transition: 'all .2s',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'collection' && <CollectionTab state={state} navigate={navigate} onStartReview={() => setTab('review')} />}
        {tab === 'review' && <ReviewTab state={state} dispatch={dispatch} navigate={navigate} />}
      </div>
    </div>
  );
}

// ── COLLECTION TAB ────────────────────────────────────────────────────────────
function SessionMoments({ lang }) {
  const [moments, setMoments] = React.useState([]);
  const [expanded, setExpanded] = React.useState(false);

  React.useEffect(() => {
    // 1. Load localStorage immediately so the UI isn't blank
    try {
      const all = JSON.parse(localStorage.getItem('perin_moments') || '[]');
      const filtered = lang ? all.filter(m => !m.lang || m.lang === lang) : all;
      setMoments(filtered);
    } catch { setMoments([]); }

    // 2. Pull from Supabase and merge (cross-device sync)
    if (!lang) return;
    (async () => {
      try {
        const token = await getValidToken();
        if (!token) return;
        const res = await fetch(
          `${WORKER_URL}/api/memory?lang=${encodeURIComponent(lang)}&all=1&limit=200`,
          { headers: { 'Authorization': `Bearer ${token}` } }
        );
        if (!res.ok) return;
        const cloudData = await res.json();
        if (!Array.isArray(cloudData) || cloudData.length === 0) return;
        const fromCloud = cloudData.map(m => ({
          phrase:   m.phrase,
          meaning:  m.translation || '',
          lang:     m.lang,
          dialect:  m.dialect || '',
          scenario: m.source_scenario || '',
          date:     m.created_at || '',
        }));
        setMoments(prev => {
          const seen = new Set(prev.map(m => m.phrase.toLowerCase()));
          const newOnes = fromCloud.filter(m => !seen.has(m.phrase.toLowerCase()));
          return newOnes.length > 0 ? [...prev, ...newOnes] : prev;
        });
      } catch { /* silent — cloud pull is best-effort */ }
    })();
  }, [lang]);

  if (moments.length === 0) {
    return (
      <div style={{ background: 'var(--card)', border: '1.5px solid var(--border)', borderRadius: 14, padding: '20px', textAlign: 'center' }}>
        <div style={{ fontSize: '1.8rem', marginBottom: 8 }}>💬</div>
        <p style={{ fontWeight: 600, fontSize: '.88rem', marginBottom: 6 }}>No session phrases yet</p>
        <p style={{ color: 'var(--muted)', fontSize: '.80rem', lineHeight: 1.6 }}>
          Key phrases from your conversations will appear here automatically.
        </p>
      </div>
    );
  }

  const shown = expanded ? moments : moments.slice(0, 5);

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {shown.map((m, i) => (
          <div key={i} style={{ background: 'var(--card)', border: '1.5px solid var(--border)', borderRadius: 11, padding: '11px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 700, fontSize: '.92rem', color: 'var(--ink)' }}>{m.phrase}</div>
              <div style={{ fontSize: '.65rem', color: 'var(--muted)', flexShrink: 0, marginLeft: 10 }}>{m.scenario}</div>
            </div>
            {m.meaning && <div style={{ fontSize: '.76rem', color: 'var(--muted)', marginTop: 2 }}>{m.meaning}</div>}
          </div>
        ))}
      </div>
      {moments.length > 5 && (
        <button
          onClick={() => setExpanded(e => !e)}
          style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '.8rem', fontWeight: 600, cursor: 'pointer', marginTop: 8, padding: 0 }}
        >
          {expanded ? 'Show less' : `Show all ${moments.length} phrases`}
        </button>
      )}
    </div>
  );
}

function CollectionTab({ state, navigate, onStartReview }) {
  const lang = state.activeLang?.lang || state.languages?.[0]?.lang || '';
  const vocab = loadVocab().filter(v => !v.lang || v.lang === lang);
  const due = getDueWords(vocab);

  const mastered   = vocab.filter(m => (m.strength || 0) >= 3);
  const inProgress = vocab.filter(m => (m.strength || 0) > 0 && (m.strength || 0) < 3);
  const newOnes    = vocab.filter(m => (m.strength || 0) === 0);

  return (
    <div>
      {/* Stats */}
      {vocab.length > 0 && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          {[
            { label: 'Total', val: vocab.length, color: 'var(--accent)' },
            { label: 'Mastered', val: mastered.length, color: '#2e7d32' },
            { label: 'Due', val: due.length, color: due.length > 0 ? '#f59e0b' : 'var(--muted)' },
          ].map(s => (
            <div key={s.label} style={{ flex: 1, background: 'var(--card)', border: '1.5px solid var(--border)', borderRadius: 12, padding: '12px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: s.color }}>{s.val}</div>
              <div style={{ fontSize: '.68rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.08em', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Saved words */}
      <div style={{ fontSize: '.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.12em', color: 'var(--muted)', marginBottom: 10 }}>
        💾 Saved words
      </div>

      {vocab.length === 0 ? (
        <div style={{ background: 'var(--card)', border: '1.5px solid var(--border)', borderRadius: 14, padding: '24px 20px', textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: '2rem', marginBottom: 8 }}>📭</div>
          <p style={{ fontWeight: 600, fontSize: '.9rem', marginBottom: 6 }}>No saved words yet</p>
          <p style={{ color: 'var(--muted)', fontSize: '.82rem', lineHeight: 1.6, marginBottom: 16 }}>
            Tap 💾 on any phrase during a conversation to save it here.
          </p>
          <button className="fib-next-btn" onClick={() => navigate('/scenarios')} style={{ fontSize: '.82rem', padding: '10px' }}>
            Start a Conversation →
          </button>
        </div>
      ) : (
        <>
          <WordGroup title="Mastered" emoji="⭐" items={mastered} />
          <WordGroup title="In progress" emoji="🔄" items={inProgress} />
          <WordGroup title="New" emoji="🌱" items={newOnes} />

          {due.length > 0 && (
            <button onClick={onStartReview} style={{ width: '100%', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 12, padding: '12px', fontFamily: "'DM Sans',sans-serif", fontSize: '.88rem', fontWeight: 600, cursor: 'pointer', marginTop: 8, marginBottom: 20 }}>
              🔁 Review {due.length} due word{due.length !== 1 ? 's' : ''} →
            </button>
          )}
        </>
      )}

      {/* From sessions */}
      <div style={{ fontSize: '.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.12em', color: 'var(--muted)', marginBottom: 10, marginTop: 8 }}>
        💬 From sessions
      </div>
      <SessionMoments lang={lang} />
    </div>
  );
}

function WordGroup({ title, emoji, items }) {
  if (!items.length) return null;
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: '.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--muted)', marginBottom: 8 }}>
        {emoji} {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {items.map((v, i) => (
          <div key={i} style={{ background: 'var(--card)', border: '1.5px solid var(--border)', borderRadius: 11, padding: '11px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '.92rem', color: 'var(--ink)' }}>{v.word}</div>
              {v.meaning && <div style={{ fontSize: '.76rem', color: 'var(--muted)', marginTop: 2 }}>{v.meaning}</div>}
            </div>
            <div style={{ fontSize: '.65rem', color: 'var(--muted)', flexShrink: 0, marginLeft: 10 }}>{getStrengthLabel(v.strength)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── REVIEW TAB ────────────────────────────────────────────────────────────────
function ReviewTab({ state, dispatch, navigate }) {
  const lang    = state.activeLang?.lang    || state.languages?.[0]?.lang    || '';
  const dialect = state.activeLang?.dialect || state.languages?.[0]?.dialect || lang;

  const [phase, setPhase]       = useState('init');
  const [queue, setQueue]       = useState([]);
  const [index, setIndex]       = useState(0);
  const [correct, setCorrect]   = useState(0);
  const [examples, setExamples] = useState(null);
  const [remainingDue, setRemainingDue] = useState(0);
  const [filterLang, setFilterLang] = useState('all');

  const allVocab = loadVocab();
  const vocabLangs = ['all', ...new Set(allVocab.map(v => v.lang).filter(Boolean))];

  useEffect(() => { loadQueue('all'); }, []);

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
    const v = queue[index];
    let updated;
    if (result === 'correct') { updated = applyCorrect(v); setCorrect(c => c + 1); }
    else if (result === 'almost') { updated = applyAlmost(v); }
    else { updated = applyWrong(v); }

    const all = loadVocab();
    const idx = all.findIndex(sv => sv.word === v.word && sv.lang === v.lang);
    if (idx !== -1) all[idx] = updated;
    saveVocab(all);

    const nextIndex = index + 1;
    if (nextIndex >= queue.length) {
      const finalCorrect = result === 'correct' ? correct + 1 : correct;
      dispatch({ type: 'AWARD_XP', payload: finalCorrect * 5 });
      markMissionDoneIfMatch(['srs', 'vocab', 'vocabquiz']);
      setRemainingDue(getDueWords(loadVocab()).length);
      setPhase('done');
    } else {
      setIndex(nextIndex);
      setExamples(null);
      setPhase('card');
    }
  }

  if (phase === 'init' || phase === 'empty') return (
    <div style={{ textAlign: 'center', padding: '40px 16px' }}>
      <div style={{ fontSize: '3rem', marginBottom: 12 }}>🎉</div>
      <p style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 8 }}>Nothing due for review!</p>
      <p style={{ color: 'var(--muted)', fontSize: '.84rem', marginBottom: 20, lineHeight: 1.6 }}>
        You're all caught up. Save words during conversations to build your review queue.
      </p>
      <button className="fib-next-btn" onClick={() => navigate('/scenarios')}>Start a Conversation</button>
    </div>
  );

  if (phase === 'done') {
    const total = queue.length;
    const xp = correct * 5;
    return (
      <div>
        <div className="fib-score-card">
          <p style={{ fontSize: '.72rem', textTransform: 'uppercase', letterSpacing: '.1em', color: 'rgba(255,255,255,.5)', marginBottom: 8 }}>🔁 Review</p>
          <div className="fib-score-big">{correct}<span style={{ fontSize: '1.4rem', color: 'rgba(255,255,255,.5)' }}>/{total}</span></div>
          <p>words remembered · +{xp} XP</p>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          {remainingDue > 0 && <button className="fib-next-btn" onClick={() => loadQueue(filterLang)} style={{ flex: 1 }}>Keep reviewing 🔁</button>}
          <button className="fib-next-btn" onClick={() => navigate('/dashboard')} style={{ flex: 1, background: 'var(--card)', color: 'var(--ink)', border: '1.5px solid var(--border)' }}>Dashboard</button>
        </div>
      </div>
    );
  }

  const v = queue[index];
  const total = queue.length;
  const revealed = phase === 'revealed';

  return (
    <div>
      {vocabLangs.length > 2 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
          {vocabLangs.map(l => (
            <button key={l} onClick={() => handleFilterChange(l)} style={{ padding: '4px 12px', borderRadius: 20, border: '1.5px solid', borderColor: filterLang === l ? 'var(--accent)' : 'var(--border)', background: filterLang === l ? 'var(--accent)' : 'var(--card)', color: filterLang === l ? '#fff' : 'var(--muted)', fontFamily: "'DM Sans',sans-serif", fontSize: '.72rem', fontWeight: 600, cursor: 'pointer' }}>
              {l === 'all' ? 'All languages' : l}
            </button>
          ))}
        </div>
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
            {examples === 'loading' && <div style={{ fontSize: '.75rem', color: 'var(--muted)', margin: '12px 0' }}>Loading examples…</div>}
            {Array.isArray(examples) && examples.length > 0 && (
              <div style={{ borderTop: '1px solid var(--border)', marginTop: 12, paddingTop: 12, marginBottom: 14 }}>
                <div style={{ fontSize: '.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--muted)', marginBottom: 8 }}>In context</div>
                {examples.map((ex, i) => (
                  <div key={i} style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: '.88rem', fontWeight: 600, color: 'var(--ink)' }}>{ex.s}</div>
                    <div style={{ fontSize: '.78rem', color: 'var(--muted)' }}>{ex.t}</div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button className="fib-next-btn" onClick={() => answer('wrong')} style={{ flex: 1, background: '#fce8e8', color: 'var(--danger)', border: '2px solid var(--danger)', fontSize: '.78rem', padding: '10px 6px' }}>❌ Forgot</button>
              <button className="fib-next-btn" onClick={() => answer('almost')} style={{ flex: 1, background: '#fef9c3', color: '#92400e', border: '2px solid #f59e0b', fontSize: '.78rem', padding: '10px 6px' }}>🤔 Almost</button>
              <button className="fib-next-btn" onClick={() => answer('correct')} style={{ flex: 1, background: '#e8f5e9', color: '#2e7d32', border: '2px solid #4caf50', fontSize: '.78rem', padding: '10px 6px' }}>✅ Got it</button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: '.62rem', color: 'var(--muted)', padding: '0 2px' }}>
              <span>Reset to day 1</span><span>Review sooner</span><span>Advance level</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
