'use client';
import { useEffect, useState } from 'react';
import { formatSyncAge } from '@/lib/fetchData';

export default function SyncBadge({ lastUpdated }: { lastUpdated: string }) {
  const [info, setInfo] = useState(formatSyncAge(lastUpdated));

  useEffect(() => {
    const interval = setInterval(() => setInfo(formatSyncAge(lastUpdated)), 30000);
    return () => clearInterval(interval);
  }, [lastUpdated]);

  return (
    <div className={`sync-badge ${info.status}`}>
      <span className="sync-dot" />
      {info.text}
    </div>
  );
}
