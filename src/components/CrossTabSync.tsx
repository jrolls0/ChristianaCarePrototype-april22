'use client';

import { useEffect } from 'react';
import { STORAGE_KEY, useStore } from '@/lib/store';

export function CrossTabSync() {
  useEffect(() => {
    const handler = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) {
        useStore.persist.rehydrate();
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);
  return null;
}
