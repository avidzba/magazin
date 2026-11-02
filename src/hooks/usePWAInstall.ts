import { useState, useEffect, useCallback } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

// Module-level cache to guarantee we never miss an early beforeinstallprompt event
let globalDeferredPrompt: BeforeInstallPromptEvent | null = null;
let hasInitializedModuleListeners = false;

if (typeof window !== 'undefined' && !hasInitializedModuleListeners) {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    globalDeferredPrompt = e as BeforeInstallPromptEvent;
    window.dispatchEvent(new CustomEvent('pwa_prompt_captured'));
  });

  window.addEventListener('appinstalled', () => {
    globalDeferredPrompt = null;
    window.dispatchEvent(new CustomEvent('pwa_app_installed'));
  });

  hasInitializedModuleListeners = true;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(() => globalDeferredPrompt);
  const [isInstalled, setIsInstalled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true
    );
  });
  const [isIOS, setIsIOS] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const ua = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(ua);
    const isIPadOS = window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1;
    return isIOSDevice || isIPadOS;
  });

  useEffect(() => {
    // Check standalone mode
    const checkStandalone = () => {
      const isStandalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true;
      setIsInstalled(isStandalone);
    };

    checkStandalone();
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleMediaChange = () => checkStandalone();
    try {
      mediaQuery.addEventListener('change', handleMediaChange);
    } catch {
      mediaQuery.addListener?.(handleMediaChange);
    }

    // Listen for custom event from early beforeinstallprompt or direct listener
    const handlePromptCaptured = () => {
      setDeferredPrompt(globalDeferredPrompt);
    };

    const handleNativePrompt = (e: Event) => {
      e.preventDefault();
      globalDeferredPrompt = e as BeforeInstallPromptEvent;
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      globalDeferredPrompt = null;
    };

    window.addEventListener('pwa_prompt_captured', handlePromptCaptured);
    window.addEventListener('pwa_app_installed', handleAppInstalled);
    window.addEventListener('beforeinstallprompt', handleNativePrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      try {
        mediaQuery.removeEventListener('change', handleMediaChange);
      } catch {
        mediaQuery.removeListener?.(handleMediaChange);
      }
      window.removeEventListener('pwa_prompt_captured', handlePromptCaptured);
      window.removeEventListener('pwa_app_installed', handleAppInstalled);
      window.removeEventListener('beforeinstallprompt', handleNativePrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt) return false;
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setIsInstalled(true);
        setDeferredPrompt(null);
        globalDeferredPrompt = null;
        return true;
      }
      return false;
    } catch (err) {
      console.warn('PWA install prompt error:', err);
      return false;
    }
  }, [deferredPrompt]);

  return {
    isInstallable: !!deferredPrompt && !isInstalled,
    isInstalled,
    isIOS,
    install,
    deferredPrompt,
  };
}
