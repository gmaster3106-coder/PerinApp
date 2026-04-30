import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { useTTS } from '../hooks/useTTS.js';
import { useMic } from '../hooks/useMic.js';
import { escapeHtml } from '../utils/escapeHtml.js';
import { WORKER_URL } from '../config/constants.js';
import { getValidToken } from '../utils/getValidToken.js';
import { getLangCode } from '../utils/langUtils.js';
import { LEVEL_INSTRUCTIONS } from '../data/levelInstructions.js';

// ─── Vocab save helpers ───────────────────────────────────────────────────────
function loadVocab() {
  try { return JSON.parse(localStorage.getItem('perin_vocab') || '[]'); }
  catch { return []; }
}

function saveWordToVocab(word, meaning, lang) {
  const vocab = loadVocab();
  const already = vocab.some(v => v.word?.toLowerCase() === word?.toLowerCase() && v.lang === lang);
  if (already) return false;
  vocab.push({ word, meaning, lang, strength: 0, reviews: 0, added: Date.now() });
  localStorage.setItem('perin_vocab', JSON.stringify(vocab));
  return true;
}

function parseChip(chip) {
  const sep = chip.includes('=') ? '=' : chip.includes(':') ? ':' : null;
  if (!sep) return { word: chip.trim(), meaning: '' };
  const [w, ...rest] = chip.split(sep);
  return { word: w.trim(), meaning: rest.join(sep).trim() };
}

// ─── Prompt builders ─────────────────────────────────────────────────────────
function getBasePrompt(nativeLang) {
  return `You are a native speaker having a real conversation. Speak in the target language; keep meta-communication in ${nativeLang}.

RULES:
1. Target language for conversation, ${nativeLang} for corrections/hints only.
2. Use authentic dialect slang and regional expressions naturally.
3. Keep replies SHORT: 1-3 sentences max.
4. Correct mistakes warmly in ${nativeLang}.
5. No asterisk actions ever.
6. If learner seems lost, switch to ${nativeLang} and give the exact phrase.
7. At beginner level: after EVERY message, include a subtle hint of what to say next.

RETENTION (required every reply):
- End with: 🔑 [phrase] = [${nativeLang} meaning] | [phrase2] = [meaning]
- Every 3rd exchange add: 🪞 Try saying: "[3-6 word phrase]"

SCENARIO END: When scenario concludes, end with [SCENARIO_COMPLETE] on its own line.`;
}

function buildSystemPrompt(config, vocab) {
  const { lang, dialect, level, scenario, mode, nativeLang, motivation } = config;
  const levelInstruction = LEVEL_INSTRUCTIONS[level] || LEVEL_INSTRUCTIONS['intermediate'] || '';
  const vocabForLang = (vocab || []).filter(v => !v.lang || v.lang === lang).slice(-20);
  const vocabList = vocabForLang.length
    ? '\n\nSAVED VOCABULARY (recycle naturally):\n' + vocabForLang.map(v => `- ${v.word}: ${v.meaning}`).join('\n')
    : '';
  const dialectNote = dialect && dialect !== lang
    ? `\n\nYOU ARE: A native ${dialect} ${lang} speaker. Your slang, humor, and references reflect ${dialect} specifically.\n`
    : '';
  const scenarioTitle = scenario?.title || '';
  const scenarioGuardrail = scenarioTitle && mode !== 'freechat'
    ? `\n\nSCENARIO: Keep the conversation about "${scenarioTitle}".`
    : '';
  const motivNote = motivation ? `\n\nLEARNER: Their reason for learning ${lang}: "${motivation}".` : '';
  const introText = scenarioTitle ? `You are a character in the scenario: "${scenarioTitle}". ${scenario?.desc || ''}` : '';
  return introText + dialectNote + `\n\nLEVEL: ${(level || 'intermediate').toUpperCase()}\n${levelInstruction}` + '\n\n' + getBasePrompt(nativeLang || 'English') + scenarioGuardrail + vocabList + motivNote;
}

