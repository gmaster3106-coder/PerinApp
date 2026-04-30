import { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { useAuth } from '../hooks/useAuth.js';

let _showAuthModal = null;
export function showAuthModal() { _showAuthModal?.(); }

export default function AuthModal() {
  const { state, fetchSubscription } = useApp();
  const { login, signup, resetPassword } = useAuth();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [confirmSent, setConfirmSent] = useState(false);
  const emailRef = useRef(null);

  useEffect(() => {
    _showAuthModal = () => {
      setOpen(true); setMode('signup'); setError('');
      setResetSent(false); setConfirmSent(false);
      setTimeout(() => emailRef.current?.focus(), 100);
    };
    return () => { _showAuthModal = null; };
  }, []);

  function close() {
    setOpen(false); setEmail(''); setPassword('');
    setError(''); setResetSent(false); setConfirmSent(false);
  }

  function toggleMode() {
    setMode(m => m === 'signup' ? 'login' : 'signup');
    setError(''); setResetSent(false); setConfirmSent(false);
  }

  async function submit() {
    if (!email.trim()) { setError('Please enter your email address.'); return; }

    if (mode === 'reset') {
      setLoading(true);
      try {
        await resetPassword(email.trim());
        setResetSent(true);
      } catch { setError('Could not send reset email. Please try again.'); }
      finally { setLoading(false); }
      return;
    }

    if (!password) { setError('Please enter your password.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }

    setLoading(true);
    setError('');
    try {
      if (mode === 'signup') {
        await signup(email.trim(), password);
        close();
      } else {
        await login(email.trim(), password);
        close();
      }
    } catch (err) {
      // Email confirmation required — show a friendly screen instead of an error
      if (err.message === 'CONFIRM_EMAIL') {
        setConfirmSent(true);
        setLoading(false);
        return;
      }
      const raw = (err.message || '').toLowerCase();
      const msg = raw.includes('invalid login') || raw.includes('invalid credentials') || raw.includes('wrong password')
        ? 'Wrong email or password. Try again.'
        : raw.includes('email not confirmed') || raw.includes('not confirmed')
        ? 'Please confirm your email first — check your inbox.'
        : raw.includes('rate limit') || raw.includes('too many')
        ? 'Too many attempts — wait a minute and try again.'
        : raw.includes('already registered') || raw.includes('already exists')
        ? 'An account with this email already exists. Try signing in.'
        : err.message || 'Something went wrong. Try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  const titles    = { signup: 'Create your account', login: 'Welcome back', reset: 'Reset your password' };
  const subs      = { signup: 'Sign up to save your progress', login: 'Sign in to continue your progress', reset: "Enter your email and we'll send a reset link" };
  const btnLabels = { signup: 'Create Account', login: 'Sign In', reset: 'Send Reset Link' };

  return (
    <div
      onClick={e => e.target === e.currentTarget && close()}
      style={{ display: 'flex', position: 'fixed', inset: 0, background: 'rgba(10,26,58,.7)', zIndex: 800, alignItems: 'center', justifyContent: 'center', padding: '20px', animation: 'fadeIn .2s ease' }}
    >
      <div style={{ background: 'var(--card)', borderRadius: '24px', padding: '32px 28px', width: '100%', maxWidth: '400px', boxShadow: '0 20px 60px rgba(10,26,58,.3)', position: 'relative' }}>
        <button onClick={close} style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: 'var(--muted)', fontSize: '1.2rem', cursor: 'pointer', padding: '4px', lineHeight: 1, minWidth: '32px', minHeight: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px' }}>✕</button>

        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: '1.8rem', color: 'var(--ink)', marginBottom: '6px' }}>Pe<span style={{ color: 'var(--accent)' }}>rin</span></div>
          <div style={{ fontSize: '1.05rem', fontWeight: '600', color: 'var(--ink)' }}>{titles[mode]}</div>
          <div style={{ fontSize: '.82rem', color: 'var(--muted)', marginTop: '4px' }}>{subs[mode]}</div>
        </div>

        {/* Email confirmation sent */}
        {confirmSent ? (
          <div style={{ textAlign: 'center', padding: '12px' }}>
            <div style={{ fontSize: '2rem', marginBottom: '12px' }}>📬</div>
            <div style={{ fontSize: '.9rem', color: 'var(--ink)', fontWeight: '600', marginBottom: '6px' }}>Check your email</div>
            <div style={{ fontSize: '.82rem', color: 'var(--muted)', lineHeight: 1.6 }}>
              We sent a confirmation link to <strong>{email}</strong>.<br />
              Click it, then come back and sign in.
            </div>
            <button
              onClick={() => { setMode('login'); setConfirmSent(false); }}
              style={{ marginTop: '16px', background: 'none', border: 'none', color: 'var(--accent)', fontFamily: "'DM Sans',sans-serif", fontSize: '.82rem', fontWeight: '600', cursor: 'pointer' }}
            >
              Go to sign in →
            </button>
          </div>

        /* Password reset sent */
        ) : resetSent ? (
          <div style={{ textAlign: 'center', padding: '12px' }}>
            <div style={{ fontSize: '2rem', marginBottom: '12px' }}>📬</div>
            <div style={{ fontSize: '.9rem', color: 'var(--ink)', fontWeight: '600', marginBottom: '6px' }}>Check your email</div>
            <div style={{ fontSize: '.82rem', color: 'var(--muted)' }}>We sent a reset link to {email}</div>
            <button
              onClick={() => { setMode('login'); setResetSent(false); }}
              style={{ marginTop: '16px', background: 'none', border: 'none', color: 'var(--accent)', fontFamily: "'DM Sans',sans-serif", fontSize: '.82rem', fontWeight: '600', cursor: 'pointer' }}
            >
              Back to sign in
            </button>
          </div>

        /* Main form */
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input
              ref={emailRef}
              type="email"
              placeholder="Email address"
              autoComplete="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && submit()}
              style={{ fontSize: '16px', padding: '12px 16px', borderRadius: '12px', border: '1.5px solid var(--border)', background: 'var(--cream)', color: 'var(--ink)', fontFamily: "'DM Sans',sans-serif", outline: 'none', width: '100%', boxSizing: 'border-box' }}
            />
            {mode !== 'reset' && (
              <input
                type="password"
                placeholder="Password"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                onKeyDown={e => e.key === 'Enter' && submit()}
                style={{ fontSize: '16px', padding: '12px 16px', borderRadius: '12px', border: '1.5px solid var(--border)', background: 'var(--cream)', color: 'var(--ink)', fontFamily: "'DM Sans',sans-serif", outline: 'none', width: '100%', boxSizing: 'border-box' }}
              />
            )}
            {error && (
              <div style={{ fontSize: '.8rem', color: 'var(--danger)', textAlign: 'center', padding: '6px' }}>{error}</div>
            )}
            <button
              onClick={submit}
              disabled={loading}
              style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '12px', padding: '13px', fontFamily: "'DM Sans',sans-serif", fontSize: '.95rem', fontWeight: '700', cursor: loading ? 'default' : 'pointer', width: '100%', opacity: loading ? .7 : 1 }}
            >
              {loading ? '…' : btnLabels[mode]}
            </button>
            {mode === 'login' && (
              <div style={{ textAlign: 'center' }}>
                <button
                  onClick={() => { setMode('reset'); setError(''); }}
                  style={{ background: 'none', border: 'none', color: 'var(--muted)', fontFamily: "'DM Sans',sans-serif", fontSize: '.78rem', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Forgot password?
                </button>
              </div>
            )}
          </div>
        )}

        {!resetSent && !confirmSent && (
          <div style={{ textAlign: 'center', marginTop: '16px' }}>
            <span style={{ fontSize: '.82rem', color: 'var(--muted)' }}>
              {mode === 'signup' ? 'Already have an account? ' : mode === 'login' ? "Don't have an account? " : 'Remember it? '}
            </span>
            <button
              onClick={toggleMode}
              style={{ background: 'none', border: 'none', color: 'var(--accent)', fontFamily: "'DM Sans',sans-serif", fontSize: '.82rem', fontWeight: '600', cursor: 'pointer', padding: 0 }}
            >
              {mode === 'signup' ? 'Sign in' : 'Sign up'}
            </button>
          </div>
        )}

        <p style={{ fontSize: '.72rem', color: 'var(--muted)', textAlign: 'center', marginTop: '16px', lineHeight: 1.5 }}>
          By continuing you agree to our <a href="#" style={{ color: 'var(--accent)' }}>Terms</a> and <a href="#" style={{ color: 'var(--accent)' }}>Privacy Policy</a>
        </p>
      </div>
    </div>
  );
}
