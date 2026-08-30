import { useState, useEffect } from 'react';
import { Download, Smartphone, X, Check } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showBanner, setShowBanner] = useState(true);
  const [installedSuccess, setInstalledSuccess] = useState(false);

  useEffect(() => {
    // Check if app is already running in standalone mode (installed PWA)
    const inStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(inStandalone);

    // Detect iOS device
    const userAgent = window.navigator.userAgent.toLowerCase();
    const iosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(iosDevice);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    window.addEventListener('appinstalled', () => {
      setDeferredPrompt(null);
      setInstalledSuccess(true);
      setTimeout(() => setInstalledSuccess(false), 5000);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setInstalledSuccess(true);
    }
  };

  if (isStandalone || !showBanner) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-2.5 shadow-lg border-b border-indigo-500/30 flex items-center justify-between gap-3 text-xs md:text-sm">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="p-1.5 bg-white/10 rounded-lg flex-shrink-0">
          <Smartphone size={18} className="text-white" />
        </div>
        <div className="truncate">
          <span className="font-semibold">Install KanbanKC App:</span>{' '}
          <span className="hidden sm:inline text-indigo-100">
            Keep it on your phone or desktop home screen for instant access!
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {installedSuccess ? (
          <span className="flex items-center gap-1 bg-emerald-500/30 text-emerald-200 px-3 py-1 rounded-lg text-xs font-medium">
            <Check size={14} /> Installed!
          </span>
        ) : deferredPrompt ? (
          <button
            onClick={handleInstallClick}
            className="flex items-center gap-1.5 bg-white text-indigo-600 font-medium px-3 py-1.5 rounded-lg shadow-sm hover:bg-indigo-50 transition-all duration-200 text-xs"
          >
            <Download size={14} />
            <span>Install App</span>
          </button>
        ) : isIOS ? (
          <span className="text-xs bg-white/15 px-2.5 py-1 rounded-md text-indigo-100">
            Tap <strong className="text-white">Share</strong> &rarr; <strong className="text-white">Add to Home Screen</strong>
          </span>
        ) : (
          <button
            onClick={handleInstallClick}
            className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white font-medium px-3 py-1.5 rounded-lg transition-all text-xs"
            title="Use Chrome or Edge address bar to Install"
          >
            <Download size={14} />
            <span>Install App</span>
          </button>
        )}

        <button
          onClick={() => setShowBanner(false)}
          className="p-1 hover:bg-white/10 rounded-md transition-colors text-indigo-200 hover:text-white"
          aria-label="Dismiss PWA prompt"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
