import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { getValidToken } from '../utils/getValidToken.js';

const WORKER_URL = 'https://perin-proxy.gmaster3106.workers.dev';

const READING_TOPICS = [
  { id: 'daily', label: 'Daily Life', icon: '☀️' },
  { id: 'food', label: 'Food & Eating', icon: '🍽️' },
  { id: 'travel', label: 'Travel', icon: '✈️' },
  { id: 'culture', label: 'Culture', icon: '🎭' },
  { id: 'news', label: 'Local News', icon: '📰' },
  { id: 'family', label: 'Family', icon: '👨‍👩‍👧' },
];

function markMissionDoneIfMatch(types) {
  try {
    const key = 'perin_mission_' + new Date().toDateString();
    const mission = JSON.parse(localStorage.getItem(key) || '{}');
    if (types.includes(mission.type)) {
      localStorage.setItem('perin_mission_done_' + new Date().toDateString(), '1');
    }
  } catch { /* silent */ }
}

export default function Reading() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();

  const languages = state.languages || [];
  const activeLang = state.activeLang?.lang ? state.activeLang : languages[0];
  const lang = activeLang?.lang || 'Spanish';
  const dialect = activeLang?.dialect || lang;
  const nativeLang = state.profile?.native || 'English';

  const [phase, setPhase] = useState('pick'); // pick | loading | reading | questions | score | error
  const [topic, setTopic] = useState('daily');
  const [passage, setPassage] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [vocab, setVocab] = useState([]);
  const [showVocab, setShowVocab] = useState(false);

  const generate = useCallback(async (topicId) => {
    setPhase('loading');
    setPassage(null);
    setQuestions([]);
    setAnswers({});
    setSubmitted(false);
    setScore(0);
    setVocab([]);
    setShowVocab(false);

    const topicLabel = READING_TOPICS.find(t => t.id === topicId)?.label || 'Daily Life';

    try {
      const token = await getValidToken();
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${WORKER_URL}/api/chat`, {
        method: 'POST', headers,
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 800,
          messages: [{
            role: 'user',
            content: `Create a short authentic reading passage in ${dialect} ${lang} about the topic: "${topicLabel}".

The passage should:
- Be 80-120 words long
- Use authentic ${dialect} vocabulary and phrasing (not generic textbook language)
- Feel like something a real ${dialect} speaker would write or read
- Be appropriate for intermediate learners

Then provide:
- 3 comprehension questions (multiple choice, 3 options each) — test understanding, not just word recognition
- 3-4 key vocabulary words with ${nativeLang} translations

Return ONLY raw JSON:
{
  "title": "[short title in ${lang}]",
  "passage": "[the text in ${lang}]",
  "questions": [
    {"q": "[question in ${nativeLang}]", "options": ["[opt A]", "[opt B]", "[opt C]"], "answer": 0}
  ],
  "vocab": [
    {"word": "[word in ${lang}]", "meaning": "[${nativeLang} meaning]"}
  ]
}`,
          }],
        }),
      });

      const data = await res.json();
      const text = data.content?.[0]?.text || '';
      const m = text.match(/\{[\s\S]*\}/);
      if (!m) throw new Error('No JSON');
      const parsed = JSON.parse(m[0]);
      if (!parsed.passage || !parsed.questions?.length) throw new Error('Invalid');

      setPassage({ title: parsed.title || topicLabel, text: parsed.passage });
      setQuestions(parsed.questions);
      setVocab(parsed.vocab || []);
      setPhase('reading');
    } catch {
      setPhase('error');
    }
  }, [lang, dialect, nativeLang]);

  function handleAnswer(qIdx, optIdx) {
    if (submitted) return;
    setAnswers(prev => ({ ...prev, [qIdx]: optIdx }));
  }

  function handleSubmit() {
    if (Object.keys(answers).length < questions.length) return;
    let s = 0;
    questions.forEach((q, i) => { if (answers[i] === q.answer) s++; });
    setScore(s);
    setSubmitted(true);
    const xp = s * 15;
    dispatch({ type: 'AWARD_XP', payload: xp });
    markMissionDoneIfMatch(['reading']);
    setPhase('score');
  }

  function tryAnother() {
    generate(topic);
  }

  // ── Pick topic ──
  if (phase === 'pick') return (
    <div className="screen active" style={{ alignItems: 'center', padding: '28px 16px 60px' }}>
      <div className="fib-wrap">
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: '1.45rem', marginBottom: 5 }}>📖 Reading</h2>
          <p style={{ color: 'var(--muted)', fontSize: '.85rem' }}>
            Read an authentic {dialect !== lang ? dialect : lang} text, then answer questions.
          </p>
        </div>

        <div style={{ fontSize: '.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.12em', color: 'var(--muted)', marginBottom: 12 }}>
          Choose a topic
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
          {READING_TOPICS.map(t => (
            <button
              key={t.id}
              onClick={() => setTopic(t.id)}
              style={{
                background: topic === t.id ? 'var(--accent)' : 'var(--card)',
                color: topic === t.id ? '#fff' : 'var(--ink)',
                border: `1.5px solid ${topic === t.id ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 12, padding: '12px 14px',
                fontFamily: "'DM Sans',sans-serif", fontSize: '.85rem', fontWeight: 600,
                cursor: 'pointer', textAlign: 'left', transition: 'all .15s',
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              <span style={{ fontSize: '1.2rem' }}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        <button
          className="fib-next-btn"
          onClick={() => generate(topic)}
          style={{ width: '100%' }}
        >
          Generate Passage →
        </button>
      </div>
    </div>
  );

  // ── Loading ──
  if (phase === 'loading') return (
    <div className="screen active" style={{ alignItems: 'center', padding: '28px 16px 60px' }}>
      <div className="fib-wrap">
        <Header />
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--muted)', fontSize: '.88rem' }}>
          <div style={{ marginBottom: 14 }}>Generating your reading passage…</div>
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
          <p style={{ color: 'var(--danger)', marginBottom: 8, fontWeight: 600 }}>⚠️ Couldn't generate passage</p>
          <p style={{ color: 'var(--muted)', fontSize: '.82rem', marginBottom: 20 }}>Check your connection and try again.</p>
          <button className="fib-next-btn" onClick={() => generate(topic)}>Try Again</button>
        </div>
      </div>
    </div>
  );

  // ── Reading ──
  if (phase === 'reading' && passage) return (
    <div className="screen active" style={{ alignItems: 'center', padding: '28px 16px 60px' }}>
      <div className="fib-wrap">
        <Header />

        {/* Passage */}
        <div style={{ background: 'var(--card)', border: '1.5px solid var(--border)', borderRadius: 14, padding: '20px 18px', marginBottom: 20 }}>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: '1.05rem', fontWeight: 700, color: 'var(--ink)', marginBottom: 14 }}>
            {passage.title}
          </div>
          <p style={{ fontSize: '.92rem', color: 'var(--ink)', lineHeight: '1.75', margin: 0 }}>
            {passage.text}
          </p>
        </div>

        {/* Key vocab */}
        {vocab.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <button
              onClick={() => setShowVocab(v => !v)}
              style={{ background: 'none', border: '1.5px solid var(--border)', borderRadius: 10, padding: '8px 14px', fontFamily: "'DM Sans',sans-serif", fontSize: '.78rem', color: 'var(--muted)', cursor: 'pointer', width: '100%', textAlign: 'left', display: 'flex', justifyContent: 'space-between' }}
            >
              <span>📌 Key vocabulary ({vocab.length} words)</span>
              <span>{showVocab ? '▲' : '▼'}</span>
            </button>
            {showVocab && (
              <div style={{ borderTop: 'none', border: '1.5px solid var(--border)', borderTop: 0, borderRadius: '0 0 10px 10px', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {vocab.map((v, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: '.88rem', fontWeight: 700, color: 'var(--accent)' }}>{v.word}</span>
                    <span style={{ fontSize: '.8rem', color: 'var(--muted)' }}>{v.meaning}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <button
          className="fib-next-btn"
          onClick={() => setPhase('questions')}
          style={{ width: '100%' }}
        >
          Answer Questions →
        </button>
        <button
          onClick={() => navigate('/chat', { state: { lang, dialect, mode: 'reading', context: passage.text, scenario: { title: passage.title, xp: 40 } } })}
          style={{ display: 'block', margin: '10px auto 0', background: 'none', border: '1.5px solid var(--border)', borderRadius: 10, padding: '8px 14px', fontFamily: "'DM Sans',sans-serif", fontSize: '.78rem', color: 'var(--muted)', cursor: 'pointer', width: '100%', textAlign: 'center' }}
        >
          💬 Discuss this text in Chat
        </button>
      </div>
    </div>
  );

  // ── Questions ──
  if (phase === 'questions') return (
    <div className="screen active" style={{ alignItems: 'center', padding: '28px 16px 60px' }}>
      <div className="fib-wrap">
        <Header />

        <div style={{ fontSize: '.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.12em', color: 'var(--muted)', marginBottom: 16 }}>
          Comprehension questions
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
          {questions.map((q, qIdx) => (
            <div key={qIdx} style={{ background: 'var(--card)', border: '1.5px solid var(--border)', borderRadius: 14, padding: '16px 16px' }}>
              <div style={{ fontSize: '.88rem', fontWeight: 700, color: 'var(--ink)', marginBottom: 12, lineHeight: 1.4 }}>
                {qIdx + 1}. {q.q}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {q.options.map((opt, optIdx) => (
                  <button
                    key={optIdx}
                    onClick={() => handleAnswer(qIdx, optIdx)}
                    style={{
                      background: answers[qIdx] === optIdx ? 'var(--accent)' : 'var(--cream)',
                      color: answers[qIdx] === optIdx ? '#fff' : 'var(--ink)',
                      border: `1.5px solid ${answers[qIdx] === optIdx ? 'var(--accent)' : 'var(--border)'}`,
                      borderRadius: 10, padding: '9px 14px',
                      fontFamily: "'DM Sans',sans-serif", fontSize: '.83rem',
                      cursor: 'pointer', textAlign: 'left', transition: 'all .15s',
                    }}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <button
          className="fib-next-btn"
          onClick={handleSubmit}
          disabled={Object.keys(answers).length < questions.length}
          style={{ width: '100%', opacity: Object.keys(answers).length < questions.length ? 0.5 : 1 }}
        >
          Check Answers ✓
        </button>
      </div>
    </div>
  );

  // ── Score ──
  if (phase === 'score') {
    const pct = Math.round(score / questions.length * 100);
    const xp = score * 15;
    return (
      <div className="screen active" style={{ alignItems: 'center', padding: '28px 16px 60px' }}>
        <div className="fib-wrap">
          <Header />
          <div className="fib-score-card">
            <p style={{ fontSize: '.72rem', textTransform: 'uppercase', letterSpacing: '.1em', color: 'rgba(255,255,255,.5)', marginBottom: 8 }}>
              📖 Reading
            </p>
            <div className="fib-score-big">
              {score}<span style={{ fontSize: '1.4rem', color: 'rgba(255,255,255,.5)' }}>/{questions.length}</span>
            </div>
            <p>{pct}% correct · +{xp} XP</p>
            <div style={{ fontSize: '1.3rem', margin: '8px 0' }}>
              {'⭐'.repeat(Math.round(pct / 34))}{'☆'.repeat(3 - Math.round(pct / 34))}
            </div>
          </div>

          {/* Answer review */}
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {questions.map((q, i) => {
              const correct = answers[i] === q.answer;
              return (
                <div key={i} style={{ background: 'var(--card)', border: `1.5px solid ${correct ? '#22c55e' : 'var(--danger)'}`, borderRadius: 12, padding: '12px 14px' }}>
                  <div style={{ fontSize: '.78rem', fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>{q.q}</div>
                  {!correct && (
                    <div style={{ fontSize: '.75rem', color: 'var(--danger)', marginBottom: 4 }}>
                      ❌ You chose: {q.options[answers[i]]}
                    </div>
                  )}
                  <div style={{ fontSize: '.75rem', color: correct ? '#16a34a' : 'var(--muted)' }}>
                    {correct ? '✅' : '✓'} Correct: {q.options[q.answer]}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button className="fib-next-btn" onClick={tryAnother} style={{ flex: 1 }}>New Passage 🔄</button>
            <button className="fib-next-btn" onClick={() => navigate('/dashboard')}
              style={{ flex: 1, background: 'var(--card)', color: 'var(--ink)', border: '1.5px solid var(--border)' }}>
              Dashboard
            </button>
          </div>

          <div style={{ marginTop: 12, textAlign: 'center' }}>
            <p style={{ fontSize: '.75rem', color: 'var(--muted)', marginBottom: 8 }}>Discuss this text in a conversation</p>
            <button
              onClick={() => navigate('/chat', { state: { lang, dialect, mode: 'reading', context: passage?.text, scenario: { title: passage?.title, xp: 40 } } })}
              style={{ background: 'none', border: '1.5px solid var(--border)', borderRadius: 10, padding: '8px 16px', fontFamily: "'DM Sans',sans-serif", fontSize: '.8rem', color: 'var(--ink)', cursor: 'pointer', width: '100%' }}
            >
              💬 Chat about this text →
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

function Header() {
  return (
    <div style={{ marginBottom: 18 }}>
      <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: '1.45rem', marginBottom: 5 }}>📖 Reading</h2>
      <p style={{ color: 'var(--muted)', fontSize: '.85rem' }}>Read an authentic text, then answer comprehension questions.</p>
    </div>
  );
}
