import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { getAvatarColor, getAvatarInitials } from '../utils/avatarUtils.js';

const GOALS = [
  { minutes: 10, label: '10 min' },
  { minutes: 30, label: '30 min' },
  { minutes: 60, label: '60 min' },
];

export default function Profile() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const isNewUser = !state.profile?.name;

  const [name, setName] = useState(state.profile?.name || '');
  const [motivation, setMotivation] = useState(state.profile?.motivation || '');
  const [goal, setGoal] = useState(state.activeLang?.dailyGoal || 30);

  const avatarColor = getAvatarColor(name || 'user');
  const initials = name ? getAvatarInitials(name, '') : '?';

  function handleSave() {
    if (!name.trim()) return;
    dispatch({ type: 'SET_PROFILE', payload: { name: name.trim(), motivation } });

    // Update daily goal on active language
    if (state.activeLang?.lang) {
      const updated = state.languages.map(l =>
        l.lang === state.activeLang.lang && l.dialect === state.activeLang.dialect
          ? { ...l, dailyGoal: goal }
          : l
      );
      dispatch({ type: 'SET_LANGUAGES', payload: updated });
      dispatch({ type: 'SET_ACTIVE_LANG', payload: { ...state.activeLang, dailyGoal: goal } });
    }

    if (isNewUser) {
      const introSeen = localStorage.getItem('perin_intro_seen');
      navigate(introSeen ? '/onboarding' : '/intro');
    } else {
      navigate('/dashboard');
    }
  }

  return (
    <div className="screen active center-screen" id="screen-profile">
      <div className="profile-new">
        {!isNewUser && (
          <button onClick={() => navigate('/dashboard')} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', fontFamily: "'DM Sans',sans-serif", fontSize: '.82rem', color: 'var(--muted)', cursor: 'pointer', padding: '0 0 8px' }}>
            ← Back
          </button>
        )}

        <div className="profile-new-step">{isNewUser ? "What should we call you?" : "Edit profile"}</div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', marginBottom: '8px' }}>
          <div style={{
            width: '72px', height: '72px', borderRadius: '50%',
            background: avatarColor.bg, color: avatarColor.fg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '28px', fontWeight: '700', fontFamily: "'DM Sans',sans-serif",
            transition: 'background .3s',
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

        <div style={{ width: '100%', maxWidth: '320px' }}>
          <div style={{ fontSize: '.72rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--muted)', marginBottom: '8px', textAlign: 'left' }}>
            Why are you learning? <span style={{ fontWeight: '400', opacity: '.6' }}>(optional)</span>
          </div>
          <textarea
            placeholder="e.g. My partner's family speaks Spanish, I'm moving to Lisbon…"
            maxLength={200}
            value={motivation}
            onChange={e => setMotivation(e.target.value)}
            style={{ width: '100%', padding: '11px 14px', border: '1.5px solid var(--border)', borderRadius: '12px', fontFamily: "'DM Sans',sans-serif", fontSize: '.88rem', color: 'var(--ink)', background: 'var(--card)', resize: 'none', height: '80px', lineHeight: '1.5' }}
          />
        </div>

        {!isNewUser && state.activeLang?.lang && (
          <div style={{ width: '100%', maxWidth: '320px' }}>
            <div style={{ fontSize: '.72rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--muted)', marginBottom: '8px', textAlign: 'left' }}>
              Daily goal
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {GOALS.map(g => (
                <button key={g.minutes} onClick={() => setGoal(g.minutes)} style={{
                  flex: 1, padding: '10px', borderRadius: 10, cursor: 'pointer',
                  fontFamily: "'DM Sans',sans-serif", fontSize: '.85rem', fontWeight: 600,
                  border: `2px solid ${goal === g.minutes ? 'var(--accent)' : 'var(--border)'}`,
                  background: goal === g.minutes ? 'var(--accent)' : 'var(--card)',
                  color: goal === g.minutes ? '#fff' : 'var(--muted)',
                  transition: 'all .15s',
                }}>
                  {g.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          className="welcome-new-cta"
          style={{ marginTop: '32px' }}
          onClick={handleSave}
          disabled={!name.trim()}
        >
          {isNewUser ? 'Continue →' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}
