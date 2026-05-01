import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { useTTS } from '../hooks/useTTS.js';
import { getValidToken } from '../utils/getValidToken.js';
import { getLangCode } from '../utils/langUtils.js';

const WORKER_URL = 'https://perin-proxy.gmaster3106.workers.dev';

const DIFF_WINDOWS = { casual: 5000, moderate: 3000, fast: 2000, native: 1500 };
const DIFF_LABELS  = { casual: 'Casual', moderate: 'Moderate', fast: 'Fast', native: 'Native' };
const DIFF_SUBS    = { casual: '5s window', moderate: '3s window', fast: '2s window', native: '1.5s' };

const PM_SCENARIOS = [
  { id: 'coffee',     icon: '☕', title: 'Coffee Shop',    prompt: 'You are a barista at a busy café. Speak only in {dialect} {lang}. Start by greeting the customer and asking for their order. Keep each line short — under 10 words.' },
  { id: 'taxi',       icon: '🚕', title: 'Taxi Driver',    prompt: 'You are a taxi driver. Speak only in {dialect} {lang}. Start by asking where the customer wants to go. Keep each line short — under 10 words.' },
  { id: 'market',     icon: '🛒', title: 'Market Vendor',  prompt: 'You are a market vendor selling fresh produce. Speak only in {dialect} {lang}. Start by calling out to the customer. Keep lines short.' },
  { id: 'neighbor',   icon: '👋', title: 'Neighbor Chat',  prompt: 'You are a friendly neighbor. Speak only in {dialect} {lang}. Start with a casual greeting and ask how they are. Keep it natural and short.' },
  { id: 'restaurant', icon: '🍽️', title: 'Restaurant',     prompt: 'You are a waiter at a local restaurant. Speak only in {dialect} {lang}. Start by welcoming the customer. Short lines only.' },
  { id: 'checkout',   icon: '🏪', title: 'Store Checkout', prompt: 'You are a cashier at a convenience store. Speak only in {dialect} {lang}. Start by greeting the customer. Keep lines very short.' },
];

