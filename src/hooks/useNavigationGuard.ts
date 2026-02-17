import { useEffect } from 'react';

export function useNavigationGuard(when: boolean, message: string) {
  // Simple navigation guard: browser unload prompt only.
  // React Router's unstable_useBlocker is not relied on in tests.
  useEffect(() => {
    if (!when) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = message;
      return message;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [when, message]);
}
