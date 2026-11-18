import { useEffect, useState } from 'react';
import { Download, RotateCcw, Volume2 } from 'lucide-react';
import type { PhraseCatalog } from '../i18n/phrases';
import { VISION_API_CONFIG } from '../modules/VisionAnalyzer';
import type { AppSettings, DetectionSensitivity, SupportedLanguage } from '../types/vision';

const CODE_DOWNLOAD_SECRET = '#BRUHHD2DCODEFILES';

interface SettingsViewProps {
  phrases: PhraseCatalog;
  settings: AppSettings;
  voices: SpeechSynthesisVoice[];
  onUpdateSettings: (partial: Partial<AppSettings>) => void;
  onTestVoice: () => void;
  onResetSettings: () => void;
}

export function SettingsView({
  phrases,
  settings,
  voices,
  onUpdateSettings,
  onTestVoice,
  onResetSettings,
}: SettingsViewProps) {
  const [languageInput, setLanguageInput] = useState<string>(settings.spokenLanguageName);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    setLanguageInput((prev) =>
      prev.trim() === CODE_DOWNLOAD_SECRET ? prev : settings.spokenLanguageName
    );
  }, [settings.spokenLanguageName]);

  const isCodeUnlocked = languageInput.trim() === CODE_DOWNLOAD_SECRET;

  const handleLanguageInputChange = (value: string) => {
    setLanguageInput(value);
    setDownloadError(null);
    if (!value.trim().startsWith('#')) {
      onUpdateSettings({
        spokenLanguageName: value,
        voiceURI: '',
      });
    }
  };

  const handleProtectedDownload = async () => {
    if (!isCodeUnlocked || isDownloading) return;
    setIsDownloading(true);
    setDownloadError(null);
    try {
      const response = await fetch(VISION_API_CONFIG.downloadEndpoint, {
        headers: {
          'x-download-code': languageInput.trim(),
        },
      });
      if (!response.ok) {
        throw new Error('Unable to download project files.');
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = 'visionguide-ai-code.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      setDownloadError(
        err instanceof Error ? err.message : 'Unable to download project files.'
      );
    } finally {
      setIsDownloading(false);
    }
  };

  const sensitivityOptions: { value: DetectionSensitivity; label: string }[] = [
    { value: 'low', label: phrases.ui.sensitivityLow },
    { value: 'medium', label: phrases.ui.sensitivityMedium },
    { value: 'high', label: phrases.ui.sensitivityHigh },
  ];

  const intervalOptions: { value: 200 | 800 | 2000; label: string }[] = [
    { value: 200, label: phrases.ui.freqFast },
    { value: 800, label: phrases.ui.freqBalanced },
    { value: 2000, label: phrases.ui.freqBattery },
  ];

  const languageOptions: { value: SupportedLanguage; label: string }[] = [
    { value: 'en', label: 'English' },
    { value: 'hi', label: 'हिन्दी (Hindi)' },
  ];

  return (
    <section
      aria-label={phrases.ui.settingsTitle}
      className="flex flex-col gap-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-bold text-slate-900">{phrases.ui.settingsTitle}</h1>
        <button
          type="button"
          onClick={onTestVoice}
          className="inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-base font-bold text-white hover:bg-blue-700 whitespace-nowrap shrink-0"
        >
          <Volume2 className="h-5 w-5" aria-hidden="true" />
          <span>{phrases.controls.testVoice}</span>
        </button>
      </div>

      {/* Interface Language */}
      <div className="flex flex-col gap-2">
        <span className="text-base font-bold text-slate-900">{phrases.ui.language}</span>
        <div className="grid grid-cols-2 gap-3">
          {languageOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                const nextLang = opt.value === 'hi' ? 'Hindi' : 'English';
                setLanguageInput(nextLang);
                onUpdateSettings({
                  language: opt.value,
                  spokenLanguageName: nextLang,
                  spokenLanguageTag: opt.value === 'hi' ? 'hi-IN' : 'en-US',
                  voiceURI: '',
                });
              }}
              aria-pressed={settings.language === opt.value}
              className={`min-h-[52px] rounded-xl border px-4 py-3 text-base font-bold transition-colors ${
                settings.language === opt.value
                  ? 'border-blue-600 bg-blue-50 text-blue-900'
                  : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Spoken AI Language (Any World Language) */}
      <div className="flex flex-col gap-2">
        <label htmlFor="spoken-language-input" className="text-base font-bold text-slate-900">
          {phrases.ui.spokenLanguageLabel}
        </label>
        <input
          id="spoken-language-input"
          type="text"
          value={languageInput}
          onChange={(e) => handleLanguageInputChange(e.target.value)}
          placeholder="English, Spanish, French, Arabic, Japanese..."
          className="min-h-[50px] w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-base text-slate-900"
        />
        <p className="text-sm text-slate-500">{phrases.ui.spokenLanguageHint}</p>
      </div>

      {/* Speech Speed */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label htmlFor="speech-speed-range" className="text-base font-bold text-slate-900">
            {phrases.ui.speechSpeed}
          </label>
          <span className="font-mono text-base font-bold text-blue-700 tabular-nums">
            {settings.speechSpeed.toFixed(2)}x
          </span>
        </div>
        <input
          id="speech-speed-range"
          type="range"
          min="0.7"
          max="1.75"
          step="0.05"
          value={settings.speechSpeed}
          onChange={(e) => onUpdateSettings({ speechSpeed: parseFloat(e.target.value) })}
          className="h-10 w-full cursor-pointer accent-blue-600"
        />
      </div>

      {/* Volume */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label htmlFor="speech-volume-range" className="text-base font-bold text-slate-900">
            {phrases.ui.volume}
          </label>
          <span className="font-mono text-base font-bold text-blue-700 tabular-nums">
            {Math.round(settings.volume * 100)}%
          </span>
        </div>
        <input
          id="speech-volume-range"
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={settings.volume}
          onChange={(e) => onUpdateSettings({ volume: parseFloat(e.target.value) })}
          className="h-10 w-full cursor-pointer accent-blue-600"
        />
      </div>

      {/* Voice Selection */}
      <div className="flex flex-col gap-2">
        <label htmlFor="voice-select" className="text-base font-bold text-slate-900">
          {phrases.ui.voiceSelection}
        </label>
        <select
          id="voice-select"
          value={settings.voiceURI}
          onChange={(e) => onUpdateSettings({ voiceURI: e.target.value })}
          className="min-h-[52px] w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900"
        >
          <option value="">{phrases.ui.defaultVoice}</option>
          {voices.map((voice) => (
            <option key={voice.voiceURI} value={voice.voiceURI}>
              {voice.name} ({voice.lang})
            </option>
          ))}
        </select>
      </div>

      {/* Detection Sensitivity */}
      <div className="flex flex-col gap-2">
        <span className="text-base font-bold text-slate-900">
          {phrases.ui.detectionSensitivity}
        </span>
        <div className="flex flex-col gap-2.5">
          {sensitivityOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onUpdateSettings({ sensitivity: opt.value })}
              aria-pressed={settings.sensitivity === opt.value}
              className={`min-h-[52px] w-full rounded-xl border px-4 py-3 text-left text-base font-bold transition-colors ${
                settings.sensitivity === opt.value
                  ? 'border-blue-600 bg-blue-50 text-blue-900'
                  : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* AI Analysis Frequency */}
      <div className="flex flex-col gap-2">
        <span className="text-base font-bold text-slate-900">
          {phrases.ui.analysisFrequency}
        </span>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          {intervalOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onUpdateSettings({ analysisIntervalMs: opt.value })}
              aria-pressed={settings.analysisIntervalMs === opt.value}
              className={`min-h-[52px] rounded-xl border px-3 py-3 text-center text-sm font-bold transition-colors tabular-nums ${
                settings.analysisIntervalMs === opt.value
                  ? 'border-blue-600 bg-blue-50 text-blue-900'
                  : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Vibration Toggle */}
      <div className="flex items-center justify-between gap-4 border-t border-slate-200 pt-4">
        <span className="text-base font-bold text-slate-900">{phrases.ui.vibration}</span>
        <button
          type="button"
          role="switch"
          aria-checked={settings.vibrationEnabled}
          onClick={() => onUpdateSettings({ vibrationEnabled: !settings.vibrationEnabled })}
          className={`min-h-[48px] min-w-[96px] rounded-xl border px-4 py-2 text-base font-bold transition-colors ${
            settings.vibrationEnabled
              ? 'border-blue-600 bg-blue-600 text-white'
              : 'border-slate-300 bg-white text-slate-700'
          }`}
        >
          {settings.vibrationEnabled ? phrases.ui.vibrationOn : phrases.ui.vibrationOff}
        </button>
      </div>

      {/* Project Source Download (only visible when access code is entered) */}
      {isCodeUnlocked && (
        <div className="flex flex-col gap-3 border-t border-slate-200 pt-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">{phrases.ui.downloadSectionTitle}</h2>
            <p className="mt-1 text-sm text-slate-600">{phrases.ui.downloadSectionHint}</p>
          </div>
          {downloadError && (
            <p className="text-sm font-medium text-red-700" role="alert">
              {downloadError}
            </p>
          )}
          <button
            type="button"
            onClick={() => void handleProtectedDownload()}
            disabled={isDownloading}
            className="inline-flex min-h-[52px] w-full items-center justify-center gap-2.5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-base font-bold text-blue-900 hover:bg-blue-100 disabled:opacity-60"
          >
            <Download className="h-5 w-5 shrink-0 text-blue-600" aria-hidden="true" />
            <span>
              {isDownloading ? 'Preparing download...' : phrases.controls.downloadCodeFolder}
            </span>
          </button>
        </div>
      )}

      {/* Reset Settings */}
      <div className="border-t border-slate-200 pt-4">
        <button
          type="button"
          onClick={() => {
            setLanguageInput('English');
            setDownloadError(null);
            onResetSettings();
          }}
          className="inline-flex min-h-[48px] items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-base font-bold text-slate-800 hover:bg-slate-50"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          <span>{phrases.controls.resetDefaults}</span>
        </button>
      </div>
    </section>
  );
}
