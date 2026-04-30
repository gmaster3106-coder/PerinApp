import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { useTTS } from '../hooks/useTTS.js';
import { WORKER_URL } from '../config/constants.js';
import { getLangCode } from '../utils/langUtils.js';

export default function WordPrep() {
  const { state } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const sessionData = location.state || {};

  const lang = sessionData.lang || state.languages?.[0]?.lang || 'Spanish';
  const dialect = sessionData.dialect || state.languages?.[0]?.dialect || lang;
  const level = sessionData.level || 'beginner';
  const scenario = sessionData.scenario || null;
  const idx = sessionData.idx ?? 0;
  const accessToken = state.currentUser?.access_token;
  const nativeLang = state.profile?.native || 'English';

  const [words, setWords] = useState([]);
  const [exchanges, setExchanges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [playingWord, setPlayingWord] = useState(null);

  const { speak, getVoiceId } = useTTS();
  const voiceId = getVoiceId(dialect, lang, scenario?.title || '');
  const langCode = getLangCode(lang, dialect);

  async function speakWord(text, wordIdx) {
    setPlayingWord(wordIdx);
    try {
      await speak({ text, voiceId, lang: langCode, accessToken });
    } finally {
      setPlayingWord(null);
    }
  }

  useEffect(() => {
    if (!scenario) { navigate('/scenarios'); return; }
    loadWords();
  }, []);

  async function loadWords() {
    setLoading(true);
    const replayKey = `perin_replay_${lang}_${dialect}_${level}_${idx}`;
    const replayCount = parseInt(localStorage.getItem(replayKey) || '0');

    const levelGuide = {
      beginner: 'Focus on the 4-5 most essential words they MUST know to get through this scenario. Very basic, high-frequency.',
      intermediate: 'Include useful expressions, polite alternatives, and 1-2 phrases that make them sound more natural.',
      advanced: 'Skip the basics entirely. Give nuanced expressions, idiomatic phrases, and regional slang.',
      native: 'Give the most authentic, colloquial vocabulary a real local would use. Slang, regional expressions, cultural references.',
    }[level] || '';

    const replayNote = replayCount > 0
      ? `VARIATION REQUIRED: This learner has done this scenario ${replayCount} time(s). Give DIFFERENT words from before.`
      : '';

    try {
      const apiKey = localStorage.getItem('perin_api_key') || '';
      const endpoint = accessToken ? `${WORKER_URL}/api/chat` : apiKey ? 'https://api.anthropic.com/v1/messages' : `${WORKER_URL}/api/chat`;
      const headers = { 'Content-Type': 'application/json' };
      if (apiKey && !accessToken) {
        headers['anthropic-version'] = '2023-06-01';
        headers['anthropic-dangerous-direct-browser-access'] = 'true';
        headers['x-api-key'] = apiKey;
      } else if (accessToken) {
        headers['Authorization'] = 'Bearer ' + accessToken;
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 400,
          messages: [{
            role: 'user',
            content: `Give 4-5 essential words or phrases for a ${level} ${dialect} ${lang} learner about to practice: "${scenario.title}".

Level guidance: ${levelGuide}
${replayNote}

CRITICAL: The "target" field MUST be in ${lang}. The "english" field is the ${nativeLang} translation.

Also give 2 short realistic sample exchanges. Both lines in ${lang}.

Return ONLY raw JSON:
{"words":[{"target":"[word in ${lang}]","pronunciation":"[phonetic]","english":"[${nativeLang} meaning]"}],"exchanges":[{"speaker":"LOCAL","line":"[line in ${lang}]","translation":"[${nativeLang}]"},{"speaker":"YOU","line":"[line in ${lang}]","translation":"[${nativeLang}]"}]}`
          }]
        })
      });

      const data = await res.json();
      const raw = (data.content?.[0]?.text || '').trim();
      let parsed = null;
      try { parsed = JSON.parse(raw); } catch {}
      if (!parsed) { try { const m = raw.match(/\{[\s\S]*\}/); if (m) parsed = JSON.parse(m[0]); } catch {} }

      if (parsed?.words?.length) {
        setWords(parsed.words);
        setExchanges(parsed.exchanges || []);
      } else {
        setWords([
          { target: 'Por favor', pronunciation: 'por fah-VOR', english: 'Please' },
          { target: 'Gracias', pronunciation: 'GRAH-syahs', english: 'Thank you' },
          { target: 'No entiendo', pronunciation: 'no en-TYEN-do', english: "I don't understand" },
          { target: 'Disculpe', pronunciation: 'dees-KOOL-peh', english: 'Excuse me' },
        ]);
      }
    } catch {
      setWords([
        { target: 'Por favor', pronunciation: 'por fah-VOR', english: 'Please' },
        { target: 'Gracias', pronunciation: 'GRAH-syahs', english: 'Thank you' },
        { target: 'No entiendo', pronunciation: 'no en-TYEN-do', english: "I don't understand" },
      ]);
    }
    setLoading(false);
  }

  function goToStructured() {
    navigate('/structured', { state: { ...sessionData } });
  }

  function skipToChat() {
    navigate('/chat', { state: { ...sessionData } });
  }

  return (
    <div className="screen active" id="screen-wordprep" style={{ overflowY: 'auto', padding: '16px 16px 32px', alignItems: 'center' }}>
      <div style={{ width: '100%', maxWidth: '680px' }}>

        <div style={{ textAlign: 'center', marginBottom: '14px' }}>
          <div style={{ fontSize: '.68rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.15em', color: 'var(--muted)', marginBottom: '6px' }}>Before you start</div>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: '1.3rem', fontWeight: '700', color: 'var(--ink)', marginBottom: '4px' }}>Learn these words first</div>
          <p style={{ fontSize: '.82rem', color: 'var(--muted)' }}>You'll use them in the conversation.</p>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--muted)', fontSize: '.85rem' }}>
            <div style={{ marginBottom: '12px' }}>Preparing your lesson…</div>
            <div className="fib-loading-dot" style={{ display: 'inline-block' }}></div>
            <div className="fib-loading-dot" style={{ display: 'inline-block', animationDelay: '.2s' }}></div>
            <div className="fib-loading-dot" style={{ display: 'inline-block', animationDelay: '.4s' }}></div>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: '8px', fontSize: '.68rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.12em', color: 'var(--muted)' }}>Key words &amp; phrases</div>
            <div id="wordprep-cards" style={{ marginBottom: '12px', display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '10px' }}>
              {words.map((w, i) => (
                <div key={i} className="wordprep-card">
                  <div className="wpc-info">
                    <div className="wpc-target">{w.target}</div>
                    <div className="wpc-pronunciation">{w.pronunciation}</div>
                    <div className="wpc-english">{w.english}</div>
                  </div>
                  <button className="wpc-play" onClick={() => speakWord(w.target, i)}>
                    {playingWord === i ? '⏵ Playing…' : '▶ Hear it'}
                  </button>
                </div>
              ))}
            </div>

            {exchanges.length > 0 && (
              <div style={{ marginTop: '14px' }}>
                <div style={{ fontSize: '.7rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.12em', color: 'var(--muted)', marginBottom: '10px' }}>How it might go</div>
                {exchanges.map((ex, i) => (
                  <ExchangeCard key={i} exchange={ex} />
                ))}
              </div>
            )}
          </>
        )}

        <div style={{ background: 'var(--cream)', borderRadius: '10px', padding: '9px 14px', marginBottom: '16px', fontSize: '.78rem', color: 'var(--muted)', lineHeight: '1.55', marginTop: '12px' }}>
          💡 Tap <strong>+</strong> anytime for hints or to look up a word.
        </div>

        <button className="welcome-new-cta" style={{ background: 'var(--accent)', width: '100%', maxWidth: '100%' }} onClick={goToStructured}>
          Start warm-up →
        </button>
        <button onClick={skipToChat} style={{ display: 'block', margin: '12px auto 0', background: 'transparent', border: 'none', fontFamily: "'DM Sans',sans-serif", fontSize: '.82rem', fontWeight: '500', color: 'var(--muted)', cursor: 'pointer', padding: '8px 24px', textDecoration: 'underline' }}>
          Skip — go straight to conversation
        </button>

      </div>
    </div>
  );
}

function ExchangeCard({ exchange }) {
  const [showTranslation, setShowTranslation] = useState(false);
  return (
    <div className="wordprep-exchange">
      <div className="wpe-speaker">{exchange.speaker}</div>
      <div className="wpe-line">{exchange.line}</div>
      {!showTranslation
        ? <button onClick={() => setShowTranslation(true)} style={{ background: 'none', border: 'none', fontFamily: "'DM Sans',sans-serif", fontSize: '.72rem', color: 'var(--muted)', cursor: 'pointer', textDecoration: 'underline', padding: '2px 0' }}>See translation</button>
        : <div className="wpe-translation">{exchange.translation}</div>
      }
    </div>
  );
}
