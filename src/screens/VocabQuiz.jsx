import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { QUIZ_DATA } from '../data/quizData.js';

// ─── dialect → quiz key resolver ────────────────────────────────────────────
const DIALECT_MAP = {
  'dominican republic': 'Dominican Republic', 'dominican': 'Dominican Republic',
  'puerto rico': 'Puerto Rico', 'puerto rican': 'Puerto Rico',
  'mexican': 'Mexico', 'mexico': 'Mexico',
  'colombian': 'Colombia', 'colombia': 'Colombia',
  'castilian': 'Castilian', 'madrileño': 'Castilian', 'spain': 'Castilian', 'madrid': 'Castilian',
  'parisian': 'Parisian', 'paris': 'Parisian', 'france': 'Parisian',
  'southern french': 'Southern French', 'marseille': 'Southern French',
  'neapolitan': 'Neapolitan', 'naples': 'Neapolitan',
  'sicilian': 'Sicilian', 'sicily': 'Sicilian',
  'italian': 'Italy', 'italy': 'Italy',
  'european portuguese': 'European Portuguese', 'portugal': 'European Portuguese',
  'brazilian': 'Brazil', 'brazil': 'Brazil',
  'haitian creole': 'Haiti', 'haiti': 'Haiti', 'creole': 'Haiti',
  'american english': 'American English', 'english': 'American English',
};

function resolveQuizKey(lang, dialect) {
  const d = (dialect || '').toLowerCase();
  const l = (lang || '').toLowerCase();
  for (const [key, val] of Object.entries(DIALECT_MAP)) {
    if (d === key || d.includes(key) || key.includes(d)) {
      if (QUIZ_DATA[val]) return val;
    }
  }
  // Fallback: try lang
  for (const [key, val] of Object.entries(DIALECT_MAP)) {
    if (l === key || l.includes(key)) {
      if (QUIZ_DATA[val]) return val;
    }
  }
  return null;
}

function getDailyLabel() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

function getDailyQuestions(quizKey) {
  const all = QUIZ_DATA[quizKey]?.questions || [];
  const storageKey = `perin_quiz_deck_${quizKey}`;
  let deck = [];
  try { deck = JSON.parse(localStorage.getItem(storageKey) || '[]'); } catch { localStorage.removeItem(storageKey); }

  if (deck.length < 10) {
    const shuffled = [...Array(all.length).keys()].sort(() => Math.random() - 0.5);
    deck = [...new Set([...deck, ...shuffled])];
    if (deck.length < 10) deck = [...Array(all.length).keys()].sort(() => Math.random() - 0.5);
    localStorage.setItem(storageKey, JSON.stringify(deck));
  }

  const indices = deck.slice(0, 10);
  localStorage.setItem(storageKey, JSON.stringify(deck.slice(10)));
  return indices.map(i => all[i % all.length]);
}

function pct(score, total) { return total ? Math.round((score / total) * 100) : 0; }
function stars(p) { const f = Math.round(p / 20); return '⭐'.repeat(f) + '☆'.repeat(5 - f); }
function badge(p) {
  if (p === 100) return '🏆 Perfect Score!';
  if (p >= 80)  return '🌟 Culture Expert';
  if (p >= 60)  return '📚 Getting There';
  return '🌱 Keep Learning';
}

