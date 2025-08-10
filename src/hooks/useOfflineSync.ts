import { useEffect, useRef, useState } from "react";

interface SyncTask {
  id: string;
  run: () => Promise<void>;
}

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const queueRef = useRef<SyncTask[]>([]);
  const flushingRef = useRef(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const queueTask = (task: SyncTask["run"], id = crypto.randomUUID()) => {
    queueRef.current.push({ id, run: task });
  };

  const flush = async () => {
    if (flushingRef.current) return;
    flushingRef.current = true;
    try {
      while (queueRef.current.length && navigator.onLine) {
        const task = queueRef.current.shift();
        if (!task) break;
        try {
          await task.run();
        } catch (e) {
          // Push back and break to retry later
          queueRef.current.unshift(task);
          break;
        }
      }
    } finally {
      flushingRef.current = false;
    }
  };

  // Auto-flush when coming back online
  useEffect(() => {
    if (isOnline) {
      flush();
    }
  }, [isOnline]);

  return { isOnline, queueTask, flush };
}
