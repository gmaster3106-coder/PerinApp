import { useRef, useState, useCallback } from 'react';
import { WORKER_URL, isSafariIOS } from '../config/constants.js';

function getBestMime() {
  if (isSafariIOS) {
    return MediaRecorder.isTypeSupported?.('audio/mp4') ? 'audio/mp4' : '';
  }
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4;codecs=mp4a.40.2', 'audio/mp4'];
  return types.find(t => MediaRecorder.isTypeSupported?.(t)) || '';
}

function getFilename(mime) {
  if (mime.includes('mp4')) return 'audio.mp4';
  if (mime.includes('ogg')) return 'audio.ogg';
  return 'audio.webm';
}

function createRecorder(stream, mime) {
  if (isSafariIOS) {
    try { return new MediaRecorder(stream); } catch { return null; }
  }
  try {
    return mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
  } catch {
    try { return new MediaRecorder(stream); } catch { return null; }
  }
}

function createSilenceDetector(stream, onSilence, threshold = 25, silenceDuration = 2000) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    ctx.resume().catch(() => {});
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    const data = new Uint8Array(analyser.fftSize);
    let silenceStart = null;
    const interval = setInterval(() => {
      analyser.getByteTimeDomainData(data);
      const avg = data.reduce((s, v) => s + Math.abs(v - 128), 0) / data.length;
      if (avg < threshold) {
        if (!silenceStart) silenceStart = Date.now();
        else if (Date.now() - silenceStart > silenceDuration) {
          clearInterval(interval);
          ctx.close().catch(() => {});
          onSilence();
        }
      } else {
        silenceStart = null;
      }
    }, 100);
    return () => { clearInterval(interval); ctx.close().catch(() => {}); };
  } catch {
    return () => {};
  }
}

export function useMic() {
  const [isRecording, setIsRecording] = useState(false);
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const stopSilenceRef = useRef(null);

  const transcribe = useCallback(async ({ blob, mime, lang, accessToken }) => {
    const form = new FormData();
    form.append('file', blob, getFilename(mime));
    const langCode = lang?.slice(0, 2);
    if (langCode && langCode !== 'en') form.append('language', langCode);

    const res = await fetch(`${WORKER_URL}/api/stt`, {
      method: 'POST',
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      body: form,
    });
    if (!res.ok) throw new Error(`STT ${res.status}`);
    const data = await res.json();
    return (data.text || '').trim();
  }, []);

  const startRecording = useCallback(async ({ lang, accessToken, onResult, onError, onStart }) => {
    if (isRecording) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mime = getBestMime();
      const recorder = createRecorder(stream, mime);
      if (!recorder) {
        stream.getTracks().forEach(t => t.stop());
        onError?.('Mic not supported on this browser');
        return;
      }

      recorderRef.current = recorder;
      const chunks = [];
      const recordingStart = Date.now();

      const SILENCE_THRESHOLD = 30;
      const SILENCE_DURATION = 2200;
      const MIN_RECORDING_MS = 1500;

      recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = async () => {
        stopSilenceRef.current?.();
        stream.getTracks().forEach(t => t.stop());
        setIsRecording(false);

        if (chunks.length === 0) return;
        const blob = new Blob(chunks, { type: mime || 'audio/webm' });
        try {
          const text = await transcribe({ blob, mime, lang, accessToken });
          const HALLUCINATIONS = /^(thank you|thanks|you|the|uh|um|okay|ok|yes|no|bye|hi|hey|hmm|hm|\.+|\s*)$/i;
          if (text && text.length > 1 && !HALLUCINATIONS.test(text)) {
            onResult?.(text);
          }
        } catch (err) {
          onError?.(err.message);
        }
      };

      stopSilenceRef.current = createSilenceDetector(stream, () => {
        if (Date.now() - recordingStart < MIN_RECORDING_MS) return;
        if (recorder.state !== 'inactive') recorder.stop();
      }, SILENCE_THRESHOLD, SILENCE_DURATION);

      recorder.start();
      setIsRecording(true);
      onStart?.();

      // Hard timeout
      setTimeout(() => {
        if (recorder.state !== 'inactive') recorder.stop();
      }, 15000);

    } catch (err) {
      setIsRecording(false);
      onError?.(err.message || 'Microphone error');
    }
  }, [isRecording, transcribe]);

  const stopRecording = useCallback(() => {
    stopSilenceRef.current?.();
    if (recorderRef.current?.state !== 'inactive') {
      recorderRef.current?.stop();
    }
    streamRef.current?.getTracks().forEach(t => t.stop());
    setIsRecording(false);
  }, []);

  return { isRecording, startRecording, stopRecording, transcribe };
}
