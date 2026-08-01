"use client";

import { useCallback, useEffect, useState } from "react";

const storageKey = (userId: string) => `freelanzo-work-photos:${userId}`;

export function useWorkPhotos(userId: string | null | undefined) {
  const [photos, setPhotos] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Client-only storage hydrate after mount.
    /* eslint-disable react-hooks/set-state-in-effect -- localStorage */
    if (!userId) {
      setPhotos([]);
      setReady(true);
      return;
    }
    try {
      const raw = localStorage.getItem(storageKey(userId));
      const custom = raw ? (JSON.parse(raw) as string[]) : [];
      setPhotos(Array.isArray(custom) ? custom : []);
    } catch {
      setPhotos([]);
    }
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [userId]);

  const persist = useCallback(
    (next: string[]) => {
      setPhotos(next);
      if (!userId) return;
      try {
        localStorage.setItem(storageKey(userId), JSON.stringify(next));
      } catch {
        // quota / private mode — keep in memory only
      }
    },
    [userId],
  );

  const addPhotos = useCallback(
    (urls: string[]) => {
      persist([...urls, ...photos]);
    },
    [persist, photos],
  );

  const removePhoto = useCallback(
    (index: number) => {
      persist(photos.filter((_, i) => i !== index));
    },
    [persist, photos],
  );

  return { photos, ready, addPhotos, removePhoto, setPhotos: persist };
}
