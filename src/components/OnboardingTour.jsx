import { useState, useEffect } from 'react';

const TOUR_KEY = 'perin_tour_done';

const STEPS = [
  {
    title: '👋 Welcome to Perin',
    body: 'Your immersive language tutor. Let\'s show you around — takes 30 seconds.',
    position: 'center',
  },
  {
    title: '🎬 Pick a mode',
    body: 'Start a Conversation for scenario practice, or try Scene Mode, Live Conversation, or Free Chat for different kinds of speaking.',
    position: 'center',
  },
  {
    title: '🎧 Drills & Quizzes',
    body: 'Fill the Blank, Culture Quiz, Reading, Listening — short focused exercises you can do in 2 minutes.',
    position: 'center',
  },
  {
    title: '💾 Save words as you go',
    body: 'Tap the chip buttons (🔑 phrases) or the Save button during any conversation to build your vocab list.',
    position: 'center',
  },
  {
    title: '⚙️ Settings',
    body: 'Tap the gear icon to manage languages, change voice gender, switch dark mode, and more.',
    position: 'center',
  },
];

export default function OnboardingTour() {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const done = localStorage.getItem(TOUR_KEY);
    if (!done) setVisible(true);
  }, []);

  function next() {
    if (step < STEPS.length - 1) {
      setStep(s => s + 1);
    } else {
      dismiss();
    }
  }

  function dismiss() {
    localStorage.setItem(TOUR_KEY, '1');
    setVisible(false);
  }

  if (!visible) return null;

  const current = STEPS[step];

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={dismiss}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)',
          zIndex: 1000, backdropFilter: 'blur(2px)',
        }}
      />

      {/* Tooltip */}
      <div style={{
        position: 'fixed',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        background: 'var(--card)',
        border: '1.5px solid var(--border)',
        borderRadius: 20,
        padding: '28px 24px 22px',
        width: 'min(360px, 90vw)',
        zIndex: 1001,
        boxShadow: '0 20px 60px rgba(0,0,0,.3)',
        textAlign: 'center',
      }}>
        {/* Step dots */}
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 20 }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              width: i === step ? 20 : 7, height: 7,
              borderRadius: 4,
              background: i === step ? 'var(--accent)' : 'var(--border)',
              transition: 'all .2s',
            }} />
          ))}
        </div>

        {/* Content */}
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: '1.15rem', fontWeight: 700, color: 'var(--ink)', marginBottom: 10 }}>
          {current.title}
        </div>
        <p style={{ fontSize: '.88rem', color: 'var(--muted)', lineHeight: 1.6, marginBottom: 24 }}>
          {current.body}
        </p>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={dismiss}
            style={{ flex: 1, background: 'none', border: '1.5px solid var(--border)', borderRadius: 12, padding: '10px', fontFamily: "'DM Sans',sans-serif", fontSize: '.82rem', color: 'var(--muted)', cursor: 'pointer' }}
          >
            Skip
          </button>
          <button
            onClick={next}
            style={{ flex: 2, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 12, padding: '10px', fontFamily: "'DM Sans',sans-serif", fontSize: '.88rem', fontWeight: 700, cursor: 'pointer' }}
          >
            {step < STEPS.length - 1 ? 'Next →' : 'Got it! 🎉'}
          </button>
        </div>
      </div>
    </>
  );
}
