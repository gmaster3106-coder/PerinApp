import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { showAuthModal } from '../components/AuthModal.jsx';

export default function Paywall() {
  const { state } = useApp();
  const navigate = useNavigate();
  const isLoggedIn = !!state.currentUser?.access_token;
  const used = state.subscription?.conversations_used || 0;

  return (
    <div className="screen active" id="screen-paywall" style={{ alignItems: 'center', justifyContent: 'center', padding: '32px 20px 60px' }}>
      <div style={{ width: '100%', maxWidth: 440, textAlign: 'center' }}>

        {/* Icon */}
        <div style={{ fontSize: '2.8rem', marginBottom: 12 }}>🔒</div>

        {/* Heading */}
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: '1.6rem', fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>
          You've used your {used} free conversations
        </div>
        <p style={{ color: 'var(--muted)', fontSize: '.88rem', lineHeight: 1.6, marginBottom: 28 }}>
          Upgrade to Pro for unlimited conversations, all modes, and full access to every feature.
        </p>

        {/* Feature list */}
        <div style={{ background: 'var(--card)', border: '1.5px solid var(--border)', borderRadius: 16, padding: '20px 24px', marginBottom: 24, textAlign: 'left' }}>
          {[
            ['✅', 'Unlimited conversations'],
            ['✅', 'All scenario and scene modes'],
            ['✅', 'Live Conversation (Pressure Mode)'],
            ['✅', 'Vocab review & spaced repetition'],
            ['✅', 'AI session recap & phrase saving'],
            ['✅', 'Culture Quiz & Fill the Blank'],
          ].map(([icon, text], i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: i < 5 ? 10 : 0 }}>
              <span>{icon}</span>
              <span style={{ fontSize: '.88rem', color: 'var(--ink)' }}>{text}</span>
            </div>
          ))}
        </div>

        {/* Price */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--ink)' }}>$9.99<span style={{ fontSize: '1rem', fontWeight: 400, color: 'var(--muted)' }}>/month</span></div>
          <div style={{ fontSize: '.78rem', color: 'var(--muted)', marginTop: 4 }}>Cancel anytime</div>
        </div>

        {/* CTA */}
        <button
          onClick={() => {
            if (!isLoggedIn) { showAuthModal(); return; }
            // Stripe checkout — wire this to your payment link
            window.open('https://buy.stripe.com/your_link_here', '_blank');
          }}
          style={{ width: '100%', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 14, padding: '15px', fontFamily: "'DM Sans',sans-serif", fontSize: '1rem', fontWeight: 700, cursor: 'pointer', marginBottom: 12 }}
        >
          {isLoggedIn ? 'Upgrade to Pro →' : 'Sign in to upgrade →'}
        </button>

        <button
          onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', color: 'var(--muted)', fontFamily: "'DM Sans',sans-serif", fontSize: '.84rem', cursor: 'pointer', padding: 8 }}
        >
          Maybe later
        </button>

      </div>
    </div>
  );
}
