import './index.css';

export default function App() {
  return (
    <>
      <header style={{
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        padding: '0 24px',
        height: 56,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)', letterSpacing: '-0.5px' }}>
          StreamerCommander
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <StatusPill state="disconnected" label="Overlay" />
          <StatusPill state="disconnected" label="Twitch" />
        </div>
      </header>

      <nav style={{
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        padding: '0 24px',
        display: 'flex',
        gap: 4,
      }}>
        {['Dashboard', 'Events', 'Log', 'Settings'].map((page) => (
          <a
            key={page}
            href="#"
            style={{
              color: 'var(--muted)',
              textDecoration: 'none',
              padding: '12px 16px',
              fontSize: 14,
              fontWeight: 500,
              borderBottom: '2px solid transparent',
            }}
          >
            {page}
          </a>
        ))}
      </nav>

      <main style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
        <p style={{ color: 'var(--muted)', fontSize: 14 }}>Dashboard coming soon…</p>
      </main>
    </>
  );
}

function StatusPill({ state, label }: { state: 'connected' | 'disconnected' | 'warning'; label: string }) {
  const dotColor = state === 'connected' ? 'var(--green)' : state === 'warning' ? 'var(--gold)' : 'var(--red)';
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
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, display: 'inline-block' }} />
      {label}
    </div>
  );
}
