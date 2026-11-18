import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { CameraViewport } from './components/CameraViewport';
import { DemoModePanel } from './components/DemoModePanel';
import { MobileBottomNav } from './components/MobileBottomNav';
import { SettingsView } from './components/SettingsView';
import { TopBar, type ActiveView } from './components/TopBar';
import { getPhrases } from './i18n/phrases';
import { cameraManager } from './modules/CameraManager';
import { navigationEngine } from './modules/NavigationEngine';
import { settingsManager } from './modules/SettingsManager';
import { speechManager } from './modules/SpeechManager';
import { uiManager } from './modules/UIManager';
import {
  analyzeFrame,
  askAssistant,
  isAnalysisInFlight,
  simulateDemoScenario,
  VisionAnalyzerError,
} from './modules/VisionAnalyzer';
import {
  PriorityLevel,
  type AppSettings,
  type CameraStatus,
  type ConversationMessage,
  type DemoScenarioId,
  type NavigationDecision,
  type VisionAnalysisResult,
} from './types/vision';

export default function App() {
  const [settings, setSettings] = useState<AppSettings>(() => settingsManager.getSettings());
  const [activeView, setActiveView] = useState<ActiveView>('monitor');
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('inactive');
  const [isOnline, setIsOnline] = useState<boolean>(() => uiManager.isOnline());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [latestAnalysis, setLatestAnalysis] = useState<VisionAnalysisResult | null>(null);
  const [latestDecision, setLatestDecision] = useState<NavigationDecision | null>(null);
  const [lastSpokenText, setLastSpokenText] = useState<string>('');
  const [activeDemoScenario, setActiveDemoScenario] = useState<DemoScenarioId | null>(null);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [continuousMicActive, setContinuousMicActive] = useState<boolean>(false);
  const [isAnswering, setIsAnswering] = useState<boolean>(false);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() =>
    speechManager.getVoices(settings.spokenLanguageTag)
  );

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const offlineNotifiedRef = useRef<boolean>(false);
  const lastLocalWallAlertAtRef = useRef<number>(0);
  const lastAiSuccessAtRef = useRef<number>(0);
  const manualListeningRef = useRef<boolean>(false);
  const cameraStatusRef = useRef<CameraStatus>(cameraStatus);
  const processAudioRef = useRef<
    (payload: { question?: string; audioBase64?: string; audioMimeType?: string }) => Promise<void>
  >(async () => {});

  useEffect(() => {
    cameraStatusRef.current = cameraStatus;
  }, [cameraStatus]);

  const phrases = useMemo(() => getPhrases(settings.language), [settings.language]);
  const voiceSupported = speechManager.isListeningSupported();

  useEffect(() => {
    setVoices(speechManager.getVoices(settings.spokenLanguageTag));
    const unsubscribe = speechManager.subscribe(() => {
      setVoices(speechManager.getVoices(settings.spokenLanguageTag));
      const spoken = speechManager.getLastInstruction();
      if (spoken) {
        setLastSpokenText(spoken);
      }
    });
    return unsubscribe;
  }, [settings.spokenLanguageTag]);

  useEffect(() => {
    return uiManager.subscribeNetworkStatus((online) => {
      setIsOnline(online);
      if (online) {
        offlineNotifiedRef.current = false;
        setErrorMessage((prev) =>
          prev === phrases.status.connectionUnavailable ? null : prev
        );
      }
    });
  }, [phrases.status.connectionUnavailable]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      cameraManager.stop();
      speechManager.destroy();
    };
  }, []);

  const handleUpdateSettings = useCallback((partial: Partial<AppSettings>) => {
    const updated = settingsManager.updateSettings(partial);
    setSettings(updated);
  }, []);

  const handleResetSettings = useCallback(() => {
    const reset = settingsManager.reset();
    setSettings(reset);
    navigationEngine.resetHistory();
  }, []);

  const handleStopCamera = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    cameraManager.stop();
    speechManager.stopContinuousListening();
    speechManager.stopVoiceCapture(false);
    manualListeningRef.current = false;
    setIsListening(false);
    setContinuousMicActive(false);

    const prev = cameraStatusRef.current;
    setCameraStatus('inactive');
    if (prev === 'active' || prev === 'paused' || prev === 'requesting') {
      const currentSettings = settingsManager.getSettings();
      const currentPhrases = getPhrases(currentSettings.language);
      speechManager.speak(currentPhrases.spoken.cameraStopped, currentSettings, {
        priority: PriorityLevel.NAVIGATION_INSTRUCTION,
        recordAsLastInstruction: false,
        interrupt: true,
        hapticPattern: [40],
      });
    }
  }, []);

  const handleStartCamera = useCallback(async () => {
    setActiveView('monitor');
    setErrorMessage(null);

    if (settings.demoMode) {
      handleUpdateSettings({ demoMode: false });
      setActiveDemoScenario(null);
    }

    setCameraStatus('requesting');

    if (!videoRef.current) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }

    const videoEl = videoRef.current;
    if (!videoEl) {
      setCameraStatus('error');
      setErrorMessage(phrases.status.cameraUnavailable);
      return;
    }

    try {
      let micErrorNotice: string | null = null;
      const cameraPromise = cameraManager.startRearCamera(videoEl);
      const micPromise = speechManager.startContinuousListening({
        onSpeechStart: () => {
          setIsListening(true);
        },
        onAudioReady: (audio) => {
          setIsListening(false);
          void processAudioRef.current({
            audioBase64: audio.audioBase64,
            audioMimeType: audio.mimeType,
          });
        },
        onError: (errMsg) => {
          setIsListening(false);
          setContinuousMicActive(false);
          micErrorNotice = errMsg;
          setErrorMessage(errMsg);
        },
      });

      const [, micStarted] = await Promise.all([cameraPromise, micPromise]);

      navigationEngine.resetHistory();
      lastAiSuccessAtRef.current = 0;

      setContinuousMicActive(micStarted);
      setCameraStatus('active');

      const welcomeText = micStarted
        ? phrases.spoken.cameraStarted
        : micErrorNotice
          ? `${phrases.spoken.cameraStarted} ${micErrorNotice}`
          : phrases.spoken.cameraStarted;

      speechManager.speak(welcomeText, settings, {
        priority: PriorityLevel.NAVIGATION_INSTRUCTION,
        recordAsLastInstruction: true,
        interrupt: true,
        hapticPattern: [60, 40, 60],
      });
    } catch (err) {
      speechManager.stopContinuousListening();
      setContinuousMicActive(false);
      setIsListening(false);
      setCameraStatus('error');
      const code =
        err && typeof err === 'object' && 'code' in err
          ? (err as { code?: string }).code
          : 'UNKNOWN';
      const msg =
        code === 'PERMISSION_DENIED'
          ? phrases.status.cameraDenied
          : code === 'NOT_FOUND'
            ? phrases.status.cameraUnavailable
            : err instanceof Error
              ? err.message
              : phrases.status.cameraUnavailable;
      setErrorMessage(msg);
      speechManager.speak(msg, settings, {
        priority: PriorityLevel.IMMEDIATE_DANGER,
        recordAsLastInstruction: false,
        interrupt: true,
      });
    }
  }, [handleUpdateSettings, phrases, settings]);

  const handleTogglePause = useCallback(() => {
    if (cameraStatus === 'active') {
      abortControllerRef.current?.abort();
      speechManager.setContinuousListeningPaused(true);
      setIsListening(false);
      setCameraStatus('paused');
      speechManager.speak(phrases.spoken.aiPaused, settings, {
        priority: PriorityLevel.NAVIGATION_INSTRUCTION,
        recordAsLastInstruction: false,
        interrupt: true,
        hapticPattern: [40],
      });
      return;
    }
    if (cameraStatus === 'paused') {
      speechManager.setContinuousListeningPaused(false);
      setCameraStatus('active');
      speechManager.speak(phrases.spoken.aiResumed, settings, {
        priority: PriorityLevel.NAVIGATION_INSTRUCTION,
        recordAsLastInstruction: false,
        interrupt: true,
        hapticPattern: [40, 40],
      });
    }
  }, [cameraStatus, phrases, settings]);

  const handleRepeatLast = useCallback(() => {
    const repeated = speechManager.repeatLastInstruction(settings);
    if (repeated) {
      setLastSpokenText(repeated);
    }
  }, [settings]);

  const handleToggleMute = useCallback(() => {
    const nextMuted = !settings.muted;
    if (nextMuted) {
      speechManager.stop();
    }
    handleUpdateSettings({ muted: nextMuted });
  }, [handleUpdateSettings, settings.muted]);

  const handleTestVoice = useCallback(() => {
    speechManager.speak(phrases.spoken.clearPath, settings, {
      priority: PriorityLevel.NAVIGATION_INSTRUCTION,
      recordAsLastInstruction: true,
      interrupt: true,
      hapticPattern: [50],
    });
  }, [phrases.spoken.clearPath, settings]);

  const handleProcessAudioOrText = useCallback(
    async (payload: { question?: string; audioBase64?: string; audioMimeType?: string }) => {
      const trimmed = payload.question?.trim() ?? '';
      if (!trimmed && !payload.audioBase64) return;

      if (!isOnline) {
        setLastSpokenText(phrases.spoken.connectionUnavailable);
        speechManager.speak(phrases.spoken.connectionUnavailable, settings, {
          priority: PriorityLevel.IMMEDIATE_DANGER,
          interrupt: true,
        });
        return;
      }

      abortControllerRef.current?.abort();
      setErrorMessage(null);
      setIsAnswering(true);
      try {
        const currentFrame =
          cameraStatus === 'active' || cameraStatus === 'paused'
            ? cameraManager.captureFrame()
            : null;

        const {
          transcript,
          reply,
          detectedLanguageTag,
          switchLanguageName,
          switchLanguageTag,
        } = await askAssistant({
          question: trimmed || undefined,
          audioBase64: payload.audioBase64,
          audioMimeType: payload.audioMimeType,
          imageFrame: currentFrame,
          spokenLanguageName: settings.spokenLanguageName,
          history: messages,
          demoSceneSummary: settings.demoMode ? latestAnalysis?.sceneSummary : undefined,
        });

        let activeSettings = settings;
        if (switchLanguageName && switchLanguageTag) {
          activeSettings = settingsManager.updateSettings({
            spokenLanguageName: switchLanguageName,
            spokenLanguageTag: switchLanguageTag,
            voiceURI: '',
          });
          setSettings(activeSettings);
          navigationEngine.resetHistory();
        }

        const spokenTranscript = trimmed || transcript || '';
        setMessages((prev) => [
          ...prev,
          ...(spokenTranscript
            ? [{ id: `u-${Date.now()}`, role: 'user' as const, text: spokenTranscript, timestamp: Date.now() }]
            : []),
          { id: `a-${Date.now() + 1}`, role: 'assistant' as const, text: reply, timestamp: Date.now() },
        ]);

        setLastSpokenText(reply);
        speechManager.speak(reply, activeSettings, {
          priority: PriorityLevel.IMMEDIATE_DANGER,
          recordAsLastInstruction: true,
          interrupt: true,
          isConversationReply: true,
          hapticPattern: [50],
          languageTagOverride: switchLanguageTag || detectedLanguageTag,
        });
      } catch (err) {
        const errText =
          err instanceof VisionAnalyzerError && err.code === 'OFFLINE'
            ? phrases.spoken.connectionUnavailable
            : err instanceof Error && err.message
              ? err.message
              : phrases.status.aiError;
        setErrorMessage(errText);
        speechManager.speak(errText, settings, {
          priority: PriorityLevel.IMMEDIATE_DANGER,
          interrupt: true,
        });
      } finally {
        setIsAnswering(false);
      }
    },
    [
      cameraStatus,
      isOnline,
      latestAnalysis?.sceneSummary,
      messages,
      phrases.spoken.connectionUnavailable,
      phrases.status.aiError,
      settings,
    ]
  );

  useEffect(() => {
    processAudioRef.current = handleProcessAudioOrText;
  }, [handleProcessAudioOrText]);

  const handleToggleListen = useCallback(() => {
    if (isListening) {
      if (manualListeningRef.current) {
        manualListeningRef.current = false;
        setIsListening(false);
        speechManager.stopVoiceCapture(true);
      } else {
        setIsListening(false);
        speechManager.flushContinuousUtterance();
      }
      return;
    }

    if (continuousMicActive) {
      speechManager.setContinuousListeningPaused(true);
    }

    const resumeContinuousIfActive = () => {
      if (continuousMicActive && cameraStatusRef.current === 'active') {
        speechManager.setContinuousListeningPaused(false);
      }
    };

    setErrorMessage(null);
    manualListeningRef.current = true;
    setIsListening(true);
    void speechManager
      .startVoiceCapture({
        onAudioReady: (audio) => {
          manualListeningRef.current = false;
          setIsListening(false);
          resumeContinuousIfActive();
          void processAudioRef.current({
            audioBase64: audio.audioBase64,
            audioMimeType: audio.mimeType,
          });
        },
        onError: (errMsg) => {
          manualListeningRef.current = false;
          setIsListening(false);
          resumeContinuousIfActive();
          setErrorMessage(errMsg);
          speechManager.speak(errMsg, settings, {
            priority: PriorityLevel.IMMEDIATE_DANGER,
            recordAsLastInstruction: false,
            interrupt: true,
          });
        },
      })
      .then((started) => {
        if (!started) {
          manualListeningRef.current = false;
          setIsListening(false);
          resumeContinuousIfActive();
        }
      });
  }, [continuousMicActive, isListening, settings]);

  const handleTriggerDemoScenario = useCallback(
    (scenarioId: DemoScenarioId) => {
      if (cameraStatus === 'active' || cameraStatus === 'paused') {
        cameraManager.stop();
        speechManager.stopContinuousListening();
        setContinuousMicActive(false);
        setIsListening(false);
        setCameraStatus('inactive');
      }
      setErrorMessage(null);
      setActiveDemoScenario(scenarioId);
      handleUpdateSettings({ demoMode: true });

      const simulated = simulateDemoScenario(scenarioId);
      setLatestAnalysis(simulated);

      const decision = navigationEngine.generateDecision(
        simulated,
        settings.language,
        settings.sensitivity
      );
      setLatestDecision(decision);

      navigationEngine.shouldSpeakDecision(decision, true);
      setLastSpokenText(decision.spokenText);
      speechManager.speak(decision.spokenText, settings, {
        priority: decision.priority,
        hapticPattern: decision.hapticPattern,
        recordAsLastInstruction: true,
        interrupt: true,
      });
    },
    [cameraStatus, handleUpdateSettings, settings]
  );

  const handleExitDemoMode = useCallback(() => {
    handleUpdateSettings({ demoMode: false });
    setActiveDemoScenario(null);
    setActiveView('monitor');
  }, [handleUpdateSettings]);

  // Fast on-device close-wall reflex check (runs locally every 120ms)
  useEffect(() => {
    if (cameraStatus !== 'active' || settings.demoMode) {
      return;
    }

    const reflexTimer = window.setInterval(() => {
      const telemetry = cameraManager.computeQuickTelemetry();
      if (!telemetry) return;

      const now = Date.now();
      if (telemetry.suddenCloseWall && now - lastLocalWallAlertAtRef.current > 2800) {
        lastLocalWallAlertAtRef.current = now;
        const reflexAlert: VisionAnalysisResult = {
          timestamp: now,
          pathwayStatus: 'blocked',
          objects: [
            {
              id: 'reflex-wall',
              category: 'wall',
              label: phrases.objectLabels.wall,
              position: 'center',
              distance: 'near',
              approaching: false,
              confidence: 0.9,
            },
          ],
          sceneSummary: phrases.spoken.closeWallAlert,
          spokenGuidance: phrases.spoken.closeWallAlert,
          urgencyHint: 'danger',
          uncertain: false,
          source: 'local-reflex',
        };
        setLatestAnalysis(reflexAlert);
        const decision: NavigationDecision = {
          id: `reflex-${now}`,
          priority: PriorityLevel.IMMEDIATE_DANGER,
          dedupKey: 'reflex:close_wall',
          phraseKey: 'closeWallAlert',
          spokenText: phrases.spoken.closeWallAlert,
          actionHint: phrases.ui.priorityLabels[1],
          urgency: 'danger',
          hapticPattern: [220, 70, 220],
          bypassCooldown: true,
          timestamp: now,
        };
        setLatestDecision(decision);
        setLastSpokenText(decision.spokenText);
        speechManager.speak(decision.spokenText, settings, {
          priority: PriorityLevel.IMMEDIATE_DANGER,
          hapticPattern: decision.hapticPattern,
          recordAsLastInstruction: true,
          interrupt: true,
          dedupKey: decision.dedupKey,
        });
      }
    }, 120);

    return () => {
      window.clearInterval(reflexTimer);
    };
  }, [cameraStatus, phrases, settings]);

  // Continuous rapid AI frame analysis loop when camera is active
  useEffect(() => {
    if (cameraStatus !== 'active' || settings.demoMode || isListening || isAnswering) {
      return;
    }

    let cancelled = false;
    let nextTimer: number | null = null;

    const scheduleNext = (delayMs: number) => {
      if (cancelled) return;
      nextTimer = window.setTimeout(() => {
        void runLoop();
      }, delayMs);
    };

    const runLoop = async () => {
      if (cancelled) return;

      if (!isOnline) {
        if (!offlineNotifiedRef.current) {
          offlineNotifiedRef.current = true;
          speechManager.speak(phrases.spoken.connectionUnavailable, settings, {
            priority: PriorityLevel.IMMEDIATE_DANGER,
            recordAsLastInstruction: false,
            interrupt: true,
          });
        }
        scheduleNext(1000);
        return;
      }

      if (isAnalysisInFlight()) {
        scheduleNext(80);
        return;
      }

      // Let the assistant finish speaking its current answer before starting the next observation
      if (
        speechManager.isSpeaking() ||
        Date.now() - speechManager.getLastSpeechEndedAt() < 550
      ) {
        scheduleNext(150);
        return;
      }

      const telemetry = cameraManager.computeQuickTelemetry();
      const sinceLastAi = Date.now() - lastAiSuccessAtRef.current;
      if (telemetry && telemetry.motionDelta < 2.2 && sinceLastAi < 1600) {
        scheduleNext(120);
        return;
      }

      const frame = cameraManager.captureFrame();
      if (!frame) {
        scheduleNext(120);
        return;
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const result = await analyzeFrame(frame, {
          sensitivity: settings.sensitivity,
          spokenLanguageName: settings.spokenLanguageName,
          signal: controller.signal,
        });

        if (cancelled) return;

        lastAiSuccessAtRef.current = Date.now();
        setErrorMessage(null);
        setLatestAnalysis(result);

        const decision = navigationEngine.generateDecision(
          result,
          settings.language,
          settings.sensitivity
        );
        setLatestDecision(decision);

        if (navigationEngine.shouldSpeakDecision(decision)) {
          setLastSpokenText(decision.spokenText);
          const shouldInterrupt =
            decision.priority === PriorityLevel.IMMEDIATE_DANGER &&
            !speechManager.isSpeakingReply();
          speechManager.speak(decision.spokenText, settings, {
            priority: decision.priority,
            hapticPattern: decision.hapticPattern,
            recordAsLastInstruction: true,
            interrupt: shouldInterrupt,
            dedupKey: decision.dedupKey,
          });
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof VisionAnalyzerError) {
          if (err.code === 'OFFLINE') {
            setIsOnline(false);
            setErrorMessage(phrases.status.connectionUnavailable);
          } else if (err.code !== 'CONCURRENT' && err.code !== 'TIMEOUT') {
            setErrorMessage(err.message);
          }
        }
      } finally {
        if (!cancelled) {
          const interFrameDelay = settings.analysisIntervalMs === 200 ? 50 : settings.analysisIntervalMs;
          scheduleNext(interFrameDelay);
        }
      }
    };

    void runLoop();

    return () => {
      cancelled = true;
      if (nextTimer !== null) {
        window.clearTimeout(nextTimer);
      }
      abortControllerRef.current?.abort();
    };
  }, [
    cameraStatus,
    isAnswering,
    isListening,
    isOnline,
    phrases.spoken.connectionUnavailable,
    phrases.status.connectionUnavailable,
    settings,
  ]);

  useEffect(() => {
    return uiManager.bindKeyboardShortcuts({
      onToggleCameraOrPause: () => {
        if (cameraStatus === 'inactive' || cameraStatus === 'error') {
          void handleStartCamera();
        } else if (cameraStatus === 'active' || cameraStatus === 'paused') {
          handleTogglePause();
        }
      },
      onRepeatLast: handleRepeatLast,
      onStopCamera: handleStopCamera,
      onToggleMute: handleToggleMute,
    });
  }, [
    cameraStatus,
    handleRepeatLast,
    handleStartCamera,
    handleStopCamera,
    handleToggleMute,
    handleTogglePause,
  ]);

  const statusMessage = useMemo(() => {
    if (!isOnline && !settings.demoMode) {
      return phrases.status.connectionUnavailable;
    }
    if (settings.demoMode) {
      return phrases.status.demoActive;
    }
    switch (cameraStatus) {
      case 'requesting':
        return phrases.status.requestingPermission;
      case 'active':
        return phrases.status.monitoring;
      case 'paused':
        return phrases.status.paused;
      case 'error':
        return errorMessage || phrases.status.cameraUnavailable;
      case 'inactive':
      default:
        return phrases.status.cameraInactive;
    }
  }, [cameraStatus, errorMessage, isOnline, phrases.status, settings.demoMode]);

  return (
    <div className="min-h-dvh flex flex-col bg-slate-50 text-slate-900 pb-20 sm:pb-8">
      <TopBar
        phrases={phrases}
        activeView={activeView}
        onSelectView={setActiveView}
        muted={settings.muted}
        onToggleMute={handleToggleMute}
        demoModeActive={settings.demoMode}
      />

      <main
        id="main-content"
        className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-6 sm:py-10 flex flex-col gap-6"
      >
        {activeView === 'monitor' && (
          <CameraViewport
            phrases={phrases}
            videoRef={videoRef}
            cameraStatus={cameraStatus}
            statusMessage={statusMessage}
            isOnline={isOnline}
            demoMode={settings.demoMode}
            isListening={isListening}
            continuousMicActive={continuousMicActive}
            isAnswering={isAnswering}
            latestDecision={latestDecision}
            lastSpokenText={lastSpokenText}
            errorMessage={errorMessage}
            spokenLanguageName={settings.spokenLanguageName}
            voiceSupported={voiceSupported}
            onStartCamera={() => void handleStartCamera()}
            onToggleListen={handleToggleListen}
            onTogglePause={handleTogglePause}
            onRepeatLast={handleRepeatLast}
            onStopCamera={handleStopCamera}
          />
        )}

        {activeView === 'demo' && (
          <DemoModePanel
            phrases={phrases}
            language={settings.language}
            activeScenarioId={activeDemoScenario}
            demoMode={settings.demoMode}
            onTriggerScenario={handleTriggerDemoScenario}
            onExitDemoMode={handleExitDemoMode}
          />
        )}

        {activeView === 'settings' && (
          <SettingsView
            phrases={phrases}
            settings={settings}
            voices={voices}
            onUpdateSettings={handleUpdateSettings}
            onTestVoice={handleTestVoice}
            onResetSettings={handleResetSettings}
          />
        )}

        <footer
          aria-label="Safety notice"
          className="mx-auto w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-relaxed text-slate-600 shadow-xs"
        >
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
            <p>{phrases.safetyNotice}</p>
          </div>
        </footer>
      </main>

      <MobileBottomNav
        phrases={phrases}
        activeView={activeView}
        onSelectView={setActiveView}
      />
    </div>
  );
}
