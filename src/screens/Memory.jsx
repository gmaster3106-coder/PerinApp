import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { getValidToken } from '../utils/getValidToken.js';

const WORKER_URL = 'https://perin-proxy.gmaster3106.workers.dev';

export default function Memory() {
  const { state } = useApp();
  const navigate = useNavigate();

  const languages  = state.languages || [];
  const activeLang = state.activeLang?.lang ? state.activeLang : languages[0];
  const lang       = activeLang?.lang    || '';
  const dialect    = activeLang?.dialect || lang;
  const isLoggedIn = !!state.currentUser?.access_token;

  const [phase, setPhase]     = useState('loading'); // loading | empty | data | error | noauth | nolang
  const [moments, setMoments] = useState([]);

  useEffect(() => {
    if (!isLoggedIn) { setPhase('noauth'); return; }
    if (!lang)       { setPhase('nolang'); return; }
    load();
  }, [lang, dialect, isLoggedIn]);

  async function load() {
    setPhase('loading');
    try {
      const token = await getValidToken();
      const res = await fetch(
        `${WORKER_URL}/api/memory?lang=${encodeURIComponent(lang)}&dialect=${encodeURIComponent(dialect)}&limit=100`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setMoments(Array.isArray(data) ? data : []);
      setPhase(Array.isArray(data) && data.length ? 'data' : 'empty');
    } catch {
      setPhase('error');
    }
  }

  // ── No auth ──
  if (phase === 'noauth') return (
    <div className="screen active" style={{ alignItems: 'center', padding: '28px 16px 60px' }}>
      <div style={{ width: '100%', maxWidth: '560px' }}>
        <Header />
        <div style={{ textAlign: 'center', padding: '48px 20px' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🔑</div>
          <p style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 8 }}>Sign in to see your moments</p>
          <p style={{ color: 'var(--muted)', fontSize: '.84rem', marginBottom: 24, lineHeight: 1.6 }}>
            Your moments are saved to your account. Sign in to access them.
          </p>
          <button className="fib-next-btn" onClick={() => navigate('/settings')}>Go to Settings →</button>
        </div>
      </div>
    </div>
  );

  // ── No language ──
  if (phase === 'nolang') return (
    <div className="screen active" style={{ alignItems: 'center', padding: '28px 16px 60px' }}>
      <div style={{ width: '100%', maxWidth: '560px' }}>
        <Header />
        <div style={{ textAlign: 'center', padding: '48px 20px' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🌍</div>
          <p style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 8 }}>Add a language first</p>
          <p style={{ color: 'var(--muted)', fontSize: '.84rem', marginBottom: 24 }}>
            Go to the Dashboard and add a language to see your moments.
          </p>
          <button className="fib-next-btn" onClick={() => navigate('/dashboard')}>Back to Dashboard</button>
        </div>
      </div>
    </div>
  );

  // ── Loading ──
  if (phase === 'loading') return (
    <div className="screen active" style={{ alignItems: 'center', padding: '28px 16px 60px' }}>
      <div style={{ width: '100%', maxWidth: '560px' }}>
        <Header />
        <div className="fib-loading" style={{ padding: '48px 0', textAlign: 'center' }}>
          <p style={{ marginBottom: 18, fontSize: '.9rem', color: 'var(--muted)' }}>Loading your moments…</p>
          <div>
            <span className="fib-loading-dot" />
            <span className="fib-loading-dot" />
            <span className="fib-loading-dot" />
          </div>
        </div>
      </div>
    </div>
  );

  // ── Error ──
  if (phase === 'error') return (
    <div className="screen active" style={{ alignItems: 'center', padding: '28px 16px 60px' }}>
      <div style={{ width: '100%', maxWidth: '560px' }}>
        <Header />
        <div style={{ textAlign: 'center', padding: '48px 20px' }}>
          <div style={{ fontSize: '2rem', marginBottom: 12 }}>⚠️</div>
          <p style={{ fontWeight: 700, marginBottom: 8 }}>Could not load moments</p>
          <p style={{ color: 'var(--muted)', fontSize: '.84rem', marginBottom: 24 }}>Check your connection and try again.</p>
          <button className="fib-next-btn" onClick={load}>Try Again</button>
        </div>
      </div>
    </div>
  );

  // ── Empty ──
  if (phase === 'empty') return (
    <div className="screen active" style={{ alignItems: 'center', padding: '28px 16px 60px' }}>
      <div style={{ width: '100%', maxWidth: '560px' }}>
        <Header />
        <div style={{ textAlign: 'center', padding: '48px 20px' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>💭</div>
          <p style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 8 }}>No moments yet</p>
          <p style={{ color: 'var(--muted)', fontSize: '.84rem', lineHeight: 1.6, marginBottom: 24 }}>
            Start a conversation — the engine captures phrases as you practice.
          </p>
          <button className="fib-next-btn" onClick={() => navigate('/scenarios')}>Start a Conversation</button>
        </div>
      </div>
    </div>
  );

  // ── Data ──
  const mastered   = moments.filter(m => (m.sr_reps || 0) >= 3);
  const inProgress = moments.filter(m => (m.sr_reps || 0) > 0 && (m.sr_reps || 0) < 3);
  const newOnes    = moments.filter(m => (m.sr_reps || 0) === 0);

  return (
    <div className="screen active" style={{ alignItems: 'center', padding: '28px 16px 60px' }}>
      <div style={{ width: '100%', maxWidth: '560px' }}>
        <Header />

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
          {[
            { label: 'Total', val: moments.length, color: 'var(--accent)' },
            { label: 'Mastered', val: mastered.length, color: '#2e7d32' },
            { label: 'In Progress', val: inProgress.length, color: '#f59e0b' },
          ].map(s => (
            <div key={s.label} style={{ flex: 1, background: 'var(--card)', border: '1.5px solid var(--border)', borderRadius: 12, padding: '12px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: s.color }}>{s.val}</div>
              <div style={{ fontSize: '.68rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.08em', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        <MomentGroup title="Phrases you've mastered" emoji="⭐" items={mastered} />
        <MomentGroup title="In progress" emoji="🔄" items={inProgress} />
        <MomentGroup title="Recently heard" emoji="👂" items={newOnes} />

        <div style={{ textAlign: 'center', marginTop: 8 }}>
          <button
            onClick={() => navigate('/srs')}
            style={{ background: 'none', border: '1.5px solid var(--border)', borderRadius: 10, padding: '8px 16px', fontFamily: "'DM Sans',sans-serif", fontSize: '.8rem', color: 'var(--ink)', cursor: 'pointer', width: '100%' }}
          >
            🔁 Review these words →
          </button>
        </div>
      </div>
    </div>
  );
}

function Header() {
  return (
    <div style={{ marginBottom: 20 }}>
      <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: '1.45rem', marginBottom: 5 }}>
        💭 My Moments
      </h2>
      <p style={{ color: 'var(--muted)', fontSize: '.85rem', lineHeight: 1.5 }}>
        Words you struggled with, brought back in context — your personal spaced repetition.
      </p>
    </div>
  );
}

function MomentGroup({ title, emoji, items }) {
  if (!items.length) return null;
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: '.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.12em', color: 'var(--muted)', marginBottom: 10 }}>
        {emoji} {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((m, i) => (
          <div key={i} style={{ background: 'var(--card)', border: '1.5px solid var(--border)', borderRadius: 12, padding: '13px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontWeight: 700, fontSize: '.95rem', color: 'var(--ink)' }}>{m.phrase}</span>
              {m.source_scenario && (
                <span style={{ fontSize: '.65rem', color: 'var(--muted)', background: 'var(--cream)', padding: '2px 7px', borderRadius: 6, flexShrink: 0, marginLeft: 8 }}>
                  {m.source_scenario}
                </span>
              )}
            </div>
            {m.translation && (
              <div style={{ fontSize: '.78rem', color: 'var(--muted)', marginBottom: m.context ? 4 : 0 }}>{m.translation}</div>
            )}
            {m.context && (
              <div style={{ fontSize: '.73rem', color: 'var(--muted)', opacity: .7, fontStyle: 'italic', lineHeight: 1.4 }}>{m.context}</div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 6, fontSize: '.65rem', color: 'var(--muted)' }}>
              <span>Used {m.times_used || 0}×</span>
              <span>·</span>
              <span>Seen {m.times_seen || 1}×</span>
              {m.user_produced && <span>· <span style={{ color: '#22c55e' }}>You said this</span></span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
