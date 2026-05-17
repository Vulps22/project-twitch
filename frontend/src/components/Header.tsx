export default function Header() {
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
        <StatusPill label="Overlay" state="disconnected" />
        <StatusPill label="Twitch" state="disconnected" />
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
