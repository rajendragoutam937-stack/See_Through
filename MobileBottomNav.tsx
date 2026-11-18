import { Eye, PlayCircle, Settings } from 'lucide-react';
import type { PhraseCatalog } from '../i18n/phrases';
import type { ActiveView } from './TopBar';

interface MobileBottomNavProps {
  phrases: PhraseCatalog;
  activeView: ActiveView;
  onSelectView: (view: ActiveView) => void;
}

export function MobileBottomNav({
  phrases,
  activeView,
  onSelectView,
}: MobileBottomNavProps) {
  const items: { id: ActiveView; label: string; icon: typeof Eye }[] = [
    { id: 'monitor', label: phrases.controls.monitor, icon: Eye },
    { id: 'demo', label: phrases.controls.demoMode, icon: PlayCircle },
    { id: 'settings', label: phrases.controls.settings, icon: Settings },
  ];

  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-md sm:hidden"
    >
      <div className="grid grid-cols-3 h-16 pb-safe">
        {items.map((item) => {
          const Icon = item.icon;
          const active = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectView(item.id)}
              aria-current={active ? 'page' : undefined}
              className={`flex min-h-[44px] flex-col items-center justify-center gap-1 transition-colors ${
                active ? 'text-blue-600' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span className="text-xs font-bold tracking-tight whitespace-nowrap">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
