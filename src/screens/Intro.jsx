import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const SLIDES = [
  {
    emoji: '🌍',
    title: 'Pick a language.\nStart talking.',
    body: "Choose your language and dialect, pick a scenario — coffee shop, taxi, market — and your AI tutor plays the other person. You respond. That's it. No lessons, no grammar tables.",
    tag: '10 dialects · Spanish · French · Italian · Portuguese · Creole',
  },
  {
    emoji: '⚡',
    title: "The AI doesn't\ngo easy on you",
    body: "As you improve, your tutor naturally picks up speed, stops waiting for you, and starts using slang. It'll misunderstand you on purpose sometimes — because that's what real conversations do.",
    tag: 'Adapts to your level automatically',
  },
  {
    emoji: '🧠',
    title: 'It remembers what\nyou struggled with',
    body: 'Words you hesitated on, phrases that tripped you up — all tracked. Your tutor quietly brings them back in future conversations. No flashcards. Just the language, again, in context.',
    tag: 'Gets smarter the more you use it',
  },
  {
    emoji: '🎙️',
    title: 'Your first session\ntakes 3 minutes',
    body: "Tell us what you're learning and why. We'll place you at the right level and start you with a real scenario — no homework, no vocab list. Just open your mouth and go.",
    tag: 'Built for real fluency, not test scores',
    cta: true,
  },
];

export default function Intro() {
  const [slide, setSlide] = useState(0);
  const navigate = useNavigate();
  const timerRef = useRef(null);
  const touchStartX = useRef(0);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setSlide(s => {
        if (s < SLIDES.length - 1) return s + 1;
        clearInterval(timerRef.current);
        return s;
      });
    }, 4000);
    return () => clearInterval(timerRef.current);
  }, []);

  function done() {
    clearInterval(timerRef.current);
    localStorage.setItem('perin_intro_seen', '1');
    navigate('/onboarding');
  }

  function advance() {
    if (slide < SLIDES.length - 1) setSlide(s => s + 1);
    else done();
  }

  function handleTouchStart(e) {
    touchStartX.current = e.touches[0].clientX;
  }

  function handleTouchEnd(e) {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (diff > 50) advance();
    else if (diff < -50 && slide > 0) setSlide(s => s - 1);
  }

  const s = SLIDES[slide];

  return (
    <div
      id="screen-intro"
      className="screen active"
      style={{ background:'var(--im-bg)', color:'var(--im-text)', overflow:'hidden', padding:0, position:'fixed', top:0, left:0, right:0, bottom:0, zIndex:200, height:'100dvh' }}
      onClick={advance}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div style={{ width:'100%', height:'100%', position:'relative' }}>
        <div className="intro-slide active">
          <div className="intro-slide-inner">
            <div className="intro-emoji">{s.emoji}</div>
            <h2 className="intro-title" style={{ whiteSpace:'pre-line' }}>{s.title}</h2>
            <p className="intro-body">{s.body}</p>
            <div className="intro-tag">{s.tag}</div>
            {s.cta && (
              <button onClick={e => { e.stopPropagation(); done(); }} className="intro-cta">
                Let's go →
              </button>
            )}
          </div>
        </div>

        <div className="intro-dots">
          {SLIDES.map((_, i) => (
            <div key={i} className={`intro-dot${i === slide ? ' active' : ''}`} />
          ))}
        </div>

        <button
          className="intro-skip"
          onClick={e => { e.stopPropagation(); done(); }}
        >
          Skip
        </button>
      </div>
    </div>
  );
}