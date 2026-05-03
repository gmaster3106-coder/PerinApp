import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { SCENARIOS } from '../data/scenarios.js';

const LEVELS = ['beginner', 'intermediate', 'advanced', 'native'];
const LEVEL_LABELS = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced', native: 'Native' };
const DIFF_COLORS = { Easy: '#22c55e', Medium: '#f59e0b', Hard: '#ef4444', Expert: '#a855f7' };

function getLastPlayed(lang, dialect) {
  try {
    return JSON.parse(localStorage.getItem(`perin_last_played_${lang}_${dialect}`) || '{}');
  } catch { return {}; }
}

function setLastPlayed(lang, dialect, level, idx) {
  try {
    const key = `perin_last_played_${lang}_${dialect}`;
    const data = JSON.parse(localStorage.getItem(key) || '{}');
    data[level] = idx;
    localStorage.setItem(key, JSON.stringify(data));
  } catch {}
}

function getPlayCount(lang, dialect, level, idx) {
  try {
    const counts = JSON.parse(localStorage.getItem(`perin_play_counts_${lang}_${dialect}`) || '{}');
    return counts[`${level}_${idx}`] || 0;
  } catch { return 0; }
}

function incrementPlayCount(lang, dialect, level, idx) {
  try {
    const key = `perin_play_counts_${lang}_${dialect}`;
    const counts = JSON.parse(localStorage.getItem(key) || '{}');
    counts[`${level}_${idx}`] = (counts[`${level}_${idx}`] || 0) + 1;
    localStorage.setItem(key, JSON.stringify(counts));
  } catch {}
}

export default function Scenarios() {
  const { state, isPro } = useApp();
  const navigate = useNavigate();
  const [level, setLevel] = useState('beginner');
  const [varietyNudge, setVarietyNudge] = useState(null);

  const lang = state.languages?.[0];
  const langCode = lang?.lang || '';
  const dialect = lang?.dialect || langCode;
  const scenarios = SCENARIOS[level] || [];
  const lastPlayed = getLastPlayed(langCode, dialect);

  function handlePick(scenario, idx) {
    if (level === 'native' && !isPro()) {
      alert('Native mode requires Perin Pro');
      return;
    }

    // Variety nudge — if they've played this exact scenario 3+ times, suggest something else
    const count = getPlayCount(langCode, dialect, level, idx);
    if (count >= 3 && lastPlayed[level] === idx) {
      const others = scenarios.filter((_, i) => i !== idx);
      const suggestion = others[Math.floor(Math.random() * others.length)];
      setVarietyNudge({ scenario, idx, suggestion, suggestionIdx: scenarios.indexOf(suggestion) });
      return;
    }

    startScenario(scenario, idx);
  }

  function startScenario(scenario, idx) {
    setVarietyNudge(null);
    incrementPlayCount(langCode, dialect, level, idx);
    setLastPlayed(langCode, dialect, level, idx);
    navigate('/wordprep', { state: { scenario, level, idx, lang: langCode, dialect } });
  }

  return (
    <div className="screen active" id="screen-scenarios">

      {/* Variety nudge modal */}
      {varietyNudge && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(10,26,58,.6)', zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
          backdropFilter: 'blur(4px)',
        }} onClick={() => setVarietyNudge(null)}>
          <div style={{
            background: 'var(--card)', borderRadius: '20px', padding: '28px 24px',
            maxWidth: '360px', width: '100%', textAlign: 'center',
            boxShadow: '0 20px 60px rgba(10,26,58,.25)',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '2rem', marginBottom: '10px' }}>🔄</div>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: '1.15rem', fontWeight: '700', marginBottom: '8px', color: 'var(--ink)' }}>
              You've done this one a few times
            </div>
            <p style={{ fontSize: '.84rem', color: 'var(--muted)', marginBottom: '20px', lineHeight: '1.6' }}>
              Try something new to keep improving — or replay if you want more practice.
            </p>
            {varietyNudge.suggestion && (
              <button
                onClick={() => startScenario(varietyNudge.suggestion, varietyNudge.suggestionIdx)}
                style={{
                  width: '100%', background: 'var(--accent)', color: '#fff', border: 'none',
                  borderRadius: '12px', padding: '13px', fontFamily: "'DM Sans',sans-serif",
                  fontSize: '.9rem', fontWeight: '700', cursor: 'pointer', marginBottom: '10px',
                }}
              >
                Try "{varietyNudge.suggestion.title}" →
              </button>
            )}
            <button
              onClick={() => startScenario(varietyNudge.scenario, varietyNudge.idx)}
              style={{
                width: '100%', background: 'none', border: '1.5px solid var(--border)',
                borderRadius: '12px', padding: '11px', fontFamily: "'DM Sans',sans-serif",
                fontSize: '.85rem', color: 'var(--muted)', cursor: 'pointer',
              }}
            >
              Replay anyway
            </button>
          </div>
        </div>
      )}

      <div className="scenarios-header">
        <h2>Choose a Scenario</h2>
        <p>Pick the situation you want to practice.</p>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', overflowX: 'auto', width: '100%', maxWidth: '520px' }}>
        {LEVELS.map(l => (
          <button
            key={l}
            onClick={() => setLevel(l)}
            style={{
              padding: '6px 16px',
              borderRadius: '20px',
              border: '1.5px solid',
              borderColor: level === l ? 'var(--accent)' : 'var(--border)',
              background: level === l ? 'var(--accent)' : 'var(--card)',
              color: level === l ? '#fff' : 'var(--ink)',
              fontFamily: "'DM Sans',sans-serif",
              fontSize: '.82rem',
              fontWeight: '600',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {LEVEL_LABELS[l]}{l === 'native' && !isPro() && ' 🔒'}
          </button>
        ))}
      </div>

      <div className="scenarios-list">
        {scenarios.map((s, idx) => {
          const playCount = getPlayCount(langCode, dialect, level, idx);
          const isRepeat = playCount >= 3 && lastPlayed[level] === idx;
          return (
            <button key={idx} className="scenario-item" onClick={() => handlePick(s, idx)}>
              <div className="scenario-icon">{s.icon}</div>
              <div className="scenario-text">
                <h4>{s.title}{isRepeat && <span style={{ fontSize: '.65rem', background: 'rgba(249,115,22,.12)', color: '#f97316', borderRadius: '6px', padding: '1px 6px', marginLeft: '6px', fontWeight: '600' }}>Try something new</span>}</h4>
                <p>{s.desc}</p>
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px', alignItems: 'center' }}>
                  <span style={{ fontSize: '.68rem', fontWeight: '700', color: DIFF_COLORS[s.difficulty] || 'var(--muted)' }}>{s.difficulty}</span>
                  <span style={{ fontSize: '.68rem', color: 'var(--muted)' }}>+{s.xp} XP</span>
                  {playCount > 0 && <span style={{ fontSize: '.65rem', color: 'var(--muted)' }}>· Played {playCount}×</span>}
                </div>
              </div>
              <span style={{ color: 'var(--muted)', fontSize: '1.2rem', marginLeft: 'auto', flexShrink: 0 }}>›</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
