import { getPhrases } from '../i18n/phrases';
import { PriorityLevel, type AppSettings } from '../types/vision';

export interface SpeakOptions {
  priority?: PriorityLevel;
  hapticPattern?: number[];
  recordAsLastInstruction?: boolean;
  interrupt?: boolean;
  isConversationReply?: boolean;
  dedupKey?: string;
  languageTagOverride?: string;
}

export interface VoiceRecordingResult {
  audioBase64: string;
  mimeType: string;
}

function encodeMonoWavBase64(samples: Float32Array, sourceSampleRate: number): string {
  const targetRate = 16000;
  const ratio = sourceSampleRate / targetRate;
  const targetLength = Math.max(1, Math.floor(samples.length / ratio));
  const buffer = new ArrayBuffer(44 + targetLength * 2);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i += 1) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + targetLength * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, targetRate, true);
  view.setUint32(28, targetRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, targetLength * 2, true);

  let offset = 44;
  for (let i = 0; i < targetLength; i += 1) {
    const srcIdx = Math.min(samples.length - 1, Math.floor(i * ratio));
    const clamped = Math.max(-1, Math.min(1, samples[srcIdx]));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += 2;
  }

  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export class SpeechManager {
  private lastInstruction = '';
  private voices: SpeechSynthesisVoice[] = [];
  private listeners = new Set<() => void>();
  private speaking = false;
  private currentIsReply = false;
  private activeDedupKey = '';
  private lastSpeechEndedAt = 0;
  private utteranceSeq = 0;
  private speakDelayTimer: number | null = null;
  private watchdogTimer: number | null = null;
  private queuedSpeech: {
    text: string;
    settings: AppSettings;
    options: SpeakOptions;
  } | null = null;

  // Manual one-shot MediaRecorder capture
  private mediaRecorder: MediaRecorder | null = null;
  private micStream: MediaStream | null = null;
  private audioCtx: AudioContext | null = null;
  private silenceTimer: number | null = null;
  private maxRecordTimer: number | null = null;
  private vadRafId: number | null = null;
  private peakRms = 0;
  private vadActive = false;

  // Continuous hands-free WAV ring-buffer listener
  private continuousStream: MediaStream | null = null;
  private continuousCtx: AudioContext | null = null;
  private continuousProcessor: ScriptProcessorNode | null = null;
  private continuousPaused = false;
  private isCapturingUtterance = false;
  private continuousFlushFn: (() => void) | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.refreshVoices();
      window.speechSynthesis.addEventListener('voiceschanged', this.handleVoicesChanged);
    }
  }

  private handleVoicesChanged = () => {
    this.refreshVoices();
    this.notify();
  };

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((fn) => fn());
  }

  public isSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  public isListeningSupported(): boolean {
    return (
      typeof navigator !== 'undefined' &&
      Boolean(navigator.mediaDevices) &&
      typeof navigator.mediaDevices.getUserMedia === 'function'
    );
  }

  public isContinuousListeningActive(): boolean {
    return Boolean(this.continuousStream && !this.continuousPaused);
  }

  public refreshVoices(): SpeechSynthesisVoice[] {
    if (!this.isSupported()) return [];
    this.voices = window.speechSynthesis.getVoices();
    return this.voices;
  }

  public getVoices(languageTag?: string): SpeechSynthesisVoice[] {
    if (this.voices.length === 0) {
      this.refreshVoices();
    }
    if (!languageTag) return this.voices;
    const prefix = languageTag.split('-')[0].toLowerCase();
    const matching = this.voices.filter((v) => v.lang.toLowerCase().startsWith(prefix));
    return matching.length > 0 ? matching : this.voices;
  }

  public getLastInstruction(): string {
    return this.lastInstruction;
  }

  public isSpeaking(): boolean {
    return this.speaking || this.speakDelayTimer !== null;
  }

  public isSpeakingReply(): boolean {
    return this.isSpeaking() && this.currentIsReply;
  }

  public getLastSpeechEndedAt(): number {
    return this.lastSpeechEndedAt;
  }

  public speak(text: string, settings: AppSettings, options: SpeakOptions = {}): void {
    const cleanText = text.trim();
    if (!cleanText) return;

    const {
      priority = PriorityLevel.NAVIGATION_INSTRUCTION,
      hapticPattern,
      recordAsLastInstruction = true,
      interrupt = false,
      dedupKey = '',
    } = options;

    // Never interrupt ourselves with the exact same active warning
    if (dedupKey && dedupKey === this.activeDedupKey && this.isSpeaking()) {
      return;
    }

    if (settings.muted || !this.isSupported()) {
      if (recordAsLastInstruction) {
        this.lastInstruction = cleanText;
        this.notify();
      }
      if (settings.vibrationEnabled && hapticPattern && hapticPattern.length > 0) {
        this.vibrate(hapticPattern);
      }
      return;
    }

    const synth = window.speechSynthesis;
    const busy = this.speaking || this.speakDelayTimer !== null || synth.speaking || synth.pending;

    if (busy && !interrupt) {
      // Wait for current answer/instruction to finish completely; keep latest queued item
      if (!this.currentIsReply || priority === PriorityLevel.IMMEDIATE_DANGER || options.isConversationReply) {
        this.queuedSpeech = { text: cleanText, settings, options };
      }
      return;
    }

    // Interrupt only when explicitly requested (user reply, button press, or urgent danger)
    this.queuedSpeech = null;
    this.clearSpeechTimers();
    this.utteranceSeq += 1;

    if (busy) {
      synth.cancel();
      this.speaking = false;
      this.speakDelayTimer = window.setTimeout(() => {
        this.speakDelayTimer = null;
        this.speakNow(cleanText, settings, options);
      }, 60);
    } else {
      this.speakNow(cleanText, settings, options);
    }
  }

  private clearSpeechTimers(): void {
    if (this.speakDelayTimer !== null) {
      window.clearTimeout(this.speakDelayTimer);
      this.speakDelayTimer = null;
    }
    if (this.watchdogTimer !== null) {
      window.clearTimeout(this.watchdogTimer);
      this.watchdogTimer = null;
    }
  }

  private speakNow(text: string, settings: AppSettings, options: SpeakOptions): void {
    const {
      hapticPattern,
      recordAsLastInstruction = true,
      isConversationReply = false,
      dedupKey = '',
      languageTagOverride,
    } = options;

    if (recordAsLastInstruction) {
      this.lastInstruction = text;
      this.notify();
    }

    if (settings.vibrationEnabled && hapticPattern && hapticPattern.length > 0) {
      this.vibrate(hapticPattern);
    }

    if (settings.muted || !this.isSupported()) {
      return;
    }

    const activeTag =
      languageTagOverride?.trim() ||
      settings.spokenLanguageTag?.trim() ||
      (settings.language === 'hi' ? 'hi-IN' : 'en-US');

    const synth = window.speechSynthesis;
    const mySeq = ++this.utteranceSeq;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = settings.speechSpeed;
    utterance.volume = settings.volume;
    utterance.lang = activeTag;

    const available = this.getVoices();
    const langPrefix = activeTag.split('-')[0].toLowerCase();
    if (!languageTagOverride && settings.voiceURI) {
      const selected = available.find((v) => v.voiceURI === settings.voiceURI);
      if (selected && selected.lang.toLowerCase().startsWith(langPrefix)) {
        utterance.voice = selected;
      }
    }
    if (!utterance.voice) {
      const preferred =
        available.find((v) => v.lang.toLowerCase() === activeTag.toLowerCase()) ??
        available.find((v) => v.lang.toLowerCase().startsWith(langPrefix) && v.default) ??
        available.find((v) => v.lang.toLowerCase().startsWith(langPrefix));
      if (preferred) utterance.voice = preferred;
    }

    const finishUtterance = () => {
      if (mySeq !== this.utteranceSeq) return;
      if (this.watchdogTimer !== null) {
        window.clearTimeout(this.watchdogTimer);
        this.watchdogTimer = null;
      }
      this.speaking = false;
      this.currentIsReply = false;
      this.activeDedupKey = '';
      this.lastSpeechEndedAt = Date.now();
      this.notify();

      const next = this.queuedSpeech;
      if (next) {
        this.queuedSpeech = null;
        this.speakDelayTimer = window.setTimeout(() => {
          this.speakDelayTimer = null;
          this.speakNow(next.text, next.settings, next.options);
        }, 150);
      }
    };

    utterance.onstart = () => {
      if (mySeq !== this.utteranceSeq) return;
      this.speaking = true;
      this.currentIsReply = isConversationReply;
      this.activeDedupKey = dedupKey;
      this.notify();
    };
    utterance.onend = finishUtterance;
    utterance.onerror = finishUtterance;

    this.speaking = true;
    this.currentIsReply = isConversationReply;
    this.activeDedupKey = dedupKey;
    this.notify();

    // Watchdog in case browser Web Speech hangs without firing onend
    const maxDurationMs = Math.max(4500, Math.min(20000, text.length * 160));
    this.watchdogTimer = window.setTimeout(finishUtterance, maxDurationMs);

    try {
      synth.speak(utterance);
    } catch {
      finishUtterance();
    }
  }

  /**
   * Starts hands-free continuous voice listening using a 16kHz WAV ring buffer
   * so the user can speak naturally at any time once Start Assistant is tapped.
   */
  public async startContinuousListening(callbacks: {
    onSpeechStart: () => void;
    onAudioReady: (result: VoiceRecordingResult) => void;
    onError: (message: string) => void;
  }): Promise<boolean> {
    if (!this.isListeningSupported()) {
      callbacks.onError('Microphone is not supported in this browser.');
      return false;
    }

    this.stopContinuousListening();
    this.stopVoiceCapture(false);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) {
        for (const t of stream.getTracks()) t.stop();
        callbacks.onError('Web Audio API unavailable for continuous listening.');
        return false;
      }

      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        await ctx.resume().catch(() => {});
      }

      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);

      // Mute pass-through gain so no mic feedback loops to speakers
      const zeroGain = ctx.createGain();
      zeroGain.gain.value = 0;

      source.connect(processor);
      processor.connect(zeroGain);
      zeroGain.connect(ctx.destination);

      this.continuousStream = stream;
      this.continuousCtx = ctx;
      this.continuousProcessor = processor;
      this.continuousPaused = false;
      this.isCapturingUtterance = false;

      const sampleRate = ctx.sampleRate;
      const preRollMaxSamples = Math.floor(sampleRate * 0.55);
      const maxUtteranceSamples = Math.floor(sampleRate * 10);

      let preRollChunks: Float32Array[] = [];
      let preRollSamples = 0;
      let utteranceChunks: Float32Array[] = [];
      let utteranceSamples = 0;
      let speechFrames = 0;
      let lastLoudAt = 0;

      const resetCaptureState = () => {
        this.isCapturingUtterance = false;
        utteranceChunks = [];
        utteranceSamples = 0;
        speechFrames = 0;
        lastLoudAt = 0;
      };

      const finalizeUtterance = () => {
        if (utteranceChunks.length === 0 || speechFrames < 2) {
          resetCaptureState();
          return;
        }
        const combined = new Float32Array(utteranceSamples);
        let offset = 0;
        for (const chunk of utteranceChunks) {
          combined.set(chunk, offset);
          offset += chunk.length;
        }
        resetCaptureState();
        const wavBase64 = encodeMonoWavBase64(combined, sampleRate);
        callbacks.onAudioReady({
          audioBase64: wavBase64,
          mimeType: 'audio/wav',
        });
      };

      this.continuousFlushFn = () => {
        if (this.isCapturingUtterance) {
          finalizeUtterance();
        }
      };

      processor.onaudioprocess = (event) => {
        if (this.continuousPaused) return;

        // Echo gate: ignore audio while TTS is playing and for 450ms after it finishes
        const now = Date.now();
        if (this.speaking || now - this.lastSpeechEndedAt < 450) {
          if (this.isCapturingUtterance) {
            resetCaptureState();
          }
          return;
        }

        const input = event.inputBuffer.getChannelData(0);
        const copy = new Float32Array(input.length);
        copy.set(input);

        let sumSq = 0;
        for (let i = 0; i < copy.length; i += 1) {
          sumSq += copy[i] * copy[i];
        }
        const rms = Math.sqrt(sumSq / copy.length);

        if (!this.isCapturingUtterance) {
          // Maintain ~550ms pre-roll ring buffer
          preRollChunks.push(copy);
          preRollSamples += copy.length;
          while (preRollSamples > preRollMaxSamples && preRollChunks.length > 1) {
            const removed = preRollChunks.shift();
            if (removed) preRollSamples -= removed.length;
          }

          if (rms > 0.03) {
            this.isCapturingUtterance = true;
            utteranceChunks = [...preRollChunks];
            utteranceSamples = preRollSamples;
            preRollChunks = [];
            preRollSamples = 0;
            speechFrames = 1;
            lastLoudAt = now;
            callbacks.onSpeechStart();
          }
        } else {
          utteranceChunks.push(copy);
          utteranceSamples += copy.length;
          if (rms > 0.022) {
            speechFrames += 1;
            lastLoudAt = now;
          }

          if (now - lastLoudAt > 950 || utteranceSamples >= maxUtteranceSamples) {
            finalizeUtterance();
          }
        }
      };

      this.notify();
      return true;
    } catch (err) {
      this.stopContinuousListening();
      const domName = err instanceof DOMException ? err.name : '';
      if (domName === 'NotAllowedError' || domName === 'PermissionDeniedError') {
        callbacks.onError(
          'Microphone is blocked. Tap the lock or settings icon in your browser address bar, set Microphone to Allow, then reload or tap Talk to Assistant.'
        );
      } else if (domName === 'NotFoundError' || domName === 'DevicesNotFoundError') {
        callbacks.onError('No microphone found on this device.');
      } else {
        callbacks.onError(
          err instanceof Error ? err.message : 'Unable to start microphone.'
        );
      }
      return false;
    }
  }

  public setContinuousListeningPaused(paused: boolean): void {
    this.continuousPaused = paused;
    this.isCapturingUtterance = false;
    this.notify();
  }

  public flushContinuousUtterance(): void {
    this.continuousFlushFn?.();
  }

  public stopContinuousListening(): void {
    this.isCapturingUtterance = false;
    this.continuousPaused = false;
    this.continuousFlushFn = null;
    if (this.continuousProcessor) {
      this.continuousProcessor.onaudioprocess = null;
      try {
        this.continuousProcessor.disconnect();
      } catch {
        // Ignore disconnect errors
      }
      this.continuousProcessor = null;
    }
    if (this.continuousStream) {
      for (const track of this.continuousStream.getTracks()) {
        track.stop();
      }
      this.continuousStream = null;
    }
    if (this.continuousCtx) {
      void this.continuousCtx.close().catch(() => {});
      this.continuousCtx = null;
    }
    this.notify();
  }

  /**
   * One-shot push-to-talk capture when the assistant camera isn't started yet
   * or when the user manually taps Talk to Assistant.
   */
  public async startVoiceCapture(callbacks: {
    onAudioReady: (result: VoiceRecordingResult) => void;
    onError: (message: string) => void;
  }): Promise<boolean> {
    if (!this.isListeningSupported() || typeof MediaRecorder === 'undefined') {
      callbacks.onError('Microphone recording is not supported in this browser.');
      return false;
    }

    this.stopVoiceCapture(false);
    this.stop();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      this.micStream = stream;
      const mimeType = this.pickAudioMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          chunks.push(ev.data);
        }
      };

      recorder.onerror = () => {
        this.cleanupMicResources();
        callbacks.onError('Microphone recording failed.');
      };

      recorder.onstop = () => {
        const finalMime = recorder.mimeType || mimeType || 'audio/webm';
        const capturedPeak = this.peakRms;
        const wasVadActive = this.vadActive;
        this.cleanupMicResources();

        if (chunks.length === 0) {
          callbacks.onError('No audio captured. Please try speaking again.');
          return;
        }

        const blob = new Blob(chunks, { type: finalMime });
        if (blob.size < 400 || (wasVadActive && capturedPeak < 0.01)) {
          callbacks.onError('Could not hear speech. Please speak clearly into your microphone.');
          return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = typeof reader.result === 'string' ? reader.result : '';
          const commaIdx = dataUrl.indexOf(',');
          if (commaIdx === -1) {
            callbacks.onError('Could not process recorded audio.');
            return;
          }
          callbacks.onAudioReady({
            audioBase64: dataUrl.slice(commaIdx + 1),
            mimeType: finalMime.split(';')[0] || 'audio/webm',
          });
        };
        reader.onerror = () => {
          callbacks.onError('Failed to read recorded audio.');
        };
        reader.readAsDataURL(blob);
      };

      this.mediaRecorder = recorder;
      this.peakRms = 0;
      this.vadActive = false;
      recorder.start(150);
      this.vibrate([35]);
      this.startSilenceMonitor(stream);

      this.maxRecordTimer = window.setTimeout(() => {
        this.stopVoiceCapture(true);
      }, 12000);

      return true;
    } catch (err) {
      this.cleanupMicResources();
      const domName = err instanceof DOMException ? err.name : '';
      if (domName === 'NotAllowedError' || domName === 'PermissionDeniedError') {
        callbacks.onError('Microphone permission denied. Allow microphone access in browser settings.');
      } else if (domName === 'NotFoundError' || domName === 'DevicesNotFoundError') {
        callbacks.onError('No microphone found on this device.');
      } else {
        callbacks.onError(
          err instanceof Error ? err.message : 'Unable to access microphone.'
        );
      }
      return false;
    }
  }

  public stopVoiceCapture(deliverAudio = true): void {
    if (this.silenceTimer !== null) {
      window.clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    if (this.maxRecordTimer !== null) {
      window.clearTimeout(this.maxRecordTimer);
      this.maxRecordTimer = null;
    }
    if (this.vadRafId !== null) {
      window.cancelAnimationFrame(this.vadRafId);
      this.vadRafId = null;
    }

    const recorder = this.mediaRecorder;
    if (recorder && recorder.state !== 'inactive') {
      if (!deliverAudio) {
        recorder.ondataavailable = null;
        recorder.onstop = null;
        try {
          recorder.stop();
        } catch {
          // Ignore stop errors
        }
        this.cleanupMicResources();
      } else {
        try {
          recorder.stop();
        } catch {
          this.cleanupMicResources();
        }
      }
    } else if (!deliverAudio) {
      this.cleanupMicResources();
    }
  }

  private startSilenceMonitor(stream: MediaStream): void {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    try {
      const ctx = new AudioCtx();
      this.audioCtx = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);

      const data = new Uint8Array(analyser.fftSize);
      let heardSpeech = false;
      let silenceStartedAt = 0;
      const startedAt = Date.now();

      const checkLevel = () => {
        if (!this.mediaRecorder || this.mediaRecorder.state !== 'recording') return;
        if (ctx.state === 'running') {
          this.vadActive = true;
        }

        analyser.getByteTimeDomainData(data);
        let sumSq = 0;
        for (let i = 0; i < data.length; i += 1) {
          const centered = (data[i] - 128) / 128;
          sumSq += centered * centered;
        }
        const rms = Math.sqrt(sumSq / data.length);
        if (rms > this.peakRms) {
          this.peakRms = rms;
        }

        const now = Date.now();
        if (rms > 0.025) {
          heardSpeech = true;
          silenceStartedAt = 0;
        } else if (heardSpeech && now - startedAt > 900) {
          if (silenceStartedAt === 0) {
            silenceStartedAt = now;
          } else if (now - silenceStartedAt > 1150) {
            this.stopVoiceCapture(true);
            return;
          }
        }

        this.vadRafId = window.requestAnimationFrame(checkLevel);
      };

      this.vadRafId = window.requestAnimationFrame(checkLevel);
    } catch {
      // Ignore Web Audio errors
    }
  }

  private pickAudioMimeType(): string {
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
    ];
    for (const mime of candidates) {
      if (MediaRecorder.isTypeSupported(mime)) {
        return mime;
      }
    }
    return '';
  }

  private cleanupMicResources(): void {
    if (this.silenceTimer !== null) {
      window.clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    if (this.maxRecordTimer !== null) {
      window.clearTimeout(this.maxRecordTimer);
      this.maxRecordTimer = null;
    }
    if (this.vadRafId !== null) {
      window.cancelAnimationFrame(this.vadRafId);
      this.vadRafId = null;
    }
    if (this.micStream) {
      for (const track of this.micStream.getTracks()) {
        track.stop();
      }
      this.micStream = null;
    }
    if (this.audioCtx) {
      void this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
    this.mediaRecorder = null;
  }

  public repeatLastInstruction(settings: AppSettings): string {
    const phrases = getPhrases(settings.language);
    const text = this.lastInstruction || phrases.spoken.noPreviousInstruction;
    this.speak(text, settings, {
      priority: PriorityLevel.NAVIGATION_INSTRUCTION,
      recordAsLastInstruction: Boolean(this.lastInstruction),
      interrupt: true,
      hapticPattern: [40],
    });
    return text;
  }

  public stop(): void {
    this.queuedSpeech = null;
    this.clearSpeechTimers();
    this.utteranceSeq += 1;
    if (this.isSupported()) {
      window.speechSynthesis.cancel();
    }
    this.speaking = false;
    this.currentIsReply = false;
    this.activeDedupKey = '';
    this.lastSpeechEndedAt = Date.now();
    this.notify();
  }

  public vibrate(pattern: number[]): void {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(pattern);
      } catch {
        // Ignore vibration failures
      }
    }
  }

  public destroy(): void {
    this.stopContinuousListening();
    this.stopVoiceCapture(false);
    if (this.isSupported()) {
      window.speechSynthesis.removeEventListener('voiceschanged', this.handleVoicesChanged);
    }
    this.stop();
  }
}

export const speechManager = new SpeechManager();
