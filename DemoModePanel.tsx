import { AlertCircle, Play, X } from 'lucide-react';
import type { PhraseCatalog } from '../i18n/phrases';
import { DEMO_SCENARIOS } from '../modules/VisionAnalyzer';
import type { DemoScenarioId, SupportedLanguage } from '../types/vision';

interface DemoModePanelProps {
  phrases: PhraseCatalog;
  language: SupportedLanguage;
  activeScenarioId: DemoScenarioId | null;
  demoMode: boolean;
  onTriggerScenario: (scenarioId: DemoScenarioId) => void;
  onExitDemoMode: () => void;
}

export function DemoModePanel({
  phrases,
  language,
  activeScenarioId,
  demoMode,
  onTriggerScenario,
  onExitDemoMode,
}: DemoModePanelProps) {
  return (
    <section
      aria-label={phrases.controls.demoMode}
      className="flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"
    >
      <div className="flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-6 w-6 shrink-0 text-amber-700" aria-hidden="true" />
          <div>
            <h1 className="text-lg font-bold text-slate-900">
              {phrases.ui.demoBannerTitle}
            </h1>
            <p className="mt-1 text-sm text-slate-700">
              {phrases.ui.demoBannerSubtitle}
            </p>
          </div>
        </div>

        {demoMode && (
          <button
            type="button"
            onClick={onExitDemoMode}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-900 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <X className="h-4 w-4" aria-hidden="true" />
            <span>{phrases.controls.exitDemo}</span>
          </button>
        )}
      </div>

      <div>
        <h2 className="text-lg font-bold text-slate-900">
          {phrases.ui.demoScenariosTitle}
        </h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {DEMO_SCENARIOS.map((scenario) => {
            const isSelected = activeScenarioId === scenario.id;
            const title = language === 'hi' ? scenario.titleHi : scenario.title;
            const desc = language === 'hi' ? scenario.descriptionHi : scenario.description;

            return (
              <button
                key={scenario.id}
                type="button"
                onClick={() => onTriggerScenario(scenario.id)}
                aria-pressed={isSelected}
                className={`flex min-h-[76px] w-full items-center justify-between gap-3 rounded-xl border px-4 py-3.5 text-left transition-colors ${
                  isSelected
                    ? 'border-blue-600 bg-blue-50 text-slate-900'
                    : 'border-slate-200 bg-slate-50 text-slate-900 hover:border-slate-300 hover:bg-slate-100'
                }`}
              >
                <div className="min-w-0">
                  <div className="text-base font-bold text-slate-900">{title}</div>
                  <div className="mt-0.5 text-sm text-slate-600">{desc}</div>
                </div>
                <Play
                  className={`h-5 w-5 shrink-0 ${
                    isSelected ? 'text-blue-600' : 'text-slate-400'
                  }`}
                  aria-hidden="true"
                />
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