// ─── main component ──────────────────────────────────────────────────────────
export default function VocabQuiz() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();

  const languages = state.languages || [];
  const activeLang = state.activeLang?.lang ? state.activeLang : languages[0];
  const lang    = activeLang?.lang    || '';
  const dialect = activeLang?.dialect || lang;

  const quizKey = resolveQuizKey(lang, dialect);
  const data    = quizKey ? QUIZ_DATA[quizKey] : null;

  // phase: 'question' | 'score' | 'no-quiz' | 'no-lang'
  const [phase, setPhase]         = useState('question');
  const [questions, setQuestions] = useState([]);
  const [index, setIndex]         = useState(0);
  const [score, setScore]         = useState(0);
  const [answered, setAnswered]   = useState(false);
  const [chosen, setChosen]       = useState(null);
  const [showExp, setShowExp]     = useState(false);

  useEffect(() => {
    if (!lang) { setPhase('no-lang'); return; }
    if (!quizKey || !data) { setPhase('no-quiz'); return; }
    const qs = getDailyQuestions(quizKey);
    setQuestions(qs);
    setIndex(0);
    setScore(0);
    setAnswered(false);
    setChosen(null);
    setShowExp(false);
    setPhase('question');
  }, [quizKey]);

  function handleAnswer(i) {
    if (answered) return;
    setAnswered(true);
    setChosen(i);
    setShowExp(true);
    if (i === questions[index].answer) setScore(s => s + 1);
  }

  function handleNext() {
    const next = index + 1;
    if (next >= questions.length) {
      const finalScore = chosen === questions[index].answer ? score : score;
      const xp = Math.round(finalScore * 3);
      dispatch({ type: 'AWARD_XP', payload: xp });
      // Mark daily mission done
      localStorage.setItem('perin_mission_done_' + new Date().toDateString(), '1');
      setPhase('score');
    } else {
      setIndex(next);
      setAnswered(false);
      setChosen(null);
      setShowExp(false);
    }
  }

  function restart() {
    const qs = getDailyQuestions(quizKey);
    setQuestions(qs);
    setIndex(0);
    setScore(0);
    setAnswered(false);
    setChosen(null);
    setShowExp(false);
    setPhase('question');
  }

  // ── No language ──
  if (phase === 'no-lang') return (
    <div className="screen active" id="screen-vocab-quiz" style={{ alignItems: 'center' }}>
      <div style={{ textAlign: 'center', padding: '48px 20px' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🌍</div>
        <p style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 8 }}>Add a language first</p>
        <p style={{ color: 'var(--muted)', fontSize: '.84rem', marginBottom: 24 }}>Go to the Dashboard and add a language to unlock the Culture Quiz.</p>
        <button className="quiz-next-btn" onClick={() => navigate('/dashboard')}>Go to Dashboard</button>
      </div>
    </div>
  );

  // ── No quiz for this dialect ──
  if (phase === 'no-quiz') return (
    <div className="screen active" id="screen-vocab-quiz" style={{ alignItems: 'center' }}>
      <div style={{ textAlign: 'center', padding: '48px 20px' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>{activeLang?.flag || '🌍'}</div>
        <p style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 8 }}>No quiz yet for {dialect !== lang ? dialect : lang}</p>
        <p style={{ color: 'var(--muted)', fontSize: '.83rem', marginBottom: 24, lineHeight: 1.6 }}>
          We're adding more culture quizzes all the time.<br />Check back soon!
        </p>
        <button className="quiz-next-btn" onClick={() => navigate('/dashboard')}>Back to Dashboard</button>
      </div>
    </div>
  );

  // ── Score screen ──
  if (phase === 'score') {
    const p = pct(score, questions.length);
    const xp = Math.round(score * 3);
    return (
      <div className="screen active" id="screen-vocab-quiz" style={{ alignItems: 'center', padding: '28px 16px 60px' }}>
        <div className="quiz-wrap">
          <div className="quiz-score-card">
            <div style={{ fontSize: '.72rem', textTransform: 'uppercase', letterSpacing: '.1em', color: 'rgba(255,255,255,.5)', marginBottom: 8 }}>
              📅 {getDailyLabel()}
            </div>
            <h3>{data.flag} {quizKey} Culture Quiz</h3>
            <div className="score-big" style={{ fontSize: '3rem', fontWeight: 700, color: 'var(--gold)', margin: '10px 0' }}>
              {score}<span style={{ fontSize: '1.4rem', color: 'rgba(255,255,255,.5)' }}>/{questions.length}</span>
            </div>
            <p>{p}% correct</p>
            <div style={{ fontSize: '1.3rem', margin: '8px 0' }}>{stars(p)}</div>
            <div className="quiz-score-badge">{badge(p)}</div>
            <div className="quiz-score-badge" style={{ marginTop: 8, background: 'var(--gold)', color: '#0a1a3a' }}>+{xp} XP</div>
            <p style={{ fontSize: '.72rem', color: 'rgba(255,255,255,.4)', marginTop: 12 }}>New questions tomorrow ✨</p>
          </div>
          <button className="quiz-next-btn" style={{ marginTop: 14 }} onClick={restart}>Try Again 🔄</button>
          <button className="quiz-next-btn" style={{ marginTop: 8, background: 'var(--card)', color: 'var(--ink)', border: '1.5px solid var(--border)' }} onClick={() => navigate('/dashboard')}>
            Dashboard
          </button>
        </div>
      </div>
    );
  }

  // ── Question screen ──
  if (!questions.length) return null;
  const q = questions[index];
  const progress = (index / questions.length) * 100;

  return (
    <div className="screen active" id="screen-vocab-quiz" style={{ alignItems: 'center', padding: '28px 16px 60px' }}>
      <div className="quiz-wrap">

        {/* Header */}
        <div style={{ marginBottom: 16 }}>
          <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: '1.45rem', marginBottom: 4 }}>
            🧠 Culture Quiz
          </h2>
          <p style={{ color: 'var(--muted)', fontSize: '.85rem' }}>
            {data.questions.length} questions about food, slang, music & culture.
          </p>
        </div>

        {/* Date + dialect row */}
        <div style={{ fontSize: '.73rem', color: 'var(--muted)', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>📅 {getDailyLabel()}</span>
          <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{data.flag} {quizKey}</span>
        </div>

        {/* Card */}
        <div className="quiz-card">
          <div className="quiz-meta">
            <span className="quiz-counter">Question {index + 1} of {questions.length}</span>
            <div className="quiz-progress-bar">
              <div className="quiz-progress-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>

          <div className="quiz-category">{q.cat}</div>
          <div className="quiz-question">{q.q}</div>

          <div className="quiz-options">
            {q.options.map((opt, i) => {
              let cls = 'quiz-option';
              if (answered) {
                cls += ' disabled';
                if (i === q.answer) cls += ' correct';
                else if (i === chosen) cls += ' wrong';
              }
              return (
                <button key={i} className={cls} onClick={() => handleAnswer(i)}>
                  {opt}
                </button>
              );
            })}
          </div>

          {/* Explanation */}
          {showExp && (
            <div className="quiz-explanation">
              <span className="exp-icon">{chosen === q.answer ? '✅' : '❌'}</span>
              <strong>{chosen === q.answer ? 'Correct!' : `The answer is: ${q.options[q.answer]}`}</strong>
              <br />{q.exp}
            </div>
          )}

          {/* Next button */}
          {answered && (
            <button className="quiz-next-btn" onClick={handleNext}>
              {index + 1 < questions.length ? 'Next Question →' : 'See Results →'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
