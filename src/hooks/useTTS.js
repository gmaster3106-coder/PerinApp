import { useRef, useCallback } from 'react';
import { WORKER_URL, isSafariIOS } from '../config/constants.js';
import { getValidToken } from '../utils/getValidToken.js';
import { ELEVENLABS_VOICES, getVoiceId as getVoiceIdFromData } from '../data/voices.js';

// Dialect-specific voice settings based on natural speech rate research
function getVoiceSettings(dialect = '', lang = '') {
  const d = (dialect || '').toLowerCase();
  const l = (lang || '').toLowerCase();

  // Caribbean Spanish — fastest, most musical
  if (d.includes('dominican') || d.includes('puerto') || d.includes('cuban') ||
      d.includes('venezuelan') || d.includes('panamanian') || d.includes('caribbean')) {
    return { stability: 0.30, similarity_boost: 0.85, style: 0.20, use_speaker_boost: false };
  }
  // Parisian French — fast, clipped
  if ((l.includes('french') || d.includes('french')) &&
      (d.includes('paris') || d.includes('parisian') || (!d.includes('southern') && !d.includes('provence')))) {
    return { stability: 0.35, similarity_boost: 0.80, style: 0.15, use_speaker_boost: false };
  }
  // Castilian Spanish — moderately fast
  if (d.includes('castilian') || d.includes('spain') || d.includes('madrid')) {
    return { stability: 0.38, similarity_boost: 0.80, style: 0.10, use_speaker_boost: false };
  }
  // Neapolitan — expressive, punchy
  if (d.includes('napolitan') || d.includes('naples') || d.includes('napoli')) {
    return { stability: 0.40, similarity_boost: 0.82, style: 0.18, use_speaker_boost: false };
  }
  // Italian — expressive, moderate
  if (l.includes('italian') || d.includes('italian') || d.includes('sicilian')) {
    return { stability: 0.48, similarity_boost: 0.78, style: 0.10, use_speaker_boost: false };
  }
  // Mexican Spanish — clear, neutral
  if (d.includes('mexican') || d.includes('mexico')) {
    return { stability: 0.50, similarity_boost: 0.78, style: 0.05, use_speaker_boost: false };
  }
  // Brazilian Portuguese — open, moderate
  if (d.includes('brazilian') || d.includes('brazil') || d.includes('carioca')) {
    return { stability: 0.52, similarity_boost: 0.78, style: 0.05, use_speaker_boost: false };
  }
  // Haitian Creole — moderate
  if (l.includes('creole') || d.includes('haiti') || d.includes('haitian')) {
    return { stability: 0.50, similarity_boost: 0.75, style: 0.05, use_speaker_boost: false };
  }
  // Colombian Spanish — slow, clear
  if (d.includes('colombian') || d.includes('colombia') || d.includes('bogot')) {
    return { stability: 0.55, similarity_boost: 0.75, style: 0.05, use_speaker_boost: false };
  }
  // Southern French — slow, melodic
  if (d.includes('southern') || d.includes('provence') || d.includes('marseille')) {
    return { stability: 0.60, similarity_boost: 0.75, style: 0.05, use_speaker_boost: false };
  }
  // European Portuguese — fast but clear
  if (d.includes('european') || d.includes('portugal') || d.includes('lisbon')) {
    return { stability: 0.38, similarity_boost: 0.80, style: 0.08, use_speaker_boost: false };
  }

  // Default
  return { stability: 0.50, similarity_boost: 0.75, style: 0.0, use_speaker_boost: false };
}

// Slow mode settings — for when user explicitly asks to hear it clearly
export const SLOW_VOICE_SETTINGS = {
  stability: 0.75, similarity_boost: 0.75, style: 0.0, use_speaker_boost: false
};

export function useTTS() {
  const currentAudioRef = useRef(null);
  const safariCtxRef = useRef(null);
  const requestIdRef = useRef(0);

  const stopAudio = useCallback(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    requestIdRef.current++;
  }, []);

  const speak = useCallback(async ({ text, voiceId, lang, accessToken, dialect, slow = false }) => {
    if (!text) return;
    stopAudio();

    const clean = text
      .replace(/🔑[^\n]*/g, '').replace(/🪞[^\n]*/g, '').replace(/📝[^\n]*/g, '')
      .replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1')
      .replace(/[\u{1F300}-\u{1FAFF}]/gu, '').trim();
    if (!clean) return;
    if (!voiceId) { speakFallback(clean, lang); return; }
    if (!navigator.onLine) { speakFallback(clean, lang); return; }

    const myId = ++requestIdRef.current;

    let audioCtx = null;
    if (isSafariIOS) {
      try {
        if (safariCtxRef.current?.state === 'running') {
          audioCtx = safariCtxRef.current;
        } else {
          audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          safariCtxRef.current = audioCtx;
          if (audioCtx.state === 'suspended') await audioCtx.resume().catch(() => {});
        }
      } catch { /* no AudioContext support */ }
    }

    try {
      const validToken = await getValidToken();
      const voiceSettings = slow ? SLOW_VOICE_SETTINGS : getVoiceSettings(dialect, lang);

      const res = await fetch(`${WORKER_URL}/api/tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(validToken ? { Authorization: `Bearer ${validToken}` } : {}),
        },
        body: JSON.stringify({
          text: clean,
          voice_id: voiceId,
          voice_settings: voiceSettings,
          ...(lang && lang !== 'ht-HT' ? { language_code: lang.slice(0, 2) } : {}),
        }),
      });

      if (myId !== requestIdRef.current) return;
      if (!res.ok) throw new Error(`TTS ${res.status}`);

      const blob = await res.blob();
      if (myId !== requestIdRef.current) return;

      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);
      audio.volume = 1.0;

      if (isSafariIOS && audioCtx?.state === 'running') {
        try {
          const src = audioCtx.createMediaElementSource(audio);
          const gain = audioCtx.createGain();
          gain.gain.value = 1.35;
          src.connect(gain);
          gain.connect(audioCtx.destination);
        } catch { /* node already connected */ }
      }

      currentAudioRef.current = audio;
      audio.onended = () => { URL.revokeObjectURL(audioUrl); currentAudioRef.current = null; };
      await audio.play().catch(() => speakFallback(clean, lang));
    } catch {
      if (myId !== requestIdRef.current) return;
      if (lang !== 'ht-HT') speakFallback(clean, lang);
    }
  }, []);

  const getVoiceId = useCallback((dialect, lang, scenarioTitle = '') => {
    return getVoiceIdFromData(dialect, lang, scenarioTitle);
  }, []);

  const unlockAudio = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      ctx.resume().then(() => {
        safariCtxRef.current = ctx;
        const buf = ctx.createBuffer(1, 1, 22050);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(ctx.destination);
        src.start(0);
      }).catch(() => ctx.close());
    } catch { /* not supported */ }
  }, []);

  return { speak, stopAudio, getVoiceId, unlockAudio, requestIdRef };
}

function speakFallback(text, lang) {
  if (!window.speechSynthesis) return;
  if (lang === 'ht-HT') return;
  window.speechSynthesis.cancel();
  const clean = isSafariIOS ? text.slice(0, 200) : text;
  const utter = new SpeechSynthesisUtterance(clean);
  if (lang) utter.lang = lang;
  utter.rate = 0.95;
  window.speechSynthesis.speak(utter);
}
