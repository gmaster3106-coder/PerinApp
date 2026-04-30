import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { getAvatarColor, getAvatarInitials } from '../utils/avatarUtils.js';

export default function Profile() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const [name, setName] = useState(state.profile?.name || '');
  const [motivation, setMotivation] = useState(state.profile?.motivation || '');

  const avatarColor = getAvatarColor(name || 'user');
  const initials = name ? getAvatarInitials(name, '') : '?';

  function handleContinue() {
    if (!name.trim()) return;
    dispatch({ type: 'SET_PROFILE', payload: { name: name.trim(), motivation } });
    const introSeen = localStorage.getItem('perin_intro_seen');
    if (!introSeen) {
      navigate('/intro');
    } else {
      navigate('/onboarding');
    }
  }

  return (
    <div className="screen active center-screen" id="screen-profile">
      <div className="profile-new">
        <div className="profile-new-step">What should we call you?</div>

        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'16px', marginBottom:'8px' }}>
          <div style={{
            width:'72px', height:'72px', borderRadius:'50%',
            background: avatarColor.bg, color: avatarColor.fg,
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:'28px', fontWeight:'700', fontFamily:"'DM Sans',sans-serif",
            transition:'background .3s',
          }}>
            {initials}
          </div>
        </div>

        <input
          type="text"
          className="profile-new-input"
          placeholder="Your name…"
          maxLength={30}
          value={name}
          onChange={e => setName(e.target.value)}
        />

        <div style={{ width:'100%', maxWidth:'320px' }}>
          <div style={{ fontSize:'.72rem', fontWeight:'700', textTransform:'uppercase', letterSpacing:'.1em', color:'var(--muted)', marginBottom:'8px', textAlign:'left' }}>
            Why are you learning? <span style={{ fontWeight:'400', opacity:'.6' }}>(optional)</span>
          </div>
          <textarea
            placeholder="e.g. My partner's family speaks Spanish, I'm moving to Lisbon…"
            maxLength={200}
            value={motivation}
            onChange={e => setMotivation(e.target.value)}
            style={{ width:'100%', padding:'11px 14px', border:'1.5px solid var(--border)', borderRadius:'12px', fontFamily:"'DM Sans',sans-serif", fontSize:'.88rem', color:'var(--ink)', background:'var(--card)', resize:'none', height:'80px', lineHeight:'1.5' }}
          />
        </div>

        <button
          className="welcome-new-cta"
          style={{ marginTop:'32px' }}
          onClick={handleContinue}
          disabled={!name.trim()}
        >
          Continue →
        </button>
      </div>
    </div>
  );
}