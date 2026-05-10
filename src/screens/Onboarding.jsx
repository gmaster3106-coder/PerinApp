import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { showAuthModal } from '../components/AuthModal.jsx';
import { OB_DIALECTS } from '../data/languages.js';

const NATIVE_LANGS = [
  { native: 'English',    flag: '🇺🇸', label: 'English' },
  { native: 'Spanish',    flag: '🇪🇸', label: 'Español' },
  { native: 'French',     flag: '🇫🇷', label: 'Français' },
  { native: 'Portuguese', flag: '🇧🇷', label: 'Português' },
  { native: 'Italian',    flag: '🇮🇹', label: 'Italiano' },
  { native: 'Creole',     flag: '🇭🇹', label: 'Kreyòl' },
];

const TARGET_LANGS = [
  { lang: 'Spanish',    flag: '🇪🇸', label: 'Spanish' },
  { lang: 'French',     flag: '🇫🇷', label: 'French' },
  { lang: 'Italian',    flag: '🇮🇹', label: 'Italian' },
  { lang: 'Portuguese', flag: '🇵🇹', label: 'Portuguese' },
  { lang: 'English',    flag: '🇺🇸', label: 'English' },
  { lang: 'Creole',     flag: '🇭🇹', label: 'Creole' },
];

const GOALS = [
  { minutes: 10, label: '10 min' },
  { minutes: 30, label: '30 min' },
  { minutes: 60, label: '60 min' },
];

// ── Placement quiz questions per language ────────────────────────────────────
const PLACEMENT_QUESTIONS = {
  Spanish: [
    {
      q: 'What does "¿Cómo te llamas?" mean?',
      options: ['How are you?', 'What is your name?', 'Where are you from?', 'How old are you?'],
      answer: 1,
    },
    {
      q: 'Which sentence is correct?',
      options: ['Yo tengo hambre.', 'Yo tiene hambre.', 'Yo tener hambre.', 'Yo tienes hambre.'],
      answer: 0,
    },
    {
      q: 'Translate: "I have been living here for two years."',
      options: [
        'He vivido aquí por dos años.',
        'Vivo aquí por dos años.',
        'Viví aquí dos años.',
        'Estoy viviendo aquí por dos años.',
      ],
      answer: 0,
    },
  ],
  French: [
    {
      q: 'What does "Où habitez-vous?" mean?',
      options: ['What is your name?', 'How are you?', 'Where do you live?', 'What do you do?'],
      answer: 2,
    },
    {
      q: 'Which is correct: "I am hungry"?',
      options: ["J'ai faim.", "Je suis faim.", "J'ai froid.", "Je faim."],
      answer: 0,
    },
    {
      q: 'Which sentence uses the subjunctive correctly?',
      options: [
        'Il faut que tu viens.',
        'Il faut que tu viennes.',
        'Il faut que tu viendes.',
        'Il faut que tu venais.',
      ],
      answer: 1,
    },
  ],
  Italian: [
    {
      q: 'What does "Come ti chiami?" mean?',
      options: ['How are you?', 'What is your name?', 'Where are you from?', 'What do you want?'],
      answer: 1,
    },
    {
      q: 'Which is correct: "I am cold"?',
      options: ['Sono freddo.', 'Ho freddo.', 'Faccio freddo.', 'Sto freddo.'],
      answer: 1,
    },
    {
      q: 'Translate: "I would have gone if I had known."',
      options: [
        'Sarei andato se sapevo.',
        'Andrei se sapessi.',
        'Sarei andato se avessi saputo.',
        'Sono andato se sapevo.',
      ],
      answer: 2,
    },
  ],
  Portuguese: [
    {
      q: 'What does "Como você se chama?" mean?',
      options: ['How are you?', 'Where are you from?', 'What is your name?', 'What do you want?'],
      answer: 2,
    },
    {
      q: 'Which is correct: "I am hungry"?',
      options: ['Estou fome.', 'Tenho fome.', 'Sou fome.', 'Faço fome.'],
      answer: 1,
    },
    {
      q: 'Which sentence uses the future subjunctive correctly?',
      options: [
        'Quando eu vou, te aviso.',
        'Quando eu for, te aviso.',
        'Quando eu irei, te aviso.',
        'Quando eu fui, te aviso.',
      ],
      answer: 1,
    },
  ],
  Creole: [
    {
      q: 'What does "Kijan ou rele?" mean?',
      options: ['How are you?', 'What is your name?', 'Where are you from?', 'What do you want?'],
      answer: 1,
    },
    {
      q: 'How do you say "I am eating"?',
      options: ["M'ap manje.", "Mwen manje.", "Mwen te manje.", "M'te manje."],
      answer: 0,
    },
    {
      q: 'Which correctly expresses the past?',
      options: ['Mwen manje deja.', 'Mwen te manje deja.', "M'ap manje deja.", 'Mwen pral manje.'],
      answer: 1,
    },
  ],
  English: [
    {
      q: 'Which sentence is grammatically correct?',
      options: [
        'She don\'t know the answer.',
        'She doesn\'t knows the answer.',
        'She doesn\'t know the answer.',
        'She don\'t knows the answer.',
      ],
      answer: 2,
    },
    {
      q: 'Choose the correct form: "If I ___ you, I would apologize."',
      options: ['am', 'was', 'were', 'be'],
      answer: 2,
    },
    {
      q: 'Which sentence uses the present perfect correctly?',
      options: [
        'I have went to London last year.',
        'I have been to London.',
        'I was to London already.',
        'I been in London before.',
      ],
      answer: 1,
    },
  ],
};

