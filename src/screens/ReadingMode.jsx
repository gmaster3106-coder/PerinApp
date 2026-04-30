import { useNavigate } from 'react-router-dom';

export default function ReadingMode() {
  const navigate = useNavigate();
  return (
    <div className="screen active" style={{padding:'20px'}}>
      <h2>Reading mode</h2>
      <p style={{color:'var(--muted)'}}>Coming soon...</p>
    </div>
  );
}
