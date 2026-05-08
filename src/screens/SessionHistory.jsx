import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';

function formatDate(iso) {
  try {
    const d = new Date(iso);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch { return ''; }
}

function formatTime(iso) {
  try {
    return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  } catch { return ''; }
}

function groupByDate(sessions) {
  const groups = {};
  sessions.forEach(s => {
    const label = formatDate(s.date);
    if (!groups[label]) groups[label] = [];
    groups[label].push(s);
  });
  return groups;
}

export default function SessionHistory() {
  const { state } = useApp();
  const navigate = useNavigate();

  const history = state.history || [];
  const [filterLang, setFilterLang] = useState('all');
  const [search, setSearch] = useState('');

  const langs = ['all', ...new Set(history.map(s => s.lang).filter(Boolean))];

  const filtered = history
    .filter(s => filterLang === 'all' || s.lang === filterLang)
    .filter(s => !search.trim() || (s.scenario || '').toLowerCase().includes(search.trim().toLowerCase()));

  const grouped = groupByDate(filtered);

  const totalXP = filtered.reduce((sum, s) => sum + (s.xp || 0), 0);
  const totalMessages = filtered.reduce((sum, s) => sum + (s.messages || 0), 0);
  const totalMins = filtered.reduce((sum, s) => sum + (s.duration || 0), 0);

  if (!history.length) return (
    <div className="screen active" style={{ alignItems: 'center', padding: '28px 16px 60px' }}>
      <div style={{ width: '100%', maxWidth: '560px' }}>
        <Header onBack={() => navigate('/settings')} />
        <div style={{ textAlign: 'center', padding: '48px 20px' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📋</div>
          <p style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 8 }}>No sessions yet</p>
          <p style={{ color: 'var(--muted)', fontSize: '.84rem', marginBottom: 24 }}>
            Complete a conversation to see your history here.
          </p>
          <button className="fib-next-btn" onClick={() => navigate('/scenarios')}>Start a Conversation</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="screen active" style={{ alignItems: 'center', padding: '28px 16px 60px' }}>
      <div style={{ width: '100%', maxWidth: '560px' }}>
        <Header onBack={() => navigate('/settings')} />

        {/* Stats */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          {[
            { label: 'Sessions', val: filtered.length },
            { label: 'Messages', val: totalMessages },
            { label: 'Minutes', val: totalMins },
            { label: 'XP earned', val: totalXP },
          ].map(s => (
            <div key={s.label} style={{ flex: 1, background: 'var(--card)', border: '1.5px solid var(--border)', borderRadius: 12, padding: '10px 6px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent)' }}>{s.val}</div>
              <div style={{ fontSize: '.6rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.08em', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Search */}
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search scenarios…"
            style={{
              width: '100%', padding: '10px 14px 10px 36px', fontSize: '.88rem',
              border: '1.5px solid var(--border)', borderRadius: 10,
              fontFamily: "'DM Sans',sans-serif", background: 'var(--card)',
              color: 'var(--ink)', boxSizing: 'border-box', outline: 'none',
            }}
          />
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: '.9rem' }}>🔍</span>
          {search && (
            <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '1rem', padding: 0 }}>✕</button>
          )}
        </div>

        {/* Language filter */}
        {langs.length > 2 && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
            {langs.map(l => (
              <button key={l} onClick={() => setFilterLang(l)} style={{
                padding: '4px 12px', borderRadius: 20,
                border: `1.5px solid ${filterLang === l ? 'var(--accent)' : 'var(--border)'}`,
                background: filterLang === l ? 'var(--accent)' : 'var(--card)',
                color: filterLang === l ? '#fff' : 'var(--muted)',
                fontFamily: "'DM Sans',sans-serif", fontSize: '.72rem', fontWeight: 600, cursor: 'pointer',
              }}>
                {l === 'all' ? 'All' : l}
              </button>
            ))}
          </div>
        )}

        {/* No results */}
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '32px 20px', color: 'var(--muted)' }}>
            <p>No sessions match "{search}"</p>
          </div>
        )}

        {/* Sessions grouped by date */}
        {Object.entries(grouped).map(([dateLabel, sessions]) => (
          <div key={dateLabel} style={{ marginBottom: 20 }}>
            <div style={{ fontSize: '.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.12em', color: 'var(--muted)', marginBottom: 10 }}>
              {dateLabel}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sessions.map((s, i) => (
                <div key={i} style={{ background: 'var(--card)', border: '1.5px solid var(--border)', borderRadius: 12, padding: '13px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: '.9rem', color: 'var(--ink)' }}>
                      {s.scenario || 'Free Chat'}
                    </span>
                    <span style={{ fontSize: '.7rem', color: 'var(--accent)', fontWeight: 700 }}>+{s.xp || 0} XP</span>
                  </div>
                  <div style={{ display: 'flex', gap: 10, fontSize: '.72rem', color: 'var(--muted)' }}>
                    {s.lang && <span>{s.dialect && s.dialect !== s.lang ? `${s.dialect} ${s.lang}` : s.lang}</span>}
                    {s.level && <span>· {s.level}</span>}
                    {s.messages > 0 && <span>· {s.messages} messages</span>}
                    {s.duration > 0 && <span>· {s.duration}m</span>}
                    {s.date && <span>· {formatTime(s.date)}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Header({ onBack }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <button onClick={onBack} style={{ background: 'none', border: 'none', fontFamily: "'DM Sans',sans-serif", fontSize: '.82rem', color: 'var(--muted)', cursor: 'pointer', padding: '0 0 8px', display: 'flex', alignItems: 'center', gap: 4 }}>
        ‹ Settings
      </button>
      <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: '1.45rem', marginBottom: 5 }}>📋 Session History</h2>
      <p style={{ color: 'var(--muted)', fontSize: '.85rem' }}>Every conversation you've completed.</p>
    </div>
  );
}
