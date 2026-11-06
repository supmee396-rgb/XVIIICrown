'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppData } from './types';

type Snapshot = { data: AppData; revision: number };
export function useGuildData() {
  const [data, setData] = useState<AppData | null>(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const revision = useRef(-1);
  const submitting = useRef(false);
  const accept = useCallback((snapshot: Snapshot) => {
    if (snapshot.revision >= revision.current) {
      revision.current = snapshot.revision;
      setData(snapshot.data);
    }
  }, []);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch('/api/state', { cache: 'no-store', signal });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      accept(result);
      setError('');
    } catch (cause) {
      if (!signal?.aborted) setError(cause instanceof Error ? cause.message : 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');
    }
  }, [accept]);
  useEffect(() => {
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout>;
    const poll = async () => {
      await refresh(controller.signal);
      if (!controller.signal.aborted) timeout = setTimeout(poll, 3000);
    };
    void poll();
    return () => { controller.abort(); clearTimeout(timeout); };
  }, [refresh]);
  const mutate = async (command: Record<string, unknown>): Promise<AppData | null> => {
    if (submitting.current || !data) return null;
    submitting.current = true;
    setPending(true);
    try {
      const response = await fetch('/api/state', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...command, roundId: data.rounds[data.rounds.length - 1].id }),
      });
      const result = await response.json();
      if (!response.ok) { await refresh(); throw new Error(result.error); }
      accept(result);
      setError('');
      return result.data;
    } finally { submitting.current = false; setPending(false); }
  };
  return { data, error, pending, mutate, refresh };
}