const NUDGES = {
  coffee:     ['…Hello?', 'What can I get you?', "Sir? Ma'am?"],
  taxi:       ['Where to?', '…Destination?', 'In or out?'],
  market:     ['Looking for something?', '…?', 'What do you need?'],
  neighbor:   ['…You okay?', 'Hello?', 'Busy?'],
  restaurant: ['Ready to order?', '…?', 'Take your time…'],
  checkout:   ["…That's everything?", 'Cash or card?', 'Hello?'],
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function getBestMime() {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
  return types.find(t => MediaRecorder.isTypeSupported(t)) || 'audio/webm';
}

function getAudioFilename(mime) {
  if (mime.includes('ogg')) return 'audio.ogg';
  if (mime.includes('mp4')) return 'audio.mp4';
  return 'audio.webm';
}

export default function Pressure() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();

  const languages  = state.languages || [];
  const activeLang = state.activeLang?.lang ? state.activeLang : languages[0];
  const lang       = activeLang?.lang    || 'Spanish';
  const dialect    = activeLang?.dialect || lang;
  const langCode   = getLangCode(lang, dialect);

  const { getVoiceId } = useTTS();

  // ── phase: setup | session | results ──
  const [view,        setView]        = useState('setup');
  const [scenarioId,  setScenarioId]  = useState('coffee');
  const [difficulty,  setDifficulty]  = useState('casual');

  // session state
  const [sessionPhase, setSessionPhase] = useState('idle'); // idle|ai-speaking|waiting|user-speaking|processing|ended
  const [aiBubble,     setAiBubble]     = useState('');
  const [userBubble,   setUserBubble]   = useState({ text: '', visible: false });
  const [statusText,   setStatusText]   = useState('');
  const [turnLabel,    setTurnLabel]    = useState('');
  const [scenarioLabel,setScenarioLabel]= useState('');
  const [timerVisible, setTimerVisible] = useState(false);
  const [timerFrac,    setTimerFrac]    = useState(1);
  const [timerNum,     setTimerNum]     = useState(0);
  const [timerUrgent,  setTimerUrgent]  = useState(false);
  const [results,      setResults]      = useState(null);

  // refs that don't cause re-renders
  const pmRef = useRef({
    active: false, phase: 'idle', scenarioId: 'coffee', difficulty: 'casual',
    windowMs: 5000, systemPrompt: '', voiceId: null,
    conversationHistory: [], aiTurnCount: 0,
    nudgeCount: 0, totalNudges: 0, micUnlocked: false,
    recentLatencies: [], currentWindowStart: 0,
    timerId: null, recorder: null, chunks: [],
  });
  const audioRef = useRef(null);

  const pm = pmRef.current;

  // ── helpers ──
  function setPhase(p) { pm.phase = p; setSessionPhase(p); }

  function setMicState(s) {
    // visual only — handled via sessionPhase
    setSessionPhase(prev => {
      // keep phase in sync with mic state
      if (s === 'listening')   return 'user-speaking';
      if (s === 'processing')  return 'processing';
      if (s === 'ai-speaking') return 'ai-speaking';
      return prev;
    });
  }

  function updateTurnLabel(count, diff) {
    setTurnLabel(`Turn ${count} · ${diff}`);
  }

  // ── TTS speak and wait ──
  async function speakAndWait(text) {
    if (!text) return;
    const clean = text.replace(/[¿¡]/g, '').trim();
    if (!clean) return;
    try {
      const token = await getValidToken();
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${WORKER_URL}/api/tts`, {
        method: 'POST', headers,
        body: JSON.stringify({ text: clean, voice_id: pm.voiceId, language_code: langCode.slice(0, 2) }),
      });
      if (!res.ok) throw new Error('tts');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      await new Promise(resolve => {
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
        audio.onerror = () => { URL.revokeObjectURL(url); resolve(); };
        audio.play().catch(() => resolve());
        // failsafe
        setTimeout(resolve, Math.max(2000, clean.length * 65) + 500);
      });
    } catch { /* silent fallback */ }
  }

  // ── AI response ──
  async function getAIResponse(isOpening = false) {
    setPhase('ai-speaking');
    setAiBubble('');
    setStatusText('');

    if (!isOpening) await sleep(800 + Math.random() * 300 - 150);

    try {
      const token = await getValidToken();
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const messages = isOpening
        ? [{ role: 'user', content: '[START — speak your opening line now]' }]
        : [...pm.conversationHistory];

      const res = await fetch(`${WORKER_URL}/api/chat`, {
        method: 'POST', headers,
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 80,
          system: pm.systemPrompt,
          messages,
        }),
      });
      const data = await res.json();
      const aiText = (data.content?.[0]?.text || '').trim().replace(/\*[^*]+\*/g, '').trim();
      if (!aiText) { setStatusText('Connection issue — try again'); return; }

      pm.conversationHistory.push({ role: 'assistant', content: aiText });
      pm.aiTurnCount++;
      updateTurnLabel(pm.aiTurnCount, pm.difficulty);
      setAiBubble(aiText);

      await speakAndWait(aiText);
      if (pm.phase !== 'ended') openWindow();

    } catch {
      setStatusText('Connection error — tap mic to try');
      setPhase('waiting');
      openWindow();
    }
  }

  // ── countdown ──
  function runCountdown(totalMs) {
    clearTimeout(pm.timerId);
    const start = Date.now();
    const end = start + totalMs;
    setTimerVisible(true);
    setTimerUrgent(false);

    function tick() {
      if (pm.phase === 'ended' || pm.phase === 'user-speaking' || pm.phase === 'processing') {
        setTimerVisible(false);
        return;
      }
      const remaining = Math.max(0, end - Date.now());
      const frac = remaining / totalMs;
      setTimerFrac(frac);
      setTimerNum(Math.ceil(remaining / 1000));
      if (remaining < totalMs * 0.35) setTimerUrgent(true);
      if (remaining <= 0) { timerExpired(); return; }
      pm.timerId = setTimeout(tick, 100);
    }
    tick();
  }

  function openWindow() {
    if (pm.phase === 'ended') return;
    pm.phase = 'waiting';
    setSessionPhase('waiting');
    pm.nudgeCount = 0;
    pm.currentWindowStart = Date.now();
    if (pm.micUnlocked) {
      startListening();
    } else {
      setStatusText('Tap mic to unlock, then speak freely');
      runCountdown(pm.windowMs);
    }
    if (!pm.micUnlocked) runCountdown(pm.windowMs);
  }

  function timerExpired() {
    if (pm.phase === 'ended') return;
    setTimerVisible(false);
    setTimerUrgent(false);

    if (pm.phase === 'user-speaking') { stopListening(); return; }

    pm.nudgeCount++;
    pm.totalNudges++;

    const pool = NUDGES[pm.scenarioId] || ['…?', 'Hello?', 'Still there?'];
    const nudgeText = pool[Math.min(pm.nudgeCount - 1, pool.length - 1)];

    if (pm.nudgeCount >= 3) { sceneClose(); return; }

    setAiBubble(nudgeText);
    pm.conversationHistory.push({ role: 'assistant', content: nudgeText });
    speakAndWait(nudgeText).then(() => {
      if (pm.phase !== 'ended') openWindow();
    });
  }

  // ── mic ──
  function micTap() {
    if (pm.phase === 'ended' || !pm.active) return;
    if (pm.phase === 'user-speaking') { stopListening(); return; }
    if (pm.phase === 'processing' || pm.phase === 'ai-speaking') return;
    pm.micUnlocked = true;
    if (pm.phase === 'waiting') startListening();
  }

  function startListening() {
    if (pm.phase === 'ended') return;
    setPhase('user-speaking');
    setStatusText('🔴 Listening…');
    clearTimeout(pm.timerId);
    setTimerVisible(false);
    setTimerUrgent(false);

    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      const mime = getBestMime();
      try {
        pm.recorder = new MediaRecorder(stream, { mimeType: mime });
      } catch {
        stream.getTracks().forEach(t => t.stop());
        setStatusText('Mic not supported — try Chrome');
        setPhase('waiting');
        openWindow();
        return;
      }
      pm.chunks = [];
      pm.recordingStart = Date.now();
      pm.recorder.ondataavailable = e => { if (e.data.size > 0) pm.chunks.push(e.data); };
      pm.recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        // ignore recordings under 600ms — almost certainly background noise
        const duration = Date.now() - (pm.recordingStart || 0);
        if (duration < 600) {
          pm.chunks = [];
          setPhase('waiting');
          setStatusText('');
          openWindow();
          return;
        }
        processRecording();
      };
      pm.recorder.start();
      // hard stop at 10s
      setTimeout(() => { if (pm.recorder?.state !== 'inactive') pm.recorder.stop(); }, 10000);
    }).catch(() => {
      setStatusText('Mic blocked — check browser permissions');
      setPhase('waiting');
      openWindow();
    });
  }

  function stopListening() {
    if (pm.recorder?.state !== 'inactive') pm.recorder.stop();
  }

  async function processRecording() {
    setPhase('processing');
    setStatusText('Processing…');

    const mime = getBestMime();
    const blob = new Blob(pm.chunks, { type: mime || 'audio/webm' });
    const latency = Date.now() - pm.currentWindowStart;
    pm.recentLatencies.push(latency);
    if (pm.recentLatencies.length > 3) pm.recentLatencies.shift();

    if (blob.size < 8000) {
      setUserBubble({ text: '…', visible: true });
      pm.conversationHistory.push({ role: 'user', content: '[silence]' });
      adaptDifficulty();
      await getAIResponse();
      return;
    }

    try {
      const token = await getValidToken();
      const form = new FormData();
      form.append('file', blob, getAudioFilename(mime));
      const lc = langCode.slice(0, 2);
      if (lc !== 'en') form.append('language', lc);

      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${WORKER_URL}/api/stt`, { method: 'POST', body: form, headers });
      if (!res.ok) throw new Error('stt');
      const data = await res.json();
      const transcript = (data.text || '').trim();

      const silenceHalluc = /^(thank you|thanks|you|the|uh|um|okay|ok|yes|no|bye|hi|hey|hmm|\.+|\s*)$/i;
      const isReal = transcript && transcript.length > 1 && !silenceHalluc.test(transcript);

      if (isReal) {
        setUserBubble({ text: transcript, visible: true });
        // pronunciation hints
        const words = data.words || [];
        const issues = words.filter(w => (w.probability || 1) < 0.78);
        if (issues.length) setStatusText('⚠ ' + issues.map(w => w.word.trim()).join(', ') + ' — pronunciation to check');
        pm.conversationHistory.push({ role: 'user', content: transcript });
        adaptDifficulty();
        if (pm.aiTurnCount >= 10) { sceneClose(); return; }
        await getAIResponse();
      } else {
        setUserBubble({ text: '…', visible: true });
        pm.conversationHistory.push({ role: 'user', content: '[no response]' });
        await getAIResponse();
      }
    } catch {
      setStatusText('Voice recognition failed — try again');
      setPhase('waiting');
      openWindow();
    }
  }

  // ── difficulty adaptation ──
  function adaptDifficulty() {
    if (pm.recentLatencies.length < 3 || pm.aiTurnCount < 5) return;
    const avg = pm.recentLatencies.reduce((a, b) => a + b, 0) / pm.recentLatencies.length;
    const frac = avg / pm.windowMs;
    const levels = ['casual', 'moderate', 'fast', 'native'];
    const idx = levels.indexOf(pm.difficulty);
    if (frac < 0.4 && pm.nudgeCount === 0 && idx < levels.length - 1) {
      pm.difficulty = levels[idx + 1];
      pm.windowMs = DIFF_WINDOWS[pm.difficulty];
      setDifficulty(pm.difficulty);
    } else if ((frac > 0.85 || pm.totalNudges >= 2) && idx > 0) {
      pm.difficulty = levels[idx - 1];
      pm.windowMs = DIFF_WINDOWS[pm.difficulty];
      setDifficulty(pm.difficulty);
    }
  }

  // ── scene close ──
  async function sceneClose() {
    setPhase('ended');
    clearTimeout(pm.timerId);
    setTimerVisible(false);
    pm.active = false;
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }

    // closing line
    pm.conversationHistory.push({ role: 'user', content: '[close the scene naturally with one short line]' });
    try {
      const token = await getValidToken();
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${WORKER_URL}/api/chat`, {
        method: 'POST', headers,
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 40, system: pm.systemPrompt, messages: pm.conversationHistory }),
      });
      const data = await res.json();
      const closing = (data.content?.[0]?.text || '').trim();
      if (closing) { setAiBubble(closing); await speakAndWait(closing); }
    } catch { /* ok */ }

    await sleep(800);
    showResults();
  }

  function showResults() {
    const turns = pm.conversationHistory.filter(m => m.role === 'user').length;
    const hesitationFree = pm.conversationHistory.filter(m => m.role === 'user' && m.content !== '[silence]' && m.content !== '[no response]').length;
    const avgLat = pm.recentLatencies.length
      ? Math.round(pm.recentLatencies.reduce((a, b) => a + b, 0) / pm.recentLatencies.length / 100) / 10
      : null;

    const baseXP = 60;
    const bonusClean = Math.min(hesitationFree * 3, 30);
    const bonusNudge = Math.max(0, 20 - pm.totalNudges * 4);
    const xp = baseXP + bonusClean + bonusNudge;
    dispatch({ type: 'AWARD_XP', payload: xp });
    dispatch({ type: 'CHECK_STREAK' });

    // Increment free usage counter
    const used = state.subscription?.conversations_used || 0;
    dispatch({ type: 'SET_SUBSCRIPTION', payload: { ...state.subscription, conversations_used: used + 1 } });

    const scenario = PM_SCENARIOS.find(s => s.id === pm.scenarioId);
    setResults({ turns, hesitationFree, avgLat, nudges: pm.totalNudges, xp, scenario });
    setView('results');
  }

  // ── start session ──
  async function startSession() {
    // Paywall gate
    const used = state.subscription?.conversations_used || 0;
    const isPro = state.subscription?.status === 'pro';
    if (!isPro && used >= 5) { navigate('/paywall'); return; }

    const scenario = PM_SCENARIOS.find(s => s.id === scenarioId) || PM_SCENARIOS[0];

    Object.assign(pm, {
      active: true, scenarioId, difficulty, windowMs: DIFF_WINDOWS[difficulty],
      aiTurnCount: 0, nudgeCount: 0, totalNudges: 0, micUnlocked: false,
      conversationHistory: [], recentLatencies: [], currentWindowStart: 0,
      timerId: null, recorder: null, chunks: [],
    });

    pm.systemPrompt = scenario.prompt
      .replace('{lang}', lang)
      .replace('{dialect}', dialect !== lang ? dialect : lang)
      + ` If the user hesitates, nudge them in character (short, impatient). Never correct grammar. React to meaning. After ~10 exchanges, close the scene naturally. Keep every single line under 10 words. No asterisks. No narration.`;

    pm.voiceId = getVoiceId(dialect, lang, scenario.title || '', localStorage.getItem('perin_voice_gender_pref') || null);

    setScenarioLabel(`${scenario.icon} ${scenario.title}`);
    setTurnLabel('');
    setAiBubble('');
    setUserBubble({ text: '', visible: false });
    setStatusText('');
    setTimerVisible(false);
    setTimerUrgent(false);
    setView('session');

    await getAIResponse(true);
  }

  function endSession() {
    if (pm.phase !== 'idle' && pm.phase !== 'ended') {
      sceneClose();
    } else {
      showResults();
    }
  }

  function tryAgain() {
    setResults(null);
    setView('setup');
  }

  // ── timer ring ──
  const CIRC = 213.6;
  const strokeOffset = CIRC * (1 - timerFrac);

  // ─────────────────────────────────────────────────────────────────────────────
  // ── SETUP VIEW ──
  if (view === 'setup') return (
    <div className="screen active" id="screen-pressure" style={{ background: 'var(--im-bg)', color: 'var(--im-text)', alignItems: 'center', justifyContent: 'center', overflowY: 'auto' }}>
      <div style={{ width: '100%', maxWidth: 480, padding: '28px 20px 40px', display: 'flex', flexDirection: 'column', gap: 0 }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: '2rem', marginBottom: 8 }}>🎙️</div>
          <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: '1.4rem', fontWeight: 700, color: 'var(--im-text)', marginBottom: 6 }}>Live Conversation</h2>
          <p style={{ fontSize: '.82rem', color: 'var(--im-text2)', lineHeight: 1.5 }}>
            The AI speaks first. You react in real time.<br />No waiting. No retries. Real pressure.
          </p>
        </div>

        {/* Scenario picker */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: '.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.12em', color: 'var(--im-text3)', marginBottom: 10 }}>Choose a scenario</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {PM_SCENARIOS.map(s => (
              <div
                key={s.id}
                className={`pm-scenario-option${scenarioId === s.id ? ' selected' : ''}`}
                onClick={() => setScenarioId(s.id)}
              >
                <span className="pm-sc-icon">{s.icon}</span>
                <div className="pm-sc-title">{s.title}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Difficulty */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: '.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.12em', color: 'var(--im-text3)', marginBottom: 10 }}>Pressure level</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {Object.keys(DIFF_WINDOWS).map(d => (
              <button
                key={d}
                className={`pm-diff-btn${difficulty === d ? ' active' : ''}`}
                onClick={() => setDifficulty(d)}
              >
                {DIFF_LABELS[d]}<span>{DIFF_SUBS[d]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Start */}
        <button
          onClick={startSession}
          style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 14, padding: 16, fontFamily: "'DM Sans',sans-serif", fontSize: '1rem', fontWeight: 700, cursor: 'pointer', width: '100%' }}
        >
          Start Live Conversation →
        </button>
        <p style={{ textAlign: 'center', fontSize: '.75rem', color: 'var(--im-text4)', marginTop: 12 }}>
          Tap once to unlock mic, then speak freely
        </p>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // ── RESULTS VIEW ──
  if (view === 'results' && results) return (
    <div className="screen active" id="screen-pressure" style={{ background: 'var(--im-bg)', color: 'var(--im-text)', alignItems: 'center', justifyContent: 'center', overflowY: 'auto' }}>
      <div style={{ width: '100%', maxWidth: 480, padding: '32px 20px 48px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ fontSize: '2rem', marginBottom: 14 }}>🎙️</div>
        <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: '1.3rem', color: 'var(--im-text)', marginBottom: 6 }}>Conversation complete</h2>
        <div style={{ fontSize: '.78rem', color: 'var(--im-text3)', marginBottom: 24 }}>
          {results.scenario?.icon} {results.scenario?.title} · {dialect !== lang ? dialect : lang}
        </div>

        <div style={{ width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
          {[
            { label: 'Turns',        val: results.turns },
            { label: 'Avg response', val: results.avgLat != null ? `${results.avgLat}s` : '—' },
            { label: 'Prompted',     val: results.nudges },
            { label: 'Clean turns',  val: results.hesitationFree },
          ].map(s => (
            <div key={s.label} className="pm-stat-card">
              <div className="pm-stat-val">{s.val}</div>
              <div className="pm-stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ background: 'var(--im-card)', border: '1px solid var(--im-border)', borderRadius: 12, padding: '12px 16px', width: '100%', textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--gold)' }}>+{results.xp} XP</div>
          <div style={{ fontSize: '.72rem', color: 'var(--im-text3)', marginTop: 2 }}>earned this session</div>
        </div>

        <button
          onClick={tryAgain}
          style={{ width: '100%', background: 'var(--im-card)', border: '1px solid var(--im-border)', color: 'var(--im-text)', borderRadius: 12, padding: 14, fontFamily: "'DM Sans',sans-serif", fontSize: '.9rem', cursor: 'pointer', marginBottom: 10 }}
        >
          Try again — faster →
        </button>
        <button
          onClick={() => navigate('/dashboard')}
          style={{ background: 'none', border: 'none', color: 'var(--im-text4)', fontFamily: "'DM Sans',sans-serif", fontSize: '.82rem', cursor: 'pointer', padding: 8 }}
        >
          Back to dashboard
        </button>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // ── SESSION VIEW ──
  return (
    <div className="screen active" id="screen-pressure" style={{ background: 'var(--im-bg)', color: 'var(--im-text)', overflow: 'hidden', flexDirection: 'column' }}>

      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid var(--im-border)', flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: '.75rem', fontWeight: 700, color: 'var(--im-text2)', textTransform: 'uppercase', letterSpacing: '.08em' }}>{scenarioLabel}</div>
          <div style={{ fontSize: '.7rem', color: 'var(--im-text4)', marginTop: 1 }}>{turnLabel}</div>
        </div>
        <button
          onClick={endSession}
          style={{ background: 'var(--im-card)', border: 'none', color: 'var(--im-text2)', fontFamily: "'DM Sans',sans-serif", fontSize: '.78rem', padding: '6px 14px', borderRadius: 20, cursor: 'pointer' }}
        >
          End
        </button>
      </div>

      {/* Main stage */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 20px', gap: 20, overflow: 'hidden' }}>

        {/* AI bubble */}
        <div style={{ width: '100%', maxWidth: 400, background: 'var(--im-card)', border: '1px solid var(--im-border)', borderRadius: '18px 18px 18px 4px', padding: '16px 20px', minHeight: 60, opacity: aiBubble ? 1 : 0.3, transition: 'opacity .3s' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--im-text)', lineHeight: 1.5 }}>{aiBubble}</div>
        </div>

        {/* Timer ring */}
        {timerVisible && (
          <div style={{ position: 'relative', width: 80, height: 80 }}>
            <svg width="80" height="80" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="40" cy="40" r="34" fill="none" stroke="var(--im-border)" strokeWidth="4" />
              <circle
                cx="40" cy="40" r="34" fill="none"
                stroke={timerUrgent ? '#ef4444' : 'var(--accent)'}
                strokeWidth="4"
                strokeDasharray="213.6"
                strokeDashoffset={strokeOffset}
                style={{ transition: 'stroke .3s' }}
              />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', fontWeight: 700, color: timerUrgent ? '#ef4444' : 'var(--im-text)' }}>
              {timerNum}
            </div>
          </div>
        )}

        {/* Mic button */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <button
            onClick={micTap}
            style={{
              width: 72, height: 72, borderRadius: '50%',
              background: sessionPhase === 'user-speaking' ? 'rgba(239,68,68,.2)' : 'var(--im-card)',
              border: `2px solid ${sessionPhase === 'user-speaking' ? 'rgba(239,68,68,.6)' : sessionPhase === 'ai-speaking' ? 'rgba(26,86,219,.5)' : 'var(--im-border)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all .2s',
              boxShadow: sessionPhase === 'user-speaking' ? '0 0 0 8px rgba(239,68,68,.08)' : 'none',
              animation: sessionPhase === 'user-speaking' ? 'pm-pulse 1.2s ease-in-out infinite' : 'none',
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
              stroke={sessionPhase === 'user-speaking' ? '#ef4444' : sessionPhase === 'ai-speaking' ? 'rgba(26,86,219,.8)' : 'var(--im-text2)'}
              strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          </button>
          <div style={{ fontSize: '.75rem', color: 'var(--im-text3)', textAlign: 'center', minHeight: 18 }}>
            {sessionPhase === 'user-speaking' ? '🔴 Listening…' :
             sessionPhase === 'processing' ? 'Processing…' :
             sessionPhase === 'ai-speaking' ? 'AI speaking…' :
             sessionPhase === 'waiting' && !pm.micUnlocked ? 'Tap to unlock mic' :
             sessionPhase === 'waiting' ? 'Speak now' : ''}
          </div>
        </div>

        {/* User bubble */}
        <div style={{ width: '100%', maxWidth: 400, minHeight: 40, opacity: userBubble.visible ? 1 : 0, transition: 'opacity .3s' }}>
          {userBubble.text && (
            <div style={{ background: 'rgba(26,86,219,.25)', border: '1px solid rgba(26,86,219,.4)', borderRadius: '18px 18px 4px 18px', padding: '12px 16px', fontSize: '.95rem', color: 'var(--im-text)', textAlign: 'right' }}>
              {userBubble.text}
            </div>
          )}
        </div>
      </div>

      {/* Status bar */}
      <div style={{ padding: '12px 20px', textAlign: 'center', fontSize: '.72rem', color: 'var(--im-text4)', flexShrink: 0, minHeight: 36 }}>
        {statusText}
      </div>
    </div>
  );
}
