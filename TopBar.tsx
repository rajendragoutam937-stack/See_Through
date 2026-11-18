import { Volume2, VolumeX } from 'lucide-react';
import type { PhraseCatalog } from '../i18n/phrases';

export type ActiveView = 'monitor' | 'demo' | 'settings';

interface TopBarProps {
  phrases: PhraseCatalog;
  activeView: ActiveView;
  onSelectView: (view: ActiveView) => void;
  muted: boolean;
  onToggleMute: () => void;
  demoModeActive: boolean;
}

export function TopBar({
  phrases,
  activeView,
  onSelectView,
  muted,
  onToggleMute,
  demoModeActive,
}: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <a
          href="#main-content"
          onClick={(e) => {
            e.preventDefault();
            onSelectView('monitor');
          }}
          className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 sm:text-xl"
        >
          {phrases.appName}
        </a>

        <nav
          aria-label="Primary navigation"
          className="hidden sm:flex items-center gap-6 text-base font-medium"
        >
          <button
            type="button"
            onClick={() => onSelectView('monitor')}
            aria-current={activeView === 'monitor' ? 'page' : undefined}
            className={`min-h-[44px] px-2 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeView === 'monitor'
                ? 'border-blue-600 text-blue-700 font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            {phrases.controls.monitor}
          </button>
          <button
            type="button"
            onClick={() => onSelectView('demo')}
            aria-current={activeView === 'demo' ? 'page' : undefined}
            className={`min-h-[44px] px-2 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeView === 'demo'
                ? 'border-blue-600 text-blue-700 font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            {phrases.controls.demoMode}
            {demoModeActive ? ' (On)' : ''}
          </button>
          <button
            type="button"
            onClick={() => onSelectView('settings')}
            aria-current={activeView === 'settings' ? 'page' : undefined}
            className={`min-h-[44px] px-2 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeView === 'settings'
                ? 'border-blue-600 text-blue-700 font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            {phrases.controls.settings}
          </button>
        </nav>

        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onToggleMute}
            aria-pressed={muted}
            aria-label={muted ? phrases.controls.unmute : phrases.controls.mute}
            className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-bold transition-colors whitespace-nowrap shrink-0 ${
              muted
                ? 'border-red-300 bg-red-50 text-red-800 hover:bg-red-100'
                : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
            }`}
          >
            {muted ? (
              <VolumeX className="h-5 w-5 text-red-600" aria-hidden="true" />
            ) : (
              <Volume2 className="h-5 w-5 text-blue-600" aria-hidden="true" />
            )}
            <span>{muted ? phrases.controls.unmute : phrases.controls.mute}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