// Score → level mapping: 0-1 correct = beginner, 2 = intermediate, 3 = advanced
function scoreToLevel(score) {
  if (score >= 3) return 'advanced';
  if (score >= 2) return 'intermediate';
  return 'beginner';
}

const LEVEL_LABELS = {
  beginner: { emoji: '🌱', label: 'Beginner', desc: "We'll start from the basics with lots of support." },
  intermediate: { emoji: '📖', label: 'Intermediate', desc: "You know the fundamentals — we'll build on them." },
  advanced: { emoji: '💪', label: 'Advanced', desc: "You're solid — we'll push you toward fluency." },
};

// ── Placement quiz component ─────────────────────────────────────────────────
function PlacementQuiz({ lang, onDone }) {
  const questions = PLACEMENT_QUESTIONS[lang] || PLACEMENT_QUESTIONS['Spanish'];
  const [qIdx, setQIdx] = useState(0);
  const [selected, setSelected] = useState(null);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [done, setDone] = useState(false);
  const finalScore = useRef(0);

  function handleSelect(i) {
    if (answered) return;
    setSelected(i);
    setAnswered(true);
    const correct = i === questions[qIdx].answer;
    if (correct) finalScore.current += 1;
  }

  function handleNext() {
    if (qIdx < questions.length - 1) {
      setQIdx(q => q + 1);
      setSelected(null);
      setAnswered(false);
    } else {
      setDone(true);
    }
  }

  if (done) {
    const level = scoreToLevel(finalScore.current);
    const info = LEVEL_LABELS[level];
    return (
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 14, marginTop: 8 }}>
        <div style={{ background: 'var(--card)', border: '1.5px solid var(--border)', borderRadius: 16, padding: '20px', textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>{info.emoji}</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>{info.label}</div>
          <div style={{ fontSize: '.82rem', color: 'var(--muted)', lineHeight: 1.6 }}>{info.desc}</div>
          <div style={{ marginTop: 10, fontSize: '.75rem', color: 'var(--muted)' }}>
            {finalScore.current}/{questions.length} correct
          </div>
        </div>
        <button className="welcome-new-cta" onClick={() => onDone(level)}>
          Looks good →
        </button>
        <button
          onClick={() => onDone('beginner')}
          style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '.78rem', cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}
        >
          Start from beginner instead
        </button>
      </div>
    );
  }

  const q = questions[qIdx];
  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
      <div style={{ fontSize: '.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--muted)' }}>
        Question {qIdx + 1} of {questions.length}
      </div>
      <div style={{ fontSize: '.95rem', fontWeight: 600, color: 'var(--ink)', lineHeight: 1.5 }}>{q.q}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {q.options.map((opt, i) => {
          let bg = 'var(--card)';
          let border = 'var(--border)';
          let color = 'var(--ink)';
          if (answered) {
            if (i === q.answer) { bg = '#e8f5e9'; border = '#4caf50'; color = '#2e7d32'; }
            else if (i === selected && i !== q.answer) { bg = '#fce8e8'; border = '#ef4444'; color = '#c62828'; }
          } else if (selected === i) {
            border = 'var(--accent)';
          }
          return (
            <button
              key={i}
              onClick={() => handleSelect(i)}
              style={{
                background: bg, border: `1.5px solid ${border}`, borderRadius: 12,
                padding: '11px 14px', textAlign: 'left', fontSize: '.85rem', fontWeight: 500,
                color, cursor: answered ? 'default' : 'pointer',
                fontFamily: "'DM Sans',sans-serif", transition: 'all .15s',
              }}
            >
              {opt}
            </button>
          );
        })}
      </div>
      {answered && (
        <button className="welcome-new-cta" onClick={handleNext} style={{ marginTop: 4 }}>
          {qIdx < questions.length - 1 ? 'Next question →' : 'See my level →'}
        </button>
      )}
    </div>
  );
}

