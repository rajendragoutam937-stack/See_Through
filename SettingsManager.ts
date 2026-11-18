import type { AppSettings } from '../types/vision';

const STORAGE_KEY = 'visionguide_ai_settings_v4';

export const DEFAULT_SETTINGS: AppSettings = {
  speechSpeed: 1.25,
  voiceURI: '',
  volume: 1.0,
  muted: false,
  sensitivity: 'medium',
  language: 'en',
  spokenLanguageName: 'English',
  spokenLanguageTag: 'en-US',
  vibrationEnabled: true,
  analysisIntervalMs: 200,
  demoMode: false,
};

export class SettingsManager {
  private settings: AppSettings;

  constructor() {
    this.settings = this.load();
  }

  public getSettings(): AppSettings {
    return { ...this.settings };
  }

  public updateSettings(partial: Partial<AppSettings>): AppSettings {
    this.settings = {
      ...this.settings,
      ...partial,
    };
    this.save();
    return this.getSettings();
  }

  public reset(): AppSettings {
    this.settings = { ...DEFAULT_SETTINGS };
    this.save();
    return this.getSettings();
  }

  private load(): AppSettings {
    if (typeof window === 'undefined' || !window.localStorage) {
      return { ...DEFAULT_SETTINGS };
    }
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULT_SETTINGS };
      const parsed = JSON.parse(raw) as Partial<AppSettings>;
      const validLanguage =
        parsed.language === 'en' || parsed.language === 'hi'
          ? parsed.language
          : DEFAULT_SETTINGS.language;

      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        language: validLanguage,
        spokenLanguageName:
          typeof parsed.spokenLanguageName === 'string' &&
          parsed.spokenLanguageName.trim() &&
          !parsed.spokenLanguageName.trim().startsWith('#')
            ? parsed.spokenLanguageName.trim()
            : DEFAULT_SETTINGS.spokenLanguageName,
        spokenLanguageTag:
          typeof parsed.spokenLanguageTag === 'string' && parsed.spokenLanguageTag.trim()
            ? parsed.spokenLanguageTag.trim()
            : DEFAULT_SETTINGS.spokenLanguageTag,
        speechSpeed: this.clampNumber(parsed.speechSpeed, 0.7, 1.8, DEFAULT_SETTINGS.speechSpeed),
        volume: this.clampNumber(parsed.volume, 0, 1, DEFAULT_SETTINGS.volume),
        analysisIntervalMs:
          parsed.analysisIntervalMs === 200 ||
          parsed.analysisIntervalMs === 800 ||
          parsed.analysisIntervalMs === 2000
            ? parsed.analysisIntervalMs
            : DEFAULT_SETTINGS.analysisIntervalMs,
      };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  private save(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch {
      // Ignore storage quota errors
    }
  }

  private clampNumber(val: unknown, min: number, max: number, fallback: number): number {
    if (typeof val !== 'number' || Number.isNaN(val)) return fallback;
    return Math.min(max, Math.max(min, val));
  }
}

export const settingsManager = new SettingsManager();
