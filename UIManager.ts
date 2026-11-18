export interface KeyboardShortcutHandlers {
  onToggleCameraOrPause: () => void;
  onRepeatLast: () => void;
  onStopCamera: () => void;
  onToggleMute: () => void;
}

export class UIManager {
  public isOnline(): boolean {
    if (typeof navigator === 'undefined') return true;
    return navigator.onLine;
  }

  public subscribeNetworkStatus(onChange: (online: boolean) => void): () => void {
    if (typeof window === 'undefined') return () => {};
    const handleOnline = () => onChange(true);
    const handleOffline = () => onChange(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }

  public bindKeyboardShortcuts(handlers: KeyboardShortcutHandlers): () => void {
    if (typeof window === 'undefined') return () => {};

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'select' || tag === 'textarea') {
        return;
      }

      if (event.code === 'Space') {
        // Prevent accidental double activation when focus is already on a button
        if (tag === 'button') return;
        event.preventDefault();
        handlers.onToggleCameraOrPause();
      } else if (event.key === 'r' || event.key === 'R') {
        event.preventDefault();
        handlers.onRepeatLast();
      } else if (event.key === 's' || event.key === 'S') {
        event.preventDefault();
        handlers.onStopCamera();
      } else if (event.key === 'm' || event.key === 'M') {
        event.preventDefault();
        handlers.onToggleMute();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }
}

export const uiManager = new UIManager();