// ── Steps config ─────────────────────────────────────────────────────────────
// step 0: native lang
// step 1: target lang
// step 2: dialect
// step 3: auth wall
// step 4: name
// step 5: placement quiz  ← NEW
// step 6: daily goal

const STEPS = [
  { label: 'Step 1 of 6', question: "What's your native language?", sub: 'So we know how to explain things to you' },
  { label: 'Step 2 of 6', question: 'What do you want to learn?', sub: 'Pick the language you want to speak' },
  { label: 'Step 3 of 6', question: 'Pick your dialect', sub: 'Each dialect has its own voice, slang, and culture' },
  { label: '', question: 'Save your progress', sub: 'Create a free account to keep your streak and vocab' },
  { label: 'Step 4 of 6', question: "What's your name?", sub: "We'll use this to personalise your experience" },
  { label: 'Step 5 of 6', question: 'Quick placement check', sub: "3 questions so Perin knows where to start you" },
  { label: 'Step 6 of 6', question: "What's your daily goal?", sub: 'You can change this anytime' },
];

export default function Onboarding() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [native, setNative] = useState('English');
  const [lang, setLang] = useState('');
  const [dialect, setDialect] = useState('');
  const [name, setName] = useState('');
  const [goal, setGoal] = useState(30);
  const [level, setLevel] = useState('beginner');
  const nameInputRef = useRef(null);

  const isLoggedIn = !!state.currentUser?.access_token;

  // Auto-advance past auth step when user logs in
  useEffect(() => {
    if (isLoggedIn && step === 3) setStep(4);
  }, [isLoggedIn]);

  // Focus name input when reaching that step
  useEffect(() => {
    if (step === 4) setTimeout(() => nameInputRef.current?.focus(), 120);
  }, [step]);

  function handleNext() {
    if (step === 0 && !native) return;
    if (step === 1 && !lang) return;
    if (step === 2 && !dialect) return;
    if (step === 4 && !name.trim()) return;

    if (step < 6) {
      if (step === 2 && isLoggedIn) { setStep(4); return; }
      setStep(s => s + 1);
      return;
    }

    // step 6 — finish
    finish();
  }

  function finish() {
    const newLang = {
      lang, dialect: dialect || lang,
      flag: OB_DIALECTS[lang]?.find(d => d.dialect === dialect)?.flag || TARGET_LANGS.find(l => l.lang === lang)?.flag || '🌍',
      level,
      xp: 0, sessions: 0, history: [],
      dailyGoal: goal,
    };
    const newProfile = { native, name: name.trim() };
    dispatch({ type: 'SET_PROFILE', payload: newProfile });
    dispatch({ type: 'SET_LANGUAGES', payload: [newLang] });
    dispatch({ type: 'SET_ACTIVE_LANG', payload: newLang });
    try {
      const existing = JSON.parse(localStorage.getItem('perin_profile') || '{}');
      localStorage.setItem('perin_profile', JSON.stringify({ ...existing, ...newProfile }));
      localStorage.setItem('perin_languages', JSON.stringify([newLang]));
    } catch { /* silent */ }
    navigate('/dashboard');
  }

  function handleBack() {
    if (step === 0) {
      navigate(-1);
    } else if (step === 6 && isLoggedIn) {
      setStep(5);
    } else if (step === 5 && isLoggedIn) {
      setStep(4);
    } else if (step === 4 && isLoggedIn) {
      setStep(2);
    } else {
      setStep(s => s - 1);
    }
  }

  const dialects = OB_DIALECTS[lang] || [];
  const s = STEPS[step];

  const canContinue = step === 0 ? !!native
    : step === 1 ? !!lang
    : step === 2 ? !!dialect
    : step === 3 ? false
    : step === 4 ? !!name.trim()
    : step === 5 ? false   // quiz handles its own advance
    : true;

  return (
    <div className="screen active center-screen" id="screen-onboarding">
      <div className="onboard-new">

        <button
          onClick={handleBack}
          style={{
            alignSelf: 'flex-start',
            background: 'none', border: 'none',
            fontSize: '1rem', color: 'var(--muted)',
            cursor: 'pointer', padding: '0 0 8px 0',
            fontFamily: "'DM Sans',sans-serif",
          }}
        >
          ← Back
        </button>

        {s.label && <div className="onboard-step-label">{s.label}</div>}
        <div className="onboard-question" style={{ color: step === 3 ? 'var(--ink)' : undefined }}>{s.question}</div>
        <div className="onboard-sub">{s.sub}</div>

        {/* Step 0 — native language */}
        {step === 0 && (
          <div className="ob-lang-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            {NATIVE_LANGS.map(n => (
              <button key={n.native} className={`ob-lang-btn ob-native-btn${native === n.native ? ' selected' : ''}`} onClick={() => setNative(n.native)}>
                <span>{n.flag}</span>{n.label}
              </button>
            ))}
          </div>
        )}

        {/* Step 1 — target language */}
        {step === 1 && (
          <div className="ob-lang-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            {TARGET_LANGS.map(l => (
              <button key={l.lang} className={`ob-lang-btn${lang === l.lang ? ' selected' : ''}`} onClick={() => { setLang(l.lang); setDialect(''); }}>
                <span>{l.flag}</span>{l.label}
              </button>
            ))}
          </div>
        )}

        {/* Step 2 — dialect */}
        {step === 2 && (
          <div className="ob-lang-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            {dialects.map(d => (
              <button key={d.dialect} className={`ob-lang-btn${dialect === d.dialect ? ' selected' : ''}`} onClick={() => setDialect(d.dialect)}>
                <span>{d.flag}</span>{d.label}
              </button>
            ))}
          </div>
        )}

        {/* Step 3 — auth wall */}
        {step === 3 && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
            <div style={{ background: 'var(--card)', border: '1.5px solid var(--border)', borderRadius: '14px', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                ['🔥', 'Keep your streak alive'],
                ['💾', 'Save vocab across devices'],
                ['📊', 'Track your progress'],
              ].map(([icon, text]) => (
                <div key={text} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '.88rem', color: 'var(--ink)' }}>
                  <span>{icon}</span><span>{text}</span>
                </div>
              ))}
            </div>
            <button className="welcome-new-cta" onClick={() => showAuthModal()} style={{ marginTop: '4px' }}>
              Create free account →
            </button>
          </div>
        )}

        {/* Step 4 — name */}
        {step === 4 && (
          <div style={{ width: '100%', marginTop: '8px' }}>
            <input
              ref={nameInputRef}
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && name.trim()) handleNext(); }}
              placeholder="Your first name"
              maxLength={30}
              style={{
                width: '100%', padding: '14px 16px', fontSize: '1.1rem',
                border: '2px solid var(--border)', borderRadius: '12px',
                fontFamily: "'DM Sans',sans-serif", background: 'var(--card)',
                color: 'var(--ink)', outline: 'none', boxSizing: 'border-box',
                transition: 'border-color .2s',
              }}
              onFocus={e => e.target.style.borderColor = 'var(--accent)'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'}
            />
          </div>
        )}

        {/* Step 5 — placement quiz */}
        {step === 5 && (
          <PlacementQuiz
            lang={lang}
            onDone={(detectedLevel) => {
              setLevel(detectedLevel);
              setStep(6);
            }}
          />
        )}

        {/* Step 6 — daily goal */}
        {step === 6 && (
          <div className="ob-goal-grid">
            {GOALS.map(g => (
              <button key={g.minutes} className={`ob-goal-btn${goal === g.minutes ? ' selected' : ''}`} onClick={() => setGoal(g.minutes)}>
                {g.label}
              </button>
            ))}
          </div>
        )}

        {/* Continue button — hidden on quiz step (it handles its own flow) */}
        {step !== 3 && step !== 5 && (
          <button
            className="welcome-new-cta"
            style={{ marginTop: '24px' }}
            onClick={handleNext}
            disabled={!canContinue}
          >
            {step === 6 ? "Let's go" : 'Continue'}
          </button>
        )}
      </div>
    </div>
  );
}
