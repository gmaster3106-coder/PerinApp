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

  const [phase, setPhase]     = useState('loading');
  const [moments, setMoments] = useState([]);
  const [source, setSource]   = useState('api'); // 'api' | 'local'

  useEffect(() => {
    if (!lang) { setPhase('nolang'); return; }
    load();
  }, [lang, dialect, isLoggedIn]);

  async function load() {
    setPhase('loading');

    // Try API first if logged in
    if (isLoggedIn) {
      try {
        const token = await getValidToken();
        const res = await fetch(
          `${WORKER_URL}/api/memory?lang=${encodeURIComponent(lang)}&dialect=${encodeURIComponent(dialect)}&limit=100`,
          { headers: token ? { Authorization: `Bearer ${token}` } : {} }
        );
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length) {
            setMoments(data);
            setSource('api');
            setPhase('data');
            return;
          }
        }
      } catch { /* fall through to local */ }
    }

    // Fallback: use local vocab
    try {
      const vocab = JSON.parse(localStorage.getItem('perin_vocab') || '[]');
      const langVocab = vocab.filter(v => !v.lang || v.lang === lang);
      if (langVocab.length) {
        // Convert vocab format to moments format
        const converted = langVocab.map(v => ({
          phrase: v.word,
          translation: v.meaning,
          sr_reps: v.reviews || 0,
          times_used: v.reviews || 0,
          times_seen: Math.max(v.reviews || 0, 1),
          source_scenario: null,
          context: null,
          user_produced: false,
        }));
        setMoments(converted);
        setSource('local');
        setPhase('data');
      } else {
        setPhase('empty');
      }
    } catch {
      setPhase('empty');
    }
  }

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

  if (phase === 'loading') return (
    <div className="screen active" style={{ alignItems: 'center', padding: '28px 16px 60px' }}>
      <div style={{ width: '100%', maxWidth: '560px' }}>
        <Header />
        <div style={{ padding: '48px 0', textAlign: 'center' }}>
          <p style={{ marginBottom: 18, fontSize: '.9rem', color: 'var(--muted)' }}>Loading your moments…</p>
          <span className="fib-loading-dot" />
          <span className="fib-loading-dot" />
          <span className="fib-loading-dot" />
        </div>
      </div>
    </div>
  );

  if (phase === 'empty') return (
    <div className="screen active" style={{ alignItems: 'center', padding: '28px 16px 60px' }}>
      <div style={{ width: '100%', maxWidth: '560px' }}>
        <Header />
        <div style={{ textAlign: 'center', padding: '48px 20px' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>💭</div>
          <p style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 8 }}>No moments yet</p>
          <p style={{ color: 'var(--muted)', fontSize: '.84rem', lineHeight: 1.6, marginBottom: 24 }}>
            Save words during conversations — tap 💾 on any retention chip to build your collection.
          </p>
          <button className="fib-next-btn" onClick={() => navigate('/scenarios')}>Start a Conversation</button>
        </div>
      </div>
    </div>
  );

  const mastered   = moments.filter(m => (m.sr_reps || 0) >= 3);
  const inProgress = moments.filter(m => (m.sr_reps || 0) > 0 && (m.sr_reps || 0) < 3);
  const newOnes    = moments.filter(m => (m.sr_reps || 0) === 0);

  return (
    <div className="screen active" style={{ alignItems: 'center', padding: '28px 16px 60px' }}>
      <div style={{ width: '100%', maxWidth: '560px' }}>
        <Header />

        {source === 'local' && (
          <div style={{ background: 'var(--cream)', borderRadius: 10, padding: '8px 14px', marginBottom: 16, fontSize: '.75rem', color: 'var(--muted)' }}>
            💡 Showing your saved vocabulary. Sign in to sync moments across devices.
          </div>
        )}

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

        <MomentGroup title="Words you've mastered" emoji="⭐" items={mastered} />
        <MomentGroup title="In progress" emoji="🔄" items={inProgress} />
        <MomentGroup title="Recently saved" emoji="👂" items={newOnes} />

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
        Words you've saved, brought back in context — your personal collection.
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
              <span>Reviewed {m.times_used || 0}×</span>
              {m.user_produced && <span>· <span style={{ color: '#22c55e' }}>You said this</span></span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