function stripMd(t) {
  return (t || '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/^#{1,3} /gm, '')
    .replace(/\n\n/g, '\n')
    .trim();
}

function parseRetention(text) {
  const raw = text || '';
  const chips = [];
  const kpLine = raw.match(/\u{1F511}[^\n]+/gu);
  if (kpLine) {
    kpLine.forEach(line => {
      const parts = line.replace(/^\u{1F511}/u, '').split('|');
      parts.forEach(p => { const t = p.trim(); if (t) chips.push(t); });
    });
  }
  const shadowMatch = raw.match(/\u{1FAB6}\s*Try saying:\s*"([^"]+)"/u);
  const mainText = stripMd(raw.replace(/\u{1F511}[^\n]*/gu, '').replace(/\u{1FAB6}[^\n]*/gu, '').trim());
  return { mainText, chips, shadow: shadowMatch?.[1] || '' };
}

function parseOpeningMessage(text) {
  const goalMatch = text.match(/Your goal[:]\s*([^\n]+?)(?=\n|Try saying|$)/i);
  const phraseMatch = text.match(/Try saying(?:[^:]*)?[:]\s*["']?([^"'—\-\n]+?)["']?\s*[—\-]+\s*([^.\n]+)/i);
  const goalIdx = text.search(/Your goal[:]/i);
  const phraseIdx = text.search(/Try saying/i);
  const welcomeText = goalIdx > 0 ? text.slice(0, goalIdx).trim() : '';
  let afterPhrase = '';
  if (phraseIdx > 0) {
    const afterLine = text.slice(phraseIdx).split('\n').slice(1).join('\n').trim();
    afterPhrase = afterLine;
  }
  return {
    welcome: stripMd(welcomeText),
    goal: goalMatch ? goalMatch[1].trim() : '',
    phraseTarget: phraseMatch ? phraseMatch[1].trim() : '',
    phraseMeaning: phraseMatch ? phraseMatch[2].trim() : '',
    after: stripMd(afterPhrase),
  };
}

// ─── Chip bar with save ───────────────────────────────────────────────────────
function ChipBar({ chips, lang, onSave }) {
  const [saved, setSaved] = useState({});
  if (!chips?.length) return null;

  function handleSave(chip) {
    const { word, meaning } = parseChip(chip);
    const didSave = saveWordToVocab(word, meaning, lang);
    setSaved(s => ({ ...s, [chip]: didSave ? 'saved' : 'already' }));
    onSave?.(word, didSave);
  }

  return (
    <div className="key-phrase-bar">
      {chips.map((chip, i) => (
        <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          <span className="kp-chip">{chip}</span>
          {saved[chip] ? (
            <span style={{ fontSize: '.65rem', color: '#2e7d32', fontWeight: 600 }}>
              {saved[chip] === 'saved' ? '✅' : '✓'}
            </span>
          ) : (
            <button
              onClick={() => handleSave(chip)}
              style={{
                background: 'none', border: '1px solid var(--border)', borderRadius: 6,
                padding: '1px 6px', fontSize: '.65rem', color: 'var(--muted)',
                cursor: 'pointer', fontFamily: "'DM Sans',sans-serif",
              }}
            >
              💾
            </button>
          )}
        </span>
      ))}
    </div>
  );
}

