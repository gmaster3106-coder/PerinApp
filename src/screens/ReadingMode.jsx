import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { getValidToken } from '../utils/getValidToken.js';

const WORKER_URL = 'https://perin-proxy.gmaster3106.workers.dev';

const TOPICS = [
  'ordering food at a local restaurant',
  'taking public transport',
  'asking for directions',
  'shopping at a market',
  'making a phone call',
  'a neighborhood dispute',
  'a job interview',
  'meeting someone new at a party',
  'planning a trip',
  'talking about family',
];

export default function ReadingMode() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();

  const languages  = state.languages || [];
  const activeLang = state.activeLang?.lang ? state.activeLang : languages[0];
  const lang       = activeLang?.lang    || 'Spanish';
  const dialect    = activeLang?.dialect || lang;
  const nativeLang = state.profile?.native || 'English';

  const [phase, setPhase]       = useState('loading'); // loading | reading | result | error
  const [passage, setPassage]   = useState('');
  const [question, setQuestion] = useState('');
  const [choices, setChoices]   = useState([]);
  const [correct, setCorrect]   = useState(0);
  const [topic, setTopic]       = useState('');
  const [selected, setSelected] = useState(null);
  const [xpEarned, setXpEarned] = useState(0);

  const generate = useCallback(async () => {
    setPhase('loading');
    setSelected(null);
    setXpEarned(0);

    const t = TOPICS[Math.floor(Math.random() * TOPICS.length)];
    setTopic(t);

    const prompt = `Write a short authentic text in ${dialect} ${lang} about: "${t}".

Requirements:
- 3-5 sentences of natural, everyday ${dialect} speech
- Use real ${dialect} vocabulary and expressions, not textbook Spanish
- Then write ONE comprehension question in ${nativeLang} with 4 multiple choice answers
- The correct answer should be clearly supported by the text
- Wrong answers should be plausible but incorrect

Return ONLY raw JSON, no markdown:
{
  "passage": "...",
  "question": "...",
  "choices": ["...", "...", "...", "..."],
  "correct": 0
}

"correct" is the 0-based index of the right answer.`;

    try {
      const token = await getValidToken();
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${WORKER_URL}/api/chat`, {
        method: 'POST', headers,
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 600,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      const data = await res.json();
      const text = (data.content?.[0]?.text || '').replace(/```json|```/g, '').trim();
      const m = text.match(/\{[\s\S]*\}/);
      if (!m) { setPhase('error'); return; }
      const parsed = JSON.parse(m[0]);
      if (!parsed.passage || !parsed.question || !parsed.choices?.length) { setPhase('error'); return; }

      setPassage(parsed.passage);
      setQuestion(parsed.question);
      setChoices(parsed.choices);
      setCorrect(parsed.correct ?? 0);
      setPhase('reading');
    } catch {
      setPhase('error');
    }
  }, [lang, dialect, nativeLang]);

  useEffect(() => { generate(); }, []);

  function handleAnswer(idx) {
    if (selected !== null) return;
    setSelected(idx);
    const isCorrect = idx === correct;
    const xp = isCorrect ? 20 : 5;
    setXpEarned(xp);
    dispatch({ type: 'AWARD_XP', payload: xp });
    setTimeout(() => setPhase('result'), 400);
  }

  // ── Loading ──
  if (phase === 'loading') return (
    <div className="screen active" style={{ alignItems: 'center', padding: '28px 16px 60px' }}>
      <div className="fib-wrap">
        <PageHeader />
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--muted)', fontSize: '.88rem' }}>
          <div style={{ marginBottom: 14 }}>Finding something to read…</div>
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
        <PageHeader />
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <p style={{ color: 'var(--danger)', fontWeight: 600, marginBottom: 8 }}>⚠️ Couldn't load a passage</p>
          <p style={{ color: 'var(--muted)', fontSize: '.82rem', marginBottom: 20 }}>Check your connection and try again.</p>
          <button className="fib-next-btn" onClick={generate}>Try Again</button>
        </div>
      </div>
    </div>
  );

  // ── Reading + Result ──
  const isResult = phase === 'result';
  const isCorrectAnswer = selected === correct;

  return (
    <div className="screen active" style={{ alignItems: 'center', padding: '28px 16px 60px', overflowY: 'auto' }}>
      <div className="fib-wrap">
        <PageHeader />

        {/* Topic label */}
        <div style={{ fontSize: '.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.12em', color: 'var(--muted)', marginBottom: 10 }}>
          📖 {topic}
        </div>

        {/* Passage */}
        <div style={{ background: 'var(--card)', border: '1.5px solid var(--border)', borderRadius: 14, padding: '20px', marginBottom: 20, lineHeight: 1.75, fontSize: '.95rem', color: 'var(--ink)' }}>
          {passage}
        </div>

        {/* Question */}
        <div style={{ fontWeight: 700, fontSize: '.92rem', color: 'var(--ink)', marginBottom: 14 }}>
          {question}
        </div>

        {/* Choices */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          {choices.map((choice, i) => {
            let bg = 'var(--card)', border = '1.5px solid var(--border)', color = 'var(--ink)';
            if (selected !== null) {
              if (i === correct) { bg = '#e8f5e9'; border = '2px solid #2e7d32'; color = '#1b5e20'; }
              else if (i === selected && i !== correct) { bg = '#fdecea'; border = '2px solid #c62828'; color = '#b71c1c'; }
            }
            return (
              <button
                key={i}
                onClick={() => handleAnswer(i)}
                disabled={selected !== null}
                style={{
                  background: bg, border, borderRadius: 12, padding: '14px 16px',
                  fontFamily: "'DM Sans',sans-serif", fontSize: '.88rem', fontWeight: 500,
                  color, cursor: selected !== null ? 'default' : 'pointer',
                  textAlign: 'left', transition: 'all .2s',
                }}
              >
                <span style={{ fontWeight: 700, marginRight: 8, opacity: .5 }}>{['A', 'B', 'C', 'D'][i]}</span>
                {choice}
              </button>
            );
          })}
        </div>

        {/* Feedback */}
        {isResult && (
          <div style={{ marginBottom: 20 }}>
            <div style={{
              background: isCorrectAnswer ? '#e8f5e9' : '#fdecea',
              border: `1.5px solid ${isCorrectAnswer ? '#2e7d32' : '#c62828'}`,
              borderRadius: 12, padding: '14px 16px', marginBottom: 12,
              fontSize: '.88rem', color: isCorrectAnswer ? '#1b5e20' : '#b71c1c', fontWeight: 600,
            }}>
              {isCorrectAnswer ? `✅ Correct! +${xpEarned} XP` : `❌ Not quite — the answer was: ${choices[correct]}`}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="fib-next-btn" onClick={generate} style={{ flex: 1 }}>
                Next passage →
              </button>
              <button
                onClick={() => navigate('/chat', { state: { lang, dialect, level: activeLang?.level || 'intermediate', mode: 'freechat', scenario: null, context: passage } })}
                style={{ flex: 1, background: 'var(--card)', color: 'var(--ink)', border: '1.5px solid var(--border)', borderRadius: 12, padding: '12px', fontFamily: "'DM Sans',sans-serif", fontSize: '.85rem', fontWeight: 600, cursor: 'pointer' }}
              >
                💬 Discuss it
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

function PageHeader() {
  return (
    <div style={{ marginBottom: 18 }}>
      <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: '1.45rem', marginBottom: 5 }}>
        📖 Reading
      </h2>
      <p style={{ color: 'var(--muted)', fontSize: '.85rem' }}>
        Read an authentic text, then answer a question about it.
      </p>
    </div>
  );
}
