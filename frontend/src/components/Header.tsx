import { useEffect, useState } from 'react';

interface Status {
  overlay: { connected: boolean; clientCount: number };
  bot: { connected: boolean };
  broadcaster: { connected: boolean; configured: boolean };
}

const POLL_INTERVAL = 3000;

async function fetchStatus(): Promise<Status | null> {
  try {
    const res = await fetch('/api/status');
    if (!res.ok) return null;
    return res.json() as Promise<Status>;
  } catch {
    return null;
  }
}

export default function Header() {
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    fetchStatus().then(setStatus);
    const id = setInterval(() => fetchStatus().then(setStatus), POLL_INTERVAL);
    return () => clearInterval(id);
  }, []);

  const overlayState = status?.overlay.connected ? 'connected' : 'disconnected';

  let twitchChatState: 'connected' | 'warning' | 'disconnected' = 'disconnected';
  if (status?.bot.connected) twitchChatState = 'connected';

  let twitchEventsState: 'connected' | 'warning' | 'disconnected' = 'disconnected';
  if (status?.broadcaster.connected) twitchEventsState = 'connected';
  else if (status && !status.broadcaster.configured) twitchEventsState = 'disconnected';
  else if (status?.broadcaster.configured) twitchEventsState = 'warning';

  return (
    <header style={{
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
      padding: '0 24px',
      height: 56,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexShrink: 0,
    }}>
      <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)', letterSpacing: '-0.5px' }}>
        StreamerCommander
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <StatusPill state={overlayState} label="Overlay" />
        <StatusPill state={twitchChatState} label="Twitch Chat" />
        <StatusPill state={twitchEventsState} label="Twitch Events" />
      </div>
    </header>
  );
}

function StatusPill({ label, state }: { label: string; state: 'connected' | 'warning' | 'disconnected' }) {
  const color = state === 'connected' ? 'var(--green)' : state === 'warning' ? 'var(--gold)' : 'var(--red)';
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      background: 'var(--border)',
      borderRadius: 20,
      padding: '4px 12px',
      fontSize: 13,
    }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block' }} />
      {label}
    </div>
  );
}
