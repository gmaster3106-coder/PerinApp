import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { useTTS } from '../hooks/useTTS.js';
import { getValidToken } from '../utils/getValidToken.js';
import { getLangCode } from '../utils/langUtils.js';

const WORKER_URL = 'https://perin-proxy.gmaster3106.workers.dev';

function getSavedVocab(lang) {
  try {
    const all = JSON.parse(localStorage.getItem('perin_vocab') || '[]');
    return all.filter(v => !v.lang || v.lang === lang).slice(-10).map(v => v.word);
  } catch { return []; }
}

function normalize(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/[¿¡.,!?;:"""'']/g, '')
    .trim();
}

function score(typed, expected) {
  const t = normalize(typed).split(/\s+/);
  const e = normalize(expected).split(/\s+/);
  const matches = t.filter(w => e.includes(w)).length;
  return e.length > 0 ? matches / e.length : 0;
}

export default function ListeningMode() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const { speak, getVoiceId } = useTTS();

  const languages  = state.languages || [];
  const activeLang = state.activeLang?.lang ? state.activeLang : languages[0];
  const lang       = activeLang?.lang    || 'Spanish';
  const dialect    = activeLang?.dialect || lang;
  const voiceIdRef  = useRef(getVoiceId(dialect, lang, '', localStorage.getItem('perin_voice_gender_pref') || null));
  const voiceId     = voiceIdRef.current;
  const langCode   = getLangCode(lang, dialect);

  const [phase, setPhase]         = useState('loading'); // loading | question | score | error
  const [questions, setQuestions] = useState([]);
  const [index, setIndex]         = useState(0);
  const [listenScore, setListenScore] = useState(0);
  const [answered, setAnswered]   = useState(false);
  const [typed, setTyped]         = useState('');
  const [feedback, setFeedback]   = useState(null); // { correct, sentence, translation }
  const [playing, setPlaying]     = useState(false);

  const inputRef = useRef(null);

  const generate = useCallback(async () => {
    setPhase('loading');
    setQuestions([]);
    setIndex(0);
    setListenScore(0);
    setAnswered(false);
    setTyped('');
    setFeedback(null);

    const vocabWords = getSavedVocab(lang);
    const vocabHint = vocabWords.length
      ? ` Include sentences using these saved words when natural: ${vocabWords.join(', ')}.`
      : '';

    const prompt = `Generate 8 listening comprehension sentences for a ${dialect} ${lang} learner. Short, clear sentences (4-8 words). Mix easy and medium difficulty. Use authentic ${dialect} vocabulary and everyday situations. Return ONLY raw JSON:
{"questions":[{"sentence":"¿Cómo te llamas tú?","translation":"What is your name?"},{"sentence":"Me gusta mucho el café.","translation":"I really like coffee."}]}${vocabHint}`;

    try {
      const token = await getValidToken();
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${WORKER_URL}/api/chat`, {
        method: 'POST', headers,
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1000,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      const data = await res.json();
      const text = data.content?.[0]?.text || '';
      const m = text.match(/\{[\s\S]*\}/);
      if (!m) { setPhase('error'); return; }
      const qs = JSON.parse(m[0]).questions || [];
      if (!qs.length) { setPhase('error'); return; }
      setQuestions(qs);
      setPhase('question');
    } catch {
      setPhase('error');
    }
  }, [lang, dialect]);

  useEffect(() => { generate(); }, []);

  // Auto-play on new question
  useEffect(() => {
    if (phase === 'question' && questions[index]) {
      const t = setTimeout(() => playQuestion(), 500);
      return () => clearTimeout(t);
    }
  }, [index, phase, questions]);

  // Focus input when question loads
  useEffect(() => {
    if (phase === 'question' && !answered) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [index, phase, answered]);

  async function playQuestion() {
    const q = questions[index];
    if (!q || !voiceId) return;
    setPlaying(true);
    try {
      const token = await getValidToken();
      await speak({ text: q.sentence, voiceId, lang: langCode, accessToken: token });
    } finally {
      setPlaying(false);
    }
  }

  function check() {
    if (answered || !typed.trim()) return;
    const q = questions[index];
    const pct = score(typed, q.sentence);
    const isCorrect = pct >= 0.8;
    setAnswered(true);
    if (isCorrect) setListenScore(s => s + 1);
    setFeedback({ correct: isCorrect, sentence: q.sentence, translation: q.translation, pct });
  }

  function next() {
    const nextIdx = index + 1;
    if (nextIdx >= questions.length) {
      // Final score
      const finalScore = listenScore + (feedback?.correct ? 0 : 0); // already updated via state
      const xp = listenScore * 10;
      dispatch({ type: 'AWARD_XP', payload: xp });
      setPhase('score');
    } else {
      setIndex(nextIdx);
      setAnswered(false);
      setTyped('');
      setFeedback(null);
      setSpeed('clear');
    }
  }

  // ── Loading ──
  if (phase === 'loading') return (
    <div className="screen active" style={{ alignItems: 'center', padding: '28px 16px 60px' }}>
      <div className="fib-wrap">
        <Header />
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--muted)', fontSize: '.88rem' }}>
          <div style={{ marginBottom: 14 }}>Preparing your listening exercise…</div>
          <span className="fib-loading-dot" style={{ display: 'inline-block' }} />
          <span className="fib-loading-dot" style={{ display: 'inline-block', animationDelay: '.2s' }} />
          <span className="fib-loading-dot" style={{ display: 'inline-block', animationDelay: '.4s' }} />
        </div>
      </div>
    </div>
  );

  // ── Error ──
  if (phase === 'error') return (
    <div className="screen active" style={{ alignItems: 'center', padding: '28px 16px 60px' }}>
      <div className="fib-wrap">
        <Header />
        <div style={{ textAlign: 'center', padding: '32px 16px' }}>
          <p style={{ color: 'var(--danger)', marginBottom: 8, fontWeight: 600 }}>⚠️ Couldn't load questions</p>
          <p style={{ color: 'var(--muted)', fontSize: '.82rem', marginBottom: 20 }}>Check your connection and try again.</p>
          <button className="fib-next-btn" onClick={generate}>Try Again</button>
        </div>
      </div>
    </div>
  );

  // ── Score ──
  if (phase === 'score') {
    const total = questions.length;
    const pct   = Math.round(listenScore / total * 100);
    const xp    = listenScore * 10;
    return (
      <div className="screen active" style={{ alignItems: 'center', padding: '28px 16px 60px' }}>
        <div className="fib-wrap">
          <Header />
          <div className="fib-score-card">
            <p style={{ fontSize: '.72rem', textTransform: 'uppercase', letterSpacing: '.1em', color: 'rgba(255,255,255,.5)', marginBottom: 8 }}>
              🎧 Listening
            </p>
            <div className="fib-score-big">
              {listenScore}<span style={{ fontSize: '1.4rem', color: 'rgba(255,255,255,.5)' }}>/{total}</span>
            </div>
            <p>{pct}% correct · +{xp} XP</p>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button className="fib-next-btn" onClick={generate} style={{ flex: 1 }}>Try Again 🔄</button>
            <button className="fib-next-btn" onClick={() => navigate('/dashboard')}
              style={{ flex: 1, background: 'var(--card)', color: 'var(--ink)', border: '1.5px solid var(--border)' }}>
              Dashboard
            </button>
          </div>
          <div style={{ marginTop: 12, textAlign: 'center' }}>
            <p style={{ fontSize: '.75rem', color: 'var(--muted)', marginBottom: 8 }}>Now try speaking those sentences</p>
            <button onClick={() => navigate('/scenarios')}
              style={{ background: 'none', border: '1.5px solid var(--border)', borderRadius: 10, padding: '8px 16px', fontFamily: "'DM Sans',sans-serif", fontSize: '.8rem', color: 'var(--ink)', cursor: 'pointer', width: '100%' }}>
              💬 Start a Conversation →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Question ──
  const q     = questions[index];
  const total = questions.length;

  return (
    <div className="screen active" style={{ alignItems: 'center', padding: '28px 16px 60px' }}>
      <div className="fib-wrap">
        <Header />
        <div className="fib-card">

          {/* Progress dots */}
          <div className="fib-progress">
            {questions.map((_, i) => (
              <div key={i} className={`fib-progress-dot${i < index ? ' done' : ''}`} />
            ))}
          </div>

          <div className="fib-counter">🎧 Listen and type · {index + 1} of {total}</div>

          {/* Play button */}
          <div style={{ textAlign: 'center', padding: '28px 0 20px' }}>
            <button
              onClick={() => playQuestion()}
              style={{ width: 72, height: 72, borderRadius: '50%', background: playing ? '#ff6b00' : 'var(--accent)', border: 'none', cursor: 'pointer', fontSize: '1.8rem', color: '#fff', boxShadow: '0 4px 16px rgba(26,86,219,.35)', transition: 'all .2s' }}
            >
              {playing ? '⏵' : '🔊'}
            </button>
            <p style={{ fontSize: '.78rem', color: 'var(--muted)', marginTop: 10 }}>Tap to hear the sentence</p>


          </div>

          {/* Input */}
          <div className="fib-type-area">
            <input
              ref={inputRef}
              className={`fib-type-input${feedback ? (feedback.correct ? ' correct' : ' wrong') : ''}`}
              type="text"
              placeholder="Type what you heard…"
              style={{ fontSize: 16 }}
              autoComplete="off"
              value={typed}
              onChange={e => setTyped(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') check(); }}
              disabled={answered}
            />
            <button className="fib-submit-btn" onClick={check} disabled={answered}>Check</button>
          </div>

          {/* Feedback */}
          {feedback && (
            <div className={`fib-feedback ${feedback.correct ? 'correct' : 'wrong'}`}>
              {feedback.correct
                ? <>✅ {feedback.pct === 1 ? 'Perfect!' : 'Close enough!'} <strong>{feedback.sentence}</strong> = {feedback.translation}</>
                : <>❌ It was: <strong>{feedback.sentence}</strong> = {feedback.translation}</>
              }
            </div>
          )}

          {answered && (
            <button className="fib-next-btn" onClick={next} style={{ marginTop: 10 }}>
              {index + 1 < total ? 'Next →' : 'See Results 🎉'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Header() {
  return (
    <div style={{ marginBottom: 18 }}>
      <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: '1.45rem', marginBottom: 5 }}>
        🎧 Listen & Respond
      </h2>
      <p style={{ color: 'var(--muted)', fontSize: '.85rem' }}>
        Hear it. Type what you heard. Trains your ear for real-speed speech.
      </p>
    </div>
  );
}
