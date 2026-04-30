import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { getValidToken } from '../utils/getValidToken.js';

const WORKER_URL = 'https://perin-proxy.gmaster3106.workers.dev';

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}
function pct(score, total) {
  return total ? Math.round((score / total) * 100) : 0;
}
function badge(p) {
  if (p === 100) return '🏆 Perfect!';
  if (p >= 80)  return '🌟 Great job!';
  if (p >= 60)  return '📚 Getting there!';
  return '🌱 Keep practising!';
}
function stars(p) {
  const filled = Math.round(p / 20);
  return '⭐'.repeat(filled) + '☆'.repeat(5 - filled);
}
function getSavedVocab(lang) {
  try {
    const all = JSON.parse(localStorage.getItem('perin_vocab') || '[]');
    return all.filter(v => !v.lang || v.lang === lang).slice(-15).map(v => v.word);
  } catch { return []; }
}

export default function FillBlank() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();

  const languages  = state.languages || [];
  const activeLang = state.activeLang?.lang ? state.activeLang : languages[0];
  const lang       = activeLang?.lang    || 'Spanish';
  const dialect    = activeLang?.dialect || lang;
  const savedVocab = getSavedVocab(lang);

  const [phase, setPhase]         = useState('loading');
  const [questions, setQuestions] = useState([]);
  const [index, setIndex]         = useState(0);
  const [score, setScore]         = useState(0);
  const [missed, setMissed]       = useState([]);
  const [answered, setAnswered]   = useState(false);
  const [feedback, setFeedback]   = useState(null);
  const [showNext, setShowNext]   = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);
  const [showHint, setShowHint]   = useState(false);
  const [optionStates, setOptionStates] = useState({});
  const [typeValue, setTypeValue] = useState('');
  const [typeState, setTypeState] = useState('');
  const [blankState, setBlankState] = useState('');
  const [blankText, setBlankText]   = useState('___');

  const typeInputRef = useRef(null);

  const generate = useCallback(async () => {
    setPhase('loading');
    setQuestions([]);
    setIndex(0);
    setScore(0);
    setMissed([]);

    const vocabHint = savedVocab.length
      ? ` Include these words when natural: ${savedVocab.join(', ')}.` : '';

    const prompt = `Generate 10 fill-in-the-blank ${lang} sentences. Questions 1-6 type "tap" with 4 options, questions 7-10 type "type". Use ___ for the blank. Return ONLY raw JSON like this example:
{"questions":[{"sentence":"¿___ estás?","blank":"Cómo","translation":"How are you?","type":"tap","options":["Cómo","Qué","Dónde","Cuándo"],"hint":"greeting"},{"sentence":"Tengo ___ hambre.","blank":"mucha","translation":"I am very hungry.","type":"type","hint":"a lot"}]}
Make sentences authentic ${dialect} ${lang} — use vocabulary and situations real ${dialect} speakers encounter.${vocabHint}`;

    try {
      const token = await getValidToken();
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${WORKER_URL}/api/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: 'claude-sonnet-4-5',
          max_tokens: 2000,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error?.message || `API ${res.status}`);

      const text = data.content?.[0]?.text || '';
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('No JSON in response');

      const parsed = JSON.parse(match[0]);
      const qs = parsed.questions || [];
      if (!qs.length) throw new Error('Empty questions array');

      setQuestions(qs.map(q => q.type === 'tap' ? { ...q, options: shuffle(q.options) } : q));
      setPhase('question');
    } catch (err) {
      console.error('FIB ERROR:', err);
      setPhase('error');
    }
  }, [lang, dialect]);

  useEffect(() => { generate(); }, []);

  useEffect(() => {
    if (phase !== 'question') return;
    setAnswered(false);
    setFeedback(null);
    setShowNext(false);
    setShowTranslation(false);
    setShowHint(false);
    setOptionStates({});
    setTypeValue('');
    setTypeState('');
    setBlankState('');
    setBlankText('___');
    if (questions[index]?.type === 'type') {
      setTimeout(() => typeInputRef.current?.focus(), 120);
    }
  }, [index, phase]);

  function handleTap(opt) {
    if (answered) return;
    const q = questions[index];
    const isCorrect = opt.trim().toLowerCase() === q.blank.trim().toLowerCase();
    const newStates = {};
    q.options.forEach(o => {
      newStates[o] = o.trim().toLowerCase() === q.blank.trim().toLowerCase() ? 'reveal' : '';
    });
    newStates[opt] = isCorrect ? 'correct' : 'wrong';
    setOptionStates(newStates);
    setBlankText(q.blank);
    setBlankState(isCorrect ? 'correct' : 'wrong');
    resolveAnswer(isCorrect, q.blank, opt);
  }

  function handleTypeSubmit() {
    if (answered) return;
    const typed = typeValue.trim();
    if (!typed) return;
    const q = questions[index];
    const isCorrect = typed.toLowerCase() === q.blank.toLowerCase();
    setTypeState(isCorrect ? 'correct' : 'wrong');
    setBlankText(q.blank);
    setBlankState(isCorrect ? 'correct' : 'wrong');
    resolveAnswer(isCorrect, q.blank, typed);
  }

  function resolveAnswer(isCorrect, correct, given) {
    setAnswered(true);
    setFeedback({ correct: isCorrect, answer: correct, given });
    setShowNext(true);
    if (isCorrect) setScore(s => s + 1);
    else setMissed(m => [...m, { i: index, sentence: questions[index].sentence, correct, given }]);
  }

  function handleNext() {
    const next = index + 1;
    if (next >= questions.length) {
      dispatch({ type: 'AWARD_XP', payload: score * 8 });
      setPhase('score');
    } else {
      setIndex(next);
    }
  }

  function dotClass(i) {
    if (i < index) return 'fib-progress-dot ' + (missed.some(m => m.i === i) ? 'wrong' : 'correct');
    if (i === index) return 'fib-progress-dot done';
    return 'fib-progress-dot';
  }

  if (phase === 'loading') return <LoadingView />;
  if (phase === 'error')   return <ErrorView onRetry={generate} />;
  if (phase === 'score')   return (
    <ScoreView
      score={score} total={questions.length} missed={missed}
      onNewSet={generate}
      onDashboard={() => navigate('/dashboard')}
      onSentenceBuilder={() => navigate('/sentence-builder')}
    />
  );

  const q = questions[index];
  const total = questions.length;

  return (
    <div className="screen active" id="screen-fill-blank" style={{ alignItems: 'center', padding: '28px 16px 60px' }}>
      <div className="fib-wrap">
        <div style={{ marginBottom: 18 }}>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.45rem', marginBottom: 5 }}>
            ✏️ Fill the Blank
          </h2>
          <p style={{ color: 'var(--muted)', fontSize: '.85rem' }}>
            Complete real sentences in your target language.
          </p>
        </div>

        <div className="fib-card">
          <div className="fib-progress">
            {questions.map((_, i) => <div key={i} className={dotClass(i)} />)}
          </div>

          <div className="fib-counter">
            {q.type === 'tap' ? '👆 Tap the correct word' : '⌨️ Type the answer'} · {index + 1} of {total}
          </div>

          <div className="fib-sentence">
            {q.sentence.split('___')[0]}
            <span className={`fib-blank${blankState ? ' ' + blankState : ''}`}>{blankText}</span>
            {q.sentence.split('___')[1] || ''}
          </div>

          {!showTranslation
            ? <button onClick={() => setShowTranslation(true)} style={{ background: 'none', border: 'none', fontFamily: "'DM Sans',sans-serif", fontSize: '.78rem', color: 'var(--accent)', cursor: 'pointer', padding: '2px 0', marginBottom: 8, textDecoration: 'underline' }}>
                See translation
              </button>
            : <div className="fib-translation">{q.translation}</div>
          }

          {q.type === 'tap' ? (
            <div className="fib-options">
              {q.options.map(opt => (
                <button
                  key={opt}
                  className={`fib-option${optionStates[opt] ? ' ' + optionStates[opt] : ''}`}
                  disabled={answered}
                  onClick={() => handleTap(opt)}
                >{opt}</button>
              ))}
            </div>
          ) : (
            <div className="fib-type-area">
              <input
                ref={typeInputRef}
                className={`fib-type-input${typeState ? ' ' + typeState : ''}`}
                type="text"
                placeholder="Type your answer…"
                style={{ fontSize: 16 }}
                autoComplete="off"
                value={typeValue}
                onChange={e => setTypeValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleTypeSubmit(); }}
                disabled={answered}
              />
              <button className="fib-submit-btn" onClick={handleTypeSubmit} disabled={answered}>Check</button>
            </div>
          )}

          {q.hint && (!showHint
            ? <button onClick={() => setShowHint(true)} style={{ background: 'none', border: 'none', fontFamily: "'DM Sans',sans-serif", fontSize: '.75rem', color: 'var(--accent)', cursor: 'pointer', padding: '4px 0', marginTop: 4, textDecoration: 'underline' }}>
                Show hint
              </button>
            : <div style={{ fontSize: '.75rem', color: 'var(--muted)', marginTop: 4 }}>{q.hint}</div>
          )}

          {feedback && (
            <div className={`fib-feedback ${feedback.correct ? 'correct' : 'wrong'}`}>
              {feedback.correct
                ? <>✅ Correct! <strong>{feedback.answer}</strong></>
                : <>❌ The answer is <strong>{feedback.answer}</strong>{feedback.given ? ` — you wrote "${feedback.given}"` : ''}</>
              }
            </div>
          )}

          {showNext && (
            <button className="fib-next-btn" onClick={handleNext}>
              {index + 1 < total ? 'Next →' : 'See Results 🎉'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function LoadingView() {
  return (
    <div className="screen active" style={{ alignItems: 'center', padding: '28px 16px 60px' }}>
      <div className="fib-wrap">
        <div style={{ marginBottom: 18 }}>
          <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: '1.45rem', marginBottom: 5 }}>✏️ Fill the Blank</h2>
          <p style={{ color: 'var(--muted)', fontSize: '.85rem' }}>Complete real sentences in your target language.</p>
        </div>
        <div className="fib-loading">
          <p style={{ marginBottom: 18, fontSize: '.9rem' }}>Generating sentences for you…</p>
          <div>
            <span className="fib-loading-dot" />
            <span className="fib-loading-dot" />
            <span className="fib-loading-dot" />
          </div>
        </div>
      </div>
    </div>
  );
}

function ErrorView({ onRetry }) {
  return (
    <div className="screen active" style={{ alignItems: 'center', padding: '28px 16px 60px' }}>
      <div className="fib-wrap">
        <div style={{ textAlign: 'center', padding: '32px 16px' }}>
          <p style={{ color: 'var(--danger)', marginBottom: 8, fontWeight: 600 }}>⚠️ Couldn't load questions</p>
          <p style={{ color: 'var(--muted)', fontSize: '.82rem', marginBottom: 20 }}>Check your connection and try again.</p>
          <button className="fib-next-btn" onClick={onRetry}>Try Again</button>
        </div>
      </div>
    </div>
  );
}

function ScoreView({ score, total, missed, onNewSet, onDashboard, onSentenceBuilder }) {
  const p  = pct(score, total);
  const xp = score * 8;
  return (
    <div className="screen active" style={{ alignItems: 'center', padding: '28px 16px 60px' }}>
      <div className="fib-wrap">
        <div className="fib-score-card">
          <p style={{ fontSize: '.72rem', textTransform: 'uppercase', letterSpacing: '.1em', color: 'rgba(255,255,255,.5)', marginBottom: 8 }}>
            ✏️ Fill the Blank
          </p>
          <div className="fib-score-big">
            {score}<span style={{ fontSize: '1.4rem', color: 'rgba(255,255,255,.5)' }}>/{total}</span>
          </div>
          <p>{p}% correct</p>
          <div style={{ fontSize: '1.3rem', margin: '8px 0' }}>{stars(p)}</div>
          <div className="quiz-score-badge">{badge(p)}</div>
          <p style={{ fontSize: '.72rem', color: 'rgba(255,255,255,.4)', marginTop: 12 }}>+{xp} XP earned</p>

          {missed.length > 0 && (
            <div style={{ marginTop: 20, textAlign: 'left' }}>
              <p style={{ fontSize: '.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'rgba(255,255,255,.5)', marginBottom: 10 }}>
                Review — what you missed
              </p>
              {missed.map((m, i) => (
                <div key={i} className="fib-missed">
                  <div className="fib-missed-sentence">{m.sentence.replace('___', `[${m.correct}]`)}</div>
                  <div className="fib-missed-answer">Answer: {m.correct}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button className="fib-next-btn" onClick={onNewSet} style={{ flex: 1 }}>New Set 🔄</button>
          <button className="fib-next-btn" onClick={onDashboard}
            style={{ flex: 1, background: 'var(--card)', color: 'var(--ink)', border: '1.5px solid var(--border)' }}>
            Dashboard
          </button>
        </div>

        <div style={{ marginTop: 12, textAlign: 'center' }}>
          <p style={{ fontSize: '.75rem', color: 'var(--muted)', marginBottom: 8 }}>
            Now try these words in a different format
          </p>
          <button onClick={onSentenceBuilder}
            style={{ background: 'none', border: '1.5px solid var(--border)', borderRadius: 10, padding: '8px 16px', fontFamily: "'DM Sans',sans-serif", fontSize: '.8rem', color: 'var(--ink)', cursor: 'pointer', width: '100%' }}>
            🧩 Try Sentence Builder →
          </button>
        </div>
      </div>
    </div>
  );
}
