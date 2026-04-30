import { useRef, useCallback } from 'react';
import { WORKER_URL, isSafariIOS } from '../config/constants.js';
import { getValidToken } from '../utils/getValidToken.js';
import { ELEVENLABS_VOICES, getVoiceId as getVoiceIdFromData } from '../data/voices.js';

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

  const speak = useCallback(async ({ text, voiceId, lang, accessToken, natural = false }) => {
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

    // Only use AudioContext on iOS Safari — causes muffling on desktop Chrome
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
      const res = await fetch(`${WORKER_URL}/api/tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(validToken ? { Authorization: `Bearer ${validToken}` } : {}),
        },
        body: JSON.stringify({
          text: clean,
          voice_id: voiceId,
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

      // Only use AudioContext gain boost on iOS Safari — it causes muffling on desktop Chrome
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