// ─── Message components — DO NOT CHANGE LAYOUT ────────────────────────────────
function OpeningMessage({ msg, level, lang, onPlay, onLoop, onTranslate, onSave, looping, translation }) {
  const parsed = parseOpeningMessage(msg.text);
  return (
    <div className="ai-hero-card">
      <div className="ai-hero-text">
        {parsed.welcome && <div style={{ marginBottom: '12px' }}>{parsed.welcome}</div>}
        {parsed.goal && (
          <div className="opening-goal" style={{ marginBottom: '10px' }}>
            <span className="opening-goal-label">🎯 Your goal</span>
            <span className="opening-goal-text">{parsed.goal}</span>
          </div>
        )}
        {parsed.phraseTarget && (
          <div className="opening-phrase" style={{ marginBottom: '10px' }}>
            <div className="opening-phrase-label">💬 Try saying</div>
            <div className="opening-phrase-target">{parsed.phraseTarget}</div>
            <div className="opening-phrase-meaning">{parsed.phraseMeaning}</div>
          </div>
        )}
        {parsed.after && <div style={{ marginTop: '8px', fontSize: '.9rem', color: 'var(--muted)' }}>{parsed.after}</div>}
        {!parsed.welcome && !parsed.goal && !parsed.phraseTarget && (
          <div>{msg.text}</div>
        )}
      </div>
      <div className="ai-hero-actions">
        <button className="ai-hero-btn play-btn" onClick={() => onPlay(msg.text)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          Play
        </button>
        <button className={`ai-hero-btn loop-btn${looping ? ' active' : ''}`} onClick={() => onLoop(msg.text)}>
          {looping ? '⏹ Stop' : 'Loop'}
        </button>
        <button className="ai-hero-btn">Save</button>
        {level === 'beginner' && (
          <button className="ai-hero-btn" onClick={() => onTranslate(msg.id, msg.text)}>
            {translation ? 'Hide' : 'Translate'}
          </button>
        )}
      </div>
      {translation && (
        <div style={{ fontSize: '.8rem', color: 'var(--muted)', fontStyle: 'italic', marginTop: 6, padding: '6px 0' }}>
          🌐 {translation}
        </div>
      )}
      <ChipBar chips={msg.chips} lang={lang} onSave={onSave} />
    </div>
  );
}

function AiMessage({ msg, level, lang, onPlay, onLoop, onTranslate, onSave, looping, translation }) {
  return (
    <div className="ai-hero-card">
      <div className="ai-hero-text">{msg.text}</div>
      {msg.grammarNote && <div className="grammar-note">{msg.grammarNote}</div>}
      <div className="ai-hero-actions">
        <button className="ai-hero-btn play-btn" onClick={() => onPlay(msg.text)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          Play
        </button>
        <button className={`ai-hero-btn loop-btn${looping ? ' active' : ''}`} onClick={() => onLoop(msg.text)}>
          {looping ? '⏹ Stop' : 'Loop'}
        </button>
        <button className="ai-hero-btn">Save</button>
        {level === 'beginner' && (
          <button className="ai-hero-btn" onClick={() => onTranslate(msg.id, msg.text)}>
            {translation ? 'Hide' : 'Translate'}
          </button>
        )}
      </div>
      {translation && (
        <div style={{ fontSize: '.8rem', color: 'var(--muted)', fontStyle: 'italic', marginTop: 6, padding: '6px 0' }}>
          🌐 {translation}
        </div>
      )}
      <ChipBar chips={msg.chips} lang={lang} onSave={onSave} />
      {msg.shadow && (
        <div style={{ marginTop: '8px', padding: '8px 12px', background: 'var(--cream)', borderRadius: '10px', fontSize: '.78rem', color: 'var(--muted)', fontStyle: 'italic' }}>
          🪞 Try saying: "{msg.shadow}"
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Chat() {
  const { state } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const sessionData = location.state || {};

  const lang = sessionData.lang || state.languages?.[0]?.lang || 'Spanish';
  const dialect = sessionData.dialect || state.languages?.[0]?.dialect || lang;
  const level = sessionData.level || 'beginner';
  const scenario = sessionData.scenario || null;
  const mode = sessionData.mode || 'scenario';
  const nativeLang = state.profile?.native || 'English';
  const motivation = state.profile?.motivation || '';

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [grammarMode, setGrammarMode] = useState(true);
  const [voiceMode, setVoiceMode] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [saveToast, setSaveToast] = useState(null);
  const [loopingId, setLoopingId] = useState(null);   // msg.id currently looping
  const [translations, setTranslations] = useState({}); // msg.id → translated text
  const loopRef = useRef(null);

  const messagesRef = useRef(null);
  const inputRef = useRef(null);
  const historyRef = useRef([]);
  const abortRef = useRef(null);
  const sessionStartRef = useRef(Date.now());

  const { speak, stopAudio, getVoiceId } = useTTS();
  const { isRecording, startRecording, stopRecording } = useMic();
  const voiceId = getVoiceId(dialect, lang, scenario?.title || '');
  const config = { lang, dialect, level, scenario, mode, nativeLang, motivation };

  function scrollToBottom() {
    if (messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
  }

  async function speakMessage(text) {
    if (!voiceId) return;
    const token = await getValidToken();
    speak({ text, voiceId, lang: getLangCode(lang, dialect), accessToken: token });
  }

  function handleWordSaved(word, didSave) {
    if (!didSave) return;
    setSaveToast({ word });
    setTimeout(() => setSaveToast(null), 2500);
  }

  function handleLoop(text) {
    if (loopRef.current) {
      // stop looping
      clearTimeout(loopRef.current);
      loopRef.current = null;
      stopAudio();
      setLoopingId(null);
      return;
    }
    // find the msg id for this text
    const msgId = messages.find(m => m.role === 'ai' && m.text === text)?.id || null;
    setLoopingId(msgId);
    async function playOnce() {
      if (!loopRef.current) return; // stopped
      await speakMessage(text);
      if (loopRef.current) loopRef.current = setTimeout(playOnce, 800);
    }
    loopRef.current = setTimeout(playOnce, 0);
  }

  async function handleTranslate(msgId, text) {
    if (translations[msgId]) {
      // toggle off
      setTranslations(t => { const n = { ...t }; delete n[msgId]; return n; });
      return;
    }
    try {
      const token = await getValidToken();
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${WORKER_URL}/api/chat`, {
        method: 'POST', headers,
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001', max_tokens: 150,
          messages: [{ role: 'user', content: `Translate this to English in one natural sentence. Return ONLY the translation, nothing else:\n"${text}"` }],
        }),
      });
      const data = await res.json();
      const translated = (data.content?.[0]?.text || '').trim();
      if (translated) setTranslations(t => ({ ...t, [msgId]: translated }));
    } catch { /* silent */ }
  }

  async function callClaude(isInit) {
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setIsSending(true);

    setMessages(prev => [...prev, { role: 'typing', id: Date.now() }]);

    let msgs, system;
    if (isInit) {
      system = buildSystemPrompt(config, state.vocab);
      const openingTrigger = level === 'beginner'
        ? `Start the session. Follow this EXACT format:\n1. One sentence in ${nativeLang} welcoming them to "${scenario?.title || 'this conversation'}".\n2. "Your goal: [specific task]"\n3. "Try saying: [KEY PHRASE IN ${dialect} ${lang}] — [${nativeLang} meaning]"\n4. One sentence inviting them to try.\nThe phrase MUST be in ${lang}.`
        : level === 'intermediate'
        ? `Start the session. One sentence in ${nativeLang} stating their goal for "${scenario?.title || 'this conversation'}", then start naturally in ${dialect} ${lang}.`
        : `Start now in ${dialect} ${lang}. Natural pace. One or two sentences.`;
      msgs = [{ role: 'user', content: openingTrigger }];
    } else {
      system = buildSystemPrompt(config, state.vocab);
      msgs = historyRef.current.slice(-40);
    }

    try {
      const validToken = await getValidToken();
      const apiKey = localStorage.getItem('perin_api_key') || '';

      const endpoint = validToken
        ? `${WORKER_URL}/api/chat`
        : apiKey
        ? 'https://api.anthropic.com/v1/messages'
        : `${WORKER_URL}/api/chat`;

      const reqHeaders = { 'Content-Type': 'application/json' };
      if (apiKey && !validToken) {
        reqHeaders['anthropic-version'] = '2023-06-01';
        reqHeaders['anthropic-dangerous-direct-browser-access'] = 'true';
        reqHeaders['x-api-key'] = apiKey;
      } else if (validToken) {
        reqHeaders['Authorization'] = 'Bearer ' + validToken;
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: reqHeaders,
        signal: ctrl.signal,
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 700, stream: true, system, messages: msgs }),
      });

      if (!res.ok) {
        setMessages(prev => prev.filter(m => m.role !== 'typing'));
        let errText = 'AI error. Try again.';
        if (res.status === 429) errText = 'Too many messages — wait a moment.';
        else if (res.status === 401) {
          errText = validToken
            ? 'Session expired. Please sign in again.'
            : 'Sign in to start a conversation, or add an API key in Settings.';
        }
        setMessages(prev => [...prev, { role: 'error', text: errText, id: Date.now() }]);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') break;
          try {
            const event = JSON.parse(data);
            if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
              fullText += event.delta.text;
              setMessages(prev => {
                const filtered = prev.filter(m => m.role !== 'typing');
                const last = filtered[filtered.length - 1];
                if (last?.role === 'streaming') return [...filtered.slice(0, -1), { ...last, text: fullText }];
                return [...filtered, { role: 'streaming', text: fullText, id: Date.now() }];
              });
              scrollToBottom();
            }
          } catch { }
        }
      }

      if (!fullText) { setMessages(prev => prev.filter(m => m.role !== 'typing' && m.role !== 'streaming')); return; }

      const scenarioComplete = fullText.includes('[SCENARIO_COMPLETE]');
      let cleanText = fullText.replace('[SCENARIO_COMPLETE]', '').trim();

      let mainText = cleanText, grammarNote = '';
      if (!isInit && grammarMode) {
        const gIdx = cleanText.indexOf('📝 Grammar:');
        if (gIdx !== -1) { mainText = cleanText.slice(0, gIdx).trim(); grammarNote = cleanText.slice(gIdx).trim(); }
      }

      historyRef.current.push({ role: 'assistant', content: fullText });

      setMessages(prev => {
        const filtered = prev.filter(m => m.role !== 'typing' && m.role !== 'streaming');
        const { mainText: parsed, chips, shadow } = parseRetention(mainText);
        // FIX: always treat the first AI message as the opening card
        return [...filtered, { role: 'ai', text: parsed, chips, shadow, grammarNote, id: Date.now(), raw: mainText, isOpening: isInit }];
      });

      scrollToBottom();

      if (voiceId) {
        const first = mainText.split(/(?<=[.!?])\s+/)[0] || mainText;
        const ttsText = first.length < 120 ? first : mainText.slice(0, 120);
        const token = await getValidToken();
        speak({ text: ttsText, voiceId, lang: getLangCode(lang, dialect), accessToken: token });
      }

      if (scenarioComplete && mode !== 'freechat') setTimeout(endSession, 2000);

    } catch (err) {
      if (err?.name === 'AbortError') return;
      setMessages(prev => prev.filter(m => m.role !== 'typing' && m.role !== 'streaming'));
      setMessages(prev => [...prev, { role: 'error', text: 'Something went wrong. Try again.', id: Date.now() }]);
    } finally {
      setIsSending(false);
      abortRef.current = null;
    }
  }

  useEffect(() => {
    // Paywall gate — check before starting
    const used = state.subscription?.conversations_used || 0;
    const isPro = state.subscription?.status === 'pro';
    if (!isPro && used >= 5) { navigate('/paywall', { replace: true }); return; }
    if (!initialized) { setInitialized(true); callClaude(true); }
    return () => { abortRef.current?.abort(); stopAudio(); };
  }, []);

  async function sendMessage(text) {
    const t = (text || input).trim();
    if (!t || isSending) return;
    setInput('');
    historyRef.current.push({ role: 'user', content: t });
    setMessages(prev => [...prev, { role: 'user', text: t, id: Date.now() }]);
    scrollToBottom();
    await callClaude(false);
  }

  function endSession() {
    stopAudio();
    abortRef.current?.abort();
    const duration = Math.round((Date.now() - sessionStartRef.current) / 60000);
    const msgCount = historyRef.current.filter(m => m.role === 'user').length;
    if (msgCount < 1) { navigate('/dashboard'); return; }

    // Increment free usage counter
    const used = state.subscription?.conversations_used || 0;
    dispatch({ type: 'SET_SUBSCRIPTION', payload: { ...state.subscription, conversations_used: used + 1 } });

    const baseXP = Math.min((scenario?.xp || 50) + (msgCount * 3), 200);
    navigate('/summary', {
      state: {
        xpEarned: baseXP,
        duration,
        messages: msgCount,
        lang, dialect, level,
        scenario,
        flag: state.activeLang?.flag || '',
        history: historyRef.current.slice(-30),
      },
    });
  }
  function handleKey(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }

  async function handleMic() {
    if (isRecording) { stopRecording(); return; }
    const token = await getValidToken();
    startRecording({ lang: dialect, accessToken: token, onResult: (t) => sendMessage(t), onError: (e) => console.error(e) });
  }

  async function sendQuick(type) {
    setActionsOpen(false);
    const prompts = {
      lost: `[In ${nativeLang}] I'm lost. Simplify and give me the exact phrase to say next.`,
      example: `How would a local actually say this? Give 2-3 natural examples.`,
      rephrase: `Can you rephrase your last message differently?`,
      hint: `Give me a hint in ${lang} — just a word or short phrase.`,
      'english-hint': `Quick hint in ${nativeLang} — just enough to get unstuck.`,
      slow: `Can you say that again more slowly?`,
    };
    if (prompts[type]) await sendMessage(prompts[type]);
  }

  const titleText = scenario?.title || (mode === 'freechat' ? 'Free Chat' : 'Conversation');
  const langText = `${lang}${dialect && dialect !== lang ? ' · ' + dialect : ''}`;

  return (
    <div className="screen active" id="screen-chat">
      <div className="chat-inner" style={{ width: '100%', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>

        <div className="session-bar">
          <div className="session-info">
            <div className="session-title">
              <span style={{ fontSize: '.88rem', fontWeight: '700', color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', maxWidth: 'calc(100vw - 140px)', lineHeight: 1.2 }}>{titleText}</span>
              <span style={{ fontSize: '.7rem', fontWeight: '500', color: 'var(--muted)', display: 'block', maxWidth: 'calc(100vw - 140px)', marginTop: '1px' }}>{langText}</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button onClick={endSession} style={{ background: 'none', border: '1.5px solid var(--border)', borderRadius: '8px', fontFamily: "'DM Sans',sans-serif", fontSize: '.75rem', fontWeight: '600', color: 'var(--muted)', cursor: 'pointer', padding: '5px 11px', whiteSpace: 'nowrap' }}>End</button>
            <button className="chat-menu-btn" onClick={() => setMenuOpen(o => !o)}>
              <span></span><span></span><span></span>
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="session-menu">
            <label className="menu-item" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => setGrammarMode(g => !g)}>
              <span>Grammar correction<span style={{ display: 'block', fontSize: '.7rem', color: 'var(--muted)', fontWeight: '400', marginTop: '1px' }}>AI corrects your mistakes</span></span>
              <div className={`toggle-track${grammarMode ? ' active' : ''}`}><div className="toggle-thumb"></div></div>
            </label>
            <label className="menu-item" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => setVoiceMode(v => !v)}>
              <span>Voice mode</span>
              <div className={`toggle-track${voiceMode ? ' active' : ''}`}><div className="toggle-thumb"></div></div>
            </label>
            <div className="menu-divider"></div>
            <button className="menu-item menu-danger" onClick={() => { setMenuOpen(false); endSession(); }}>End session</button>
          </div>
        )}

        <div id="messages" ref={messagesRef}>
          {messages.map(msg => {
            if (msg.role === 'typing') return (
              <div key={msg.id} className="ai-hero-card">
                <div className="typing"><span></span><span></span><span></span></div>
              </div>
            );
            if (msg.role === 'streaming') return (
              <div key={msg.id} className="ai-hero-card">
                <div className="ai-hero-text stream-text" dangerouslySetInnerHTML={{ __html: escapeHtml(msg.text) + '<span class="stream-cursor">|</span>' }} />
              </div>
            );
            if (msg.role === 'error') return (
              <div key={msg.id} style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', borderRadius: '12px', padding: '12px 16px', fontSize: '.84rem', color: 'var(--danger)', margin: '8px 0' }}>
                {msg.text}
              </div>
            );
            if (msg.role === 'user') return (
              <div key={msg.id} className="msg user">
                <div className="bubble">{msg.text}</div>
              </div>
            );
            if (msg.role === 'ai') {
              if (msg.isOpening) return <OpeningMessage key={msg.id} msg={msg} level={level} lang={lang} onPlay={speakMessage} onLoop={handleLoop} onTranslate={handleTranslate} onSave={handleWordSaved} looping={loopingId === msg.id} translation={translations[msg.id]} />;
              return <AiMessage key={msg.id} msg={msg} level={level} lang={lang} onPlay={speakMessage} onLoop={handleLoop} onTranslate={handleTranslate} onSave={handleWordSaved} looping={loopingId === msg.id} translation={translations[msg.id]} />;
            }
            return null;
          })}
        </div>

        {saveToast && (
          <div style={{
            position: 'absolute', bottom: 80, left: '50%', transform: 'translateX(-50%)',
            background: '#2e7d32', color: '#fff', borderRadius: 20, padding: '8px 18px',
            fontSize: '.8rem', fontWeight: 600, whiteSpace: 'nowrap', zIndex: 60,
            animation: 'fadeUp .2s ease',
          }}>
            ✅ "{saveToast.word}" saved to vocab
          </div>
        )}

        {actionsOpen && (
          <div id="actions-menu" className="actions-popover">
            <div className="actions-group-label">Get unstuck</div>
            <button className="action-item" onClick={() => sendQuick('lost')}>I'm lost — simplify</button>
            <button className="action-item" onClick={() => sendQuick('example')}>How would a local say this?</button>
            <button className="action-item" onClick={() => sendQuick('rephrase')}>Rephrase that differently</button>
            <div className="actions-group-label" style={{ marginTop: '6px' }}>Learn more</div>
            <button className="action-item" onClick={() => sendQuick('hint')}>Hint in target language</button>
            <button className="action-item" onClick={() => sendQuick('english-hint')}>English hint</button>
            <button className="action-item" onClick={() => sendQuick('slow')}>Say it slower</button>
          </div>
        )}

        <div className="input-area">
          <div className="input-row">
            <button className={`plus-btn${actionsOpen ? ' open' : ''}`} onClick={() => setActionsOpen(o => !o)}>+</button>
            <textarea
              ref={inputRef}
              id="user-input"
              placeholder="Type your reply…"
              style={{ fontSize: '16px' }}
              rows={1}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
            />
            <button className={`mic-btn${isRecording ? ' listening' : ''}`} onClick={handleMic}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" fill="none"/>
                <line x1="12" y1="19" x2="12" y2="23"/>
                <line x1="8" y1="23" x2="16" y2="23"/>
              </svg>
            </button>
            <button className="send-btn" onClick={() => sendMessage()} disabled={isSending || !input.trim()}>
              <svg viewBox="0 0 24 24"><path d="M2 21l21-9L2 3v7l15 2-15 2z"/></svg>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
