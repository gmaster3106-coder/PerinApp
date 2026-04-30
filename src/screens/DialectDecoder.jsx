import { useNavigate } from 'react-router-dom';

export default function DialectDecoder() {
  const navigate = useNavigate();
  return (
    <div className="screen active" style={{padding:'20px'}}>
      <h2>Dialect decoder</h2>
      <p style={{color:'var(--muted)'}}>Coming soon...</p>
    </div>
  );
}
