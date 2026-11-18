import type { RefObject } from 'react';
import {
  AlertTriangle,
  Camera,
  Mic,
  MicOff,
  Pause,
  Play,
  RotateCcw,
  Square,
  WifiOff,
} from 'lucide-react';
import type { PhraseCatalog } from '../i18n/phrases';
import type { CameraStatus, NavigationDecision } from '../types/vision';

interface CameraViewportProps {
  phrases: PhraseCatalog;
  videoRef: RefObject<HTMLVideoElement | null>;
  cameraStatus: CameraStatus;
  statusMessage: string;
  isOnline: boolean;
  demoMode: boolean;
  isListening: boolean;
  continuousMicActive: boolean;
  isAnswering: boolean;
  latestDecision: NavigationDecision | null;
  lastSpokenText: string;
  errorMessage: string | null;
  spokenLanguageName: string;
  voiceSupported: boolean;
  onStartCamera: () => void;
  onToggleListen: () => void;
  onTogglePause: () => void;
  onRepeatLast: () => void;
  onStopCamera: () => void;
}

export function CameraViewport({
  phrases,
  videoRef,
  cameraStatus,
  statusMessage,
  isOnline,
  demoMode,
  isListening,
  continuousMicActive,
  isAnswering,
  latestDecision,
  lastSpokenText,
  errorMessage,
  spokenLanguageName,
  voiceSupported,
  onStartCamera,
  onToggleListen,
  onTogglePause,
  onRepeatLast,
  onStopCamera,
}: CameraViewportProps) {
  const isCameraRunning = cameraStatus === 'active' || cameraStatus === 'paused';

  const statusTone =
    latestDecision?.urgency === 'danger'
      ? 'border-red-300 bg-red-50 text-red-950'
      : latestDecision?.urgency === 'caution'
        ? 'border-amber-300 bg-amber-50 text-amber-950'
        : 'border-slate-200 bg-slate-50 text-slate-900';

  return (
    <section
      aria-label="VisionGuide AI Assistant"
      className="mx-auto flex w-full max-w-2xl flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8"
    >
      {/* Clean Header Status Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-lg font-bold text-slate-900" role="status" aria-live="polite">
            {statusMessage}
          </p>
          {(continuousMicActive || isListening) && (
            <span
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold ${
                isListening
                  ? 'border-blue-300 bg-blue-50 text-blue-800'
                  : 'border-emerald-300 bg-emerald-50 text-emerald-800'
              }`}
            >
              <Mic className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>
                {isListening ? phrases.status.hearingYou : phrases.status.handsFreeVoiceOn}
              </span>
            </span>
          )}
        </div>
        <span className="text-sm font-medium text-slate-500">
          {spokenLanguageName}
        </span>
      </div>

      {/* Live Rear Camera Preview (only occupies visual frame when active) */}
      <div
        className={`relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 ${
          isCameraRunning ? 'aspect-[4/3] sm:aspect-[16/10]' : 'hidden'
        }`}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          aria-label="Live rear camera preview"
          className="h-full w-full object-cover"
        />
      </div>

      {/* Spoken Response Box */}
      <div
        className={`rounded-2xl border p-5 transition-colors ${statusTone}`}
        role="region"
        aria-live={latestDecision?.urgency === 'danger' ? 'assertive' : 'polite'}
      >
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
          {phrases.ui.lastInstructionLabel}
        </p>
        <p className="mt-2 text-xl font-bold leading-snug text-slate-900 sm:text-2xl">
          {isAnswering
            ? phrases.ui.askThinking
            : lastSpokenText || phrases.ui.noInstructionYet}
        </p>
      </div>

      {/* Offline / Error Banners */}
      {(!isOnline && !demoMode) && (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-base font-bold text-red-900"
        >
          <WifiOff className="h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
          <span>{phrases.status.connectionUnavailable}</span>
        </div>
      )}

      {errorMessage && (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-base font-medium text-red-900"
        >
          <AlertTriangle className="h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Simple Core Buttons */}
      {!isCameraRunning ? (
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={onStartCamera}
            disabled={cameraStatus === 'requesting'}
            className="flex min-h-[76px] w-full items-center justify-center gap-3 rounded-2xl bg-blue-600 px-6 py-4 text-xl font-bold text-white shadow-sm transition-colors hover:bg-blue-700 active:scale-[0.99] disabled:opacity-60"
          >
            <Camera className="h-7 w-7 shrink-0" aria-hidden="true" />
            <span>
              {cameraStatus === 'requesting'
                ? phrases.status.requestingPermission
                : phrases.controls.startCamera}
            </span>
          </button>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={onToggleListen}
              disabled={!voiceSupported && !isListening}
              aria-pressed={isListening}
              className={`flex min-h-[60px] w-full items-center justify-center gap-2.5 rounded-2xl border px-5 py-3 text-lg font-bold transition-colors ${
                isListening
                  ? 'border-red-600 bg-red-600 text-white hover:bg-red-700'
                  : 'border-slate-300 bg-white text-slate-900 hover:bg-slate-50 disabled:opacity-50'
              }`}
            >
              {isListening ? (
                <>
                  <MicOff className="h-5 w-5 shrink-0" aria-hidden="true" />
                  <span>{phrases.controls.listeningNow}</span>
                </>
              ) : (
                <>
                  <Mic className="h-5 w-5 shrink-0 text-blue-600" aria-hidden="true" />
                  <span>{phrases.controls.askTapToSpeak}</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onRepeatLast}
              className="flex min-h-[60px] w-full items-center justify-center gap-2.5 rounded-2xl border border-slate-300 bg-white px-5 py-3 text-lg font-bold text-slate-900 transition-colors hover:bg-slate-50"
            >
              <RotateCcw className="h-5 w-5 shrink-0 text-blue-600" aria-hidden="true" />
              <span>{phrases.controls.repeatLast}</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {/* Primary Voice Talk Button */}
          <button
            type="button"
            onClick={onToggleListen}
            disabled={!voiceSupported && !isListening}
            aria-pressed={isListening}
            className={`flex min-h-[72px] w-full items-center justify-center gap-3 rounded-2xl px-6 py-4 text-xl font-bold shadow-sm transition-colors ${
              isListening
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50'
            }`}
          >
            {isListening ? (
              <>
                <MicOff className="h-6 w-6 shrink-0" aria-hidden="true" />
                <span>{phrases.controls.listeningNow}</span>
              </>
            ) : (
              <>
                <Mic className="h-6 w-6 shrink-0" aria-hidden="true" />
                <span>{phrases.controls.askTapToSpeak}</span>
              </>
            )}
          </button>

          {/* Pause, Repeat Last, Stop Assistant */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <button
              type="button"
              onClick={onTogglePause}
              aria-pressed={cameraStatus === 'paused'}
              className="flex min-h-[58px] w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-bold text-slate-900 transition-colors hover:bg-slate-50"
            >
              {cameraStatus === 'paused' ? (
                <>
                  <Play className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
                  <span>{phrases.controls.resumeAi}</span>
                </>
              ) : (
                <>
                  <Pause className="h-5 w-5 shrink-0 text-blue-600" aria-hidden="true" />
                  <span>{phrases.controls.pauseAi}</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onRepeatLast}
              className="flex min-h-[58px] w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-bold text-slate-900 transition-colors hover:bg-slate-50"
            >
              <RotateCcw className="h-5 w-5 shrink-0 text-blue-600" aria-hidden="true" />
              <span>{phrases.controls.repeatLast}</span>
            </button>

            <button
              type="button"
              onClick={onStopCamera}
              className="flex min-h-[58px] w-full items-center justify-center gap-2 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-base font-bold text-red-800 transition-colors hover:bg-red-100"
            >
              <Square className="h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
              <span>{phrases.controls.stopCamera}</span>
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
