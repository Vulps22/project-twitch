import { useEffect, useState } from 'react';
import StreamStatsPanel from '../components/StreamStatsPanel.tsx';
import EventLogSidebar from '../components/EventLogSidebar.tsx';

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

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: isLive ? '1fr 320px' : '1fr',
      gap: 20,
      alignItems: 'start',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <StreamStatsPanel />
        <Placeholder label="Viewers" />
      </div>

      {isLive && (
        <aside>
          <EventLogSidebar />
        </aside>
      )}
    </div>
  );
}

function Placeholder({ label }: { label: string }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      padding: 24,
      color: 'var(--muted)',
      fontSize: 13,
    }}>
      {label}
    </div>
  );
}
