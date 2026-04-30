import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { getValidToken } from '../utils/getValidToken.js';

const WORKER_URL = 'https://perin-proxy.gmaster3106.workers.dev';

function saveWordToVocab(word, meaning, lang) {
  try {
    const vocab = JSON.parse(localStorage.getItem('perin_vocab') || '[]');
    if (vocab.some(v => v.word?.toLowerCase() === word?.toLowerCase() && v.lang === lang)) return false;
    vocab.push({ word, meaning, lang, strength: 0, reviews: 0, added: Date.now() });
    localStorage.setItem('perin_vocab', JSON.stringify(vocab));
    return true;
  } catch { return false; }
}

function getVocabCount() {
  try { return JSON.parse(localStorage.getItem('perin_vocab') || '[]').length; } catch { return 0; }
}

export default function SessionSummary() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const location = useLocation();

  // Data passed from Chat via navigate('/summary', { state: {...} })
  const {
    xpEarned    = 0,
    duration    = 0,
    messages    = 0,
    lang        = '',
    dialect     = '',
    level       = '',
    scenario    = null,
    history     = [],    // conversationHistory array
    flag        = '',
  } = location.state || {};

  const profile    = state.profile || {};
  const streak     = profile.streak || 0;
  const totalXP    = (profile.xp || 0) + xpEarned;
  const level_num  = Math.floor(totalXP / 100) + 1;
  const vocabCount = getVocabCount();
  const dialectLabel = dialect && dialect !== lang ? `${dialect} ${lang}` : lang;
  const scenarioLabel = scenario?.title || '';

  const [recapPhrases, setRecapPhrases]   = useState(null); // null | [] | [{word,meaning,note}]
  const [savedWords,   setSavedWords]     = useState({});   // word → true
  const [showFull,     setShowFull]       = useState(false);

  // Award XP and check streak on mount — only once per session
  useEffect(() => {
    const sessionKey = `perin_xp_awarded_${Date.now().toString().slice(0, -3)}`; // per-second key
    const alreadyAwarded = sessionStorage.getItem('perin_summary_awarded');
    if (!alreadyAwarded) {
      sessionStorage.setItem('perin_summary_awarded', '1');
      if (xpEarned > 0) dispatch({ type: 'AWARD_XP', payload: xpEarned });
      dispatch({ type: 'CHECK_STREAK' });
    }
    return () => { sessionStorage.removeItem('perin_summary_awarded'); };
  }, []);

  // Generate AI recap in background
  useEffect(() => {
    if (history.length < 4) return;
    generateRecap();
  }, []);

  async function generateRecap() {
    try {
      const token = await getValidToken();
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const transcript = history.slice(-24)
        .map(m => `${m.role === 'user' ? 'Learner' : 'Native speaker'}: ${m.content}`)
        .join('\n');

      const res = await fetch(`${WORKER_URL}/api/chat`, {
        method: 'POST', headers,
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 400,
          messages: [{
            role: 'user',
            content: `You are a language learning analyst. Review this ${dialectLabel} conversation and identify the 3-5 most valuable vocabulary items for the learner.

PRIORITY ORDER:
1. ${dialect || lang}-specific slang, expressions, or idioms not in standard ${lang} textbooks
2. Regional vocabulary unique to ${dialect || lang} speakers
3. Culturally specific phrases that reveal how ${dialect || lang} speakers actually talk
4. High-frequency phrases the learner struggled with or could improve

Return ONLY valid JSON, no markdown, no preamble:
{"phrases":[{"word":"...","meaning":"...","note":"one line — why this is specific to ${dialect || lang}"}]}

Conversation:
${transcript}`,
          }],
        }),
      });
      const data = await res.json();
      const raw = (data.content?.[0]?.text || '').replace(/```json|```/g, '').trim();
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) return;
      const parsed = JSON.parse(match[0]);
      if (parsed.phrases?.length) setRecapPhrases(parsed.phrases);
    } catch { /* silent */ }
  }

  function handleSaveWord(phrase) {
    const saved = saveWordToVocab(phrase.word, phrase.meaning, lang);
    if (saved) setSavedWords(s => ({ ...s, [phrase.word]: true }));
  }

  return (
    <div className="screen active" id="screen-summary" style={{ alignItems: 'center', padding: '28px 16px 60px', overflowY: 'auto' }}>
      <div style={{ width: '100%', maxWidth: 480 }}>

        {/* Hero */}
        <div style={{ textAlign: 'center', padding: '8px 0 20px' }}>
          <div style={{ fontSize: '3rem', marginBottom: 10 }}>🎉</div>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: '1.4rem', fontWeight: 700, marginBottom: 6 }}>
            Great session!
          </div>
          {dialectLabel && (
            <p style={{ fontSize: '.78rem', color: 'var(--muted)', marginTop: 4 }}>
              {flag} {dialectLabel}{scenarioLabel ? ` · ${scenarioLabel}` : ''}{level ? ` · ${level}` : ''}
            </p>
          )}

          {/* XP earned */}
          <div style={{ background: 'linear-gradient(135deg, var(--accent), #1a3a6b)', borderRadius: 16, padding: '18px 24px', margin: '20px 0', color: '#fff' }}>
            <div style={{ fontSize: '2.8rem', fontWeight: 800, lineHeight: 1 }}>+{xpEarned}</div>
            <div style={{ fontSize: '.85rem', opacity: .8, marginTop: 4 }}>XP earned</div>
            <div style={{ fontSize: '.75rem', opacity: .6, marginTop: 6 }}>
              Level {level_num} · {totalXP} XP total
            </div>
            {streak > 1 && (
              <div style={{ fontSize: '.82rem', color: '#fbbf24', marginTop: 6 }}>
                🔥 {streak} day streak
              </div>
            )}
          </div>
        </div>

        {/* Stats row */}
        {(messages > 0 || duration > 0) && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
            {[
              { label: 'Messages', val: messages },
              { label: 'Minutes',  val: duration || '<1' },
              { label: 'Vocab',    val: vocabCount },
            ].map(s => (
              <div key={s.label} style={{ flex: 1, background: 'var(--card)', border: '1.5px solid var(--border)', borderRadius: 12, padding: '12px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--accent)' }}>{s.val}</div>
                <div style={{ fontSize: '.68rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.08em', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* AI Recap */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: '.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.12em', color: 'var(--muted)', marginBottom: 10 }}>
            📌 Session Recap — Key Phrases
          </div>

          {recapPhrases === null && history.length >= 4 && (
            <div style={{ background: 'var(--card)', border: '1.5px solid var(--border)', borderRadius: 12, padding: '14px 16px', fontSize: '.82rem', color: 'var(--muted)' }}>
              Analysing your session…
            </div>
          )}

          {recapPhrases === null && history.length < 4 && (
            <div style={{ background: 'var(--card)', border: '1.5px solid var(--border)', borderRadius: 12, padding: '14px 16px', fontSize: '.82rem', color: 'var(--muted)' }}>
              Have a longer conversation to get a phrase recap.
            </div>
          )}

          {recapPhrases?.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recapPhrases.map((p, i) => (
                <div key={i} style={{ background: 'var(--card)', border: '1.5px solid var(--border)', borderRadius: 12, padding: '13px 16px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '.92rem', color: 'var(--ink)', marginBottom: 2 }}>{p.word}</div>
                    <div style={{ fontSize: '.78rem', color: 'var(--muted)' }}>
                      {p.meaning}{p.note ? ` · ` : ''}
                      {p.note && <em style={{ opacity: .8 }}>{p.note}</em>}
                    </div>
                  </div>
                  {savedWords[p.word] ? (
                    <span style={{ fontSize: '.72rem', color: '#2e7d32', fontWeight: 600, flexShrink: 0 }}>✓ Saved</span>
                  ) : (
                    <button
                      onClick={() => handleSaveWord(p)}
                      style={{ background: 'none', border: '1.5px solid var(--border)', borderRadius: 8, padding: '4px 10px', fontFamily: "'DM Sans',sans-serif", fontSize: '.72rem', cursor: 'pointer', color: 'var(--muted)', flexShrink: 0, transition: 'all .15s' }}
                    >
                      💾 Save
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* What's next */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: '.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.12em', color: 'var(--muted)', marginBottom: 10 }}>
            What to do next
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              onClick={() => navigate('/scenarios')}
              style={{ background: 'var(--card)', border: '1.5px solid var(--border)', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", width: '100%', textAlign: 'left' }}
            >
              <span style={{ fontSize: '1.2rem' }}>🎬</span>
              <div>
                <div style={{ fontSize: '.88rem', fontWeight: 600, color: 'var(--ink)' }}>Try another scenario</div>
                <div style={{ fontSize: '.76rem', color: 'var(--muted)' }}>Each one teaches different words</div>
              </div>
            </button>

            {vocabCount > 0 && (
              <button
                onClick={() => navigate('/srs')}
                style={{ background: 'var(--card)', border: '1.5px solid var(--border)', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", width: '100%', textAlign: 'left' }}
              >
                <span style={{ fontSize: '1.2rem' }}>🔁</span>
                <div>
                  <div style={{ fontSize: '.88rem', fontWeight: 600, color: 'var(--ink)' }}>Review words you saved</div>
                  <div style={{ fontSize: '.76rem', color: 'var(--muted)' }}>Lock them into memory</div>
                </div>
              </button>
            )}

            <button
              onClick={() => navigate('/fib')}
              style={{ background: 'var(--card)', border: '1.5px solid var(--border)', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", width: '100%', textAlign: 'left' }}
            >
              <span style={{ fontSize: '1.2rem' }}>✏️</span>
              <div>
                <div style={{ fontSize: '.88rem', fontWeight: 600, color: 'var(--ink)' }}>Fill the Blank drill</div>
                <div style={{ fontSize: '.76rem', color: 'var(--muted)' }}>Practise grammar in context</div>
              </div>
            </button>
          </div>
        </div>

        {/* Replay + Dashboard */}
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          {scenario && (
            <button
              onClick={() => navigate('/chat', { state: { lang, dialect, level, mode: 'scenario', scenario } })}
              style={{ flex: 1, background: 'none', border: '1.5px solid var(--border)', borderRadius: 12, padding: '12px', fontFamily: "'DM Sans',sans-serif", fontSize: '.83rem', color: 'var(--muted)', cursor: 'pointer' }}
            >
              🔁 Replay
            </button>
          )}
          <button
            onClick={() => navigate('/dashboard')}
            style={{ flex: 2, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 12, padding: '12px', fontFamily: "'DM Sans',sans-serif", fontSize: '.9rem', fontWeight: 700, cursor: 'pointer' }}
          >
            Dashboard →
          </button>
        </div>

      </div>
    </div>
  );
}
