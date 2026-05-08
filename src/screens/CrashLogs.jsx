import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { WORKER_URL } from '../config/constants.js';

const ADMIN_EMAIL = 'giostthomas@gmail.com'; // only show to this user

export default function CrashLogs() {
  const { state } = useApp();
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const userEmail = state.currentUser?.email;
  const isAdmin = userEmail === ADMIN_EMAIL;

  useEffect(() => {
    if (!isAdmin) return;
    fetch(`${WORKER_URL}/api/crash-logs`, {
      headers: { Authorization: `Bearer ${state.currentUser?.access_token}` },
    })
      .then(r => r.json())
      .then(data => { setLogs(data.logs || []); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [isAdmin]);

  if (!isAdmin) return (
    <div className="screen active" style={{ alignItems: 'center', padding: '28px 16px' }}>
      <p style={{ color: 'var(--muted)' }}>Access denied.</p>
    </div>
  );

  return (
    <div className="screen active" style={{ alignItems: 'center', padding: '28px 16px 60px' }}>
      <div style={{ width: '100%', maxWidth: '600px' }}>
        <button onClick={() => navigate('/settings')} style={{ background: 'none', border: 'none', fontFamily: "'DM Sans',sans-serif", fontSize: '.82rem', color: 'var(--muted)', cursor: 'pointer', padding: '0 0 12px' }}>
          ← Back
        </button>
        <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: '1.45rem', marginBottom: 5 }}>🪲 Crash Logs</h2>
        <p style={{ color: 'var(--muted)', fontSize: '.85rem', marginBottom: 20 }}>Recent client errors reported by the app.</p>

        {loading && <p style={{ color: 'var(--muted)' }}>Loading…</p>}
        {error && <p style={{ color: 'var(--danger)' }}>Error: {error}</p>}
        {!loading && logs.length === 0 && <p style={{ color: 'var(--muted)' }}>No crash logs found.</p>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {logs.map((log, i) => (
            <div key={i} style={{ background: 'var(--card)', border: '1.5px solid var(--border)', borderRadius: 12, padding: '12px 14px', fontFamily: 'monospace', fontSize: '.78rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontWeight: 700, color: 'var(--danger)' }}>{log.type || 'error'}</span>
                <span style={{ color: 'var(--muted)' }}>{log.t ? new Date(log.t).toLocaleString() : ''}</span>
              </div>
              <div style={{ color: 'var(--ink)', marginBottom: 4 }}>{log.msg}</div>
              {log.detail && <div style={{ color: 'var(--muted)', fontSize: '.72rem' }}>{log.detail}</div>}
              {log.url && <div style={{ color: 'var(--muted)', fontSize: '.7rem', marginTop: 4 }}>{log.url}</div>}
              {log.ip && <div style={{ color: 'var(--muted)', fontSize: '.7rem' }}>IP: {log.ip}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
