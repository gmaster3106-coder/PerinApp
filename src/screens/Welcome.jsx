import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';

export default function Welcome() {
  const { state } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    if (state.profile?.name) {
      navigate('/dashboard', { replace: true });
    }
  }, []);

  return (
    <div className="screen active" id="screen-welcome">
      <div className="welcome-new">
        <div className="welcome-new-top">
          <div className="welcome-new-logo">Pe<span>rin</span></div>
          <div className="welcome-new-tagline">Speak like a local</div>
          <div className="welcome-new-emoji">🌍</div>
        </div>
        <div className="welcome-new-bottom">
          <button className="welcome-new-cta" onClick={() => navigate('/profile')}>
            Get Started
          </button>
        </div>
      </div>
    </div>
  );
}