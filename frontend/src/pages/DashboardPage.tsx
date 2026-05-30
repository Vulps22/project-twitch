import { useEffect, useState } from 'react';
import StreamStatsPanel from '../components/StreamStatsPanel.tsx';
import EventLogSidebar from '../components/EventLogSidebar.tsx';
import ViewersPanel from '../components/ViewersPanel.tsx';
import ChatFeedPanel from '../components/ChatFeedPanel.tsx';
import { useDashboardSocket } from '../hooks/useDashboardSocket.ts';

function useIsLive(): boolean {
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    const check = () =>
      fetch('/api/stream/stats')
        .then(r => r.json() as Promise<{ stream: unknown }>)
        .then(data => setIsLive(data.stream !== null))
        .catch(() => setIsLive(false));

    check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, []);

  return isLive;
}

export default function DashboardPage() {
  const isLive = useIsLive();
  const flash = useDashboardSocket();

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: isLive ? '1fr 320px' : '1fr',
      gap: 20,
      alignItems: 'start',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <StreamStatsPanel />
        <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 20, alignItems: 'start' }}>
          <ViewersPanel flash={flash} />
          <ChatFeedPanel />
        </div>
      </div>

      {isLive && (
        <aside>
          <EventLogSidebar />
        </aside>
      )}
    </div>
  );
}

