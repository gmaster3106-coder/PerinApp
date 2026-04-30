import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
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

const STEPS = [
  { label: 'Step 1 of 4', question: "What's your native language?", sub: 'So we know how to explain things to you' },
  { label: 'Step 2 of 4', question: 'What do you want to learn?', sub: 'Pick the language you want to speak' },
  { label: 'Step 3 of 4', question: 'Pick your dialect', sub: 'Each dialect has its own voice, slang, and culture' },
  { label: 'Step 4 of 4', question: "What's your daily goal?", sub: 'You can change this anytime' },
];

export default function Onboarding() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [native, setNative] = useState('English');
  const [lang, setLang] = useState('');
  const [dialect, setDialect] = useState('');
  const [goal, setGoal] = useState(30);

  function handleNext() {
    if (step === 0 && !native) return;
    if (step === 1 && !lang) return;
    if (step === 2 && !dialect) return;

    if (step < 3) {
      setStep(s => s + 1);
      return;
    }

    const newLang = {
      lang, dialect: dialect || lang,
      flag: OB_DIALECTS[lang]?.find(d => d.dialect === dialect)?.flag || TARGET_LANGS.find(l => l.lang === lang)?.flag || '🌍',
      level: 'beginner', xp: 0, sessions: 0, history: [],
      dailyGoal: goal,
    };
    dispatch({ type: 'SET_PROFILE', payload: { native } });
    dispatch({ type: 'SET_LANGUAGES', payload: [newLang] });
    dispatch({ type: 'SET_ACTIVE_LANG', payload: newLang });
    navigate('/dashboard');
  }

  const dialects = OB_DIALECTS[lang] || [];
  const s = STEPS[step];
  const canContinue = step === 0 ? !!native : step === 1 ? !!lang : step === 2 ? !!dialect : true;

  return (
    <div className="screen active center-screen" id="screen-onboarding">
      <div className="onboard-new">
        <div className="onboard-step-label">{s.label}</div>
        <div className="onboard-question">{s.question}</div>
        <div className="onboard-sub">{s.sub}</div>

        {step === 0 && (
          <div className="ob-lang-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            {NATIVE_LANGS.map(n => (
              <button
                key={n.native}
                className={`ob-lang-btn ob-native-btn${native === n.native ? ' selected' : ''}`}
                onClick={() => setNative(n.native)}
              >
                <span>{n.flag}</span>{n.label}
              </button>
            ))}
          </div>
        )}

        {step === 1 && (
          <div className="ob-lang-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            {TARGET_LANGS.map(l => (
              <button
                key={l.lang}
                className={`ob-lang-btn${lang === l.lang ? ' selected' : ''}`}
                onClick={() => { setLang(l.lang); setDialect(''); }}
              >
                <span>{l.flag}</span>{l.label}
              </button>
            ))}
          </div>
        )}

        {step === 2 && (
          <div className="ob-lang-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            {dialects.map(d => (
              <button
                key={d.dialect}
                className={`ob-lang-btn${dialect === d.dialect ? ' selected' : ''}`}
                onClick={() => setDialect(d.dialect)}
              >
                <span>{d.flag}</span>{d.label}
              </button>
            ))}
          </div>
        )}

        {step === 3 && (
          <div className="ob-goal-grid">
            {GOALS.map(g => (
              <button
                key={g.minutes}
                className={`ob-goal-btn${goal === g.minutes ? ' selected' : ''}`}
                onClick={() => setGoal(g.minutes)}
              >
                {g.label}
              </button>
            ))}
          </div>
        )}

        <button
          className="welcome-new-cta"
          style={{ marginTop: '24px' }}
          onClick={handleNext}
          disabled={!canContinue}
        >
          {step === 3 ? "Let's go" : 'Continue'}
        </button>
      </div>
    </div>
  );
}