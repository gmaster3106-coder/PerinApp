import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { SCENARIOS } from '../data/scenarios.js';

const LEVELS = ['beginner', 'intermediate', 'advanced', 'native'];
const LEVEL_LABELS = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced', native: 'Native' };
const DIFF_COLORS = { Easy: '#22c55e', Medium: '#f59e0b', Hard: '#ef4444', Expert: '#a855f7' };

export default function Scenarios() {
  const { state, isPro } = useApp();
  const navigate = useNavigate();
  const [level, setLevel] = useState('beginner');
  const lang = state.languages?.[0];
  const scenarios = SCENARIOS[level] || [];

  function handlePick(scenario, idx) {
    if (level === 'native' && !isPro()) {
      alert('Native mode requires Perin Pro');
      return;
    }
    navigate('/wordprep', { state: { scenario, level, idx, lang: lang?.lang, dialect: lang?.dialect } });
  }

  return (
    <div className="screen active" id="screen-scenarios">
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
        {scenarios.map((s, idx) => (
          <button key={idx} className="scenario-item" onClick={() => handlePick(s, idx)}>
            <div className="scenario-icon">{s.icon}</div>
            <div className="scenario-text">
              <h4>{s.title}</h4>
              <p>{s.desc}</p>
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <span style={{ fontSize: '.68rem', fontWeight: '700', color: DIFF_COLORS[s.difficulty] || 'var(--muted)' }}>{s.difficulty}</span>
                <span style={{ fontSize: '.68rem', color: 'var(--muted)' }}>+{s.xp} XP</span>
              </div>
            </div>
            <span style={{ color: 'var(--muted)', fontSize: '1.2rem', marginLeft: 'auto', flexShrink: 0 }}>›</span>
          </button>
        ))}
      </div>
    </div>
  );
}
