import { useNavigate } from 'react-router-dom';

export default function DialectDecoder() {
  const navigate = useNavigate();
  return (
    <div className="screen active" style={{ padding: '20px' }}>
      <button
        onClick={() => navigate(-1)}
        style={{ background: 'none', border: 'none', fontSize: '1rem', color: 'var(--muted)', cursor: 'pointer', marginBottom: '16px', padding: 0 }}
      >
        ← Back
      </button>
      <h2>Dialect Decoder</h2>
      <p style={{ color: 'var(--muted)' }}>Coming soon...</p>
    </div>
  );
}
