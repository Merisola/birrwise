'use client';

import { useCallback, useState } from 'react';

export function useSignOut() {
  const [signingOut, setSigningOut] = useState(false);

  const signOut = useCallback(async () => {
    if (signingOut) return;
    setSigningOut(true);

    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Even if the request fails, send the user to the login page; the
      // middleware will reject a still-valid cookie only if it expired.
    } finally {
      window.location.replace('/login');
    }
  }, [signingOut]);

  return { signOut, signingOut };
}
