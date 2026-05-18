import StreamStatsPanel from '../components/StreamStatsPanel.tsx';

export default function DashboardPage() {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 320px',
      gap: 20,
      alignItems: 'start',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <StreamStatsPanel />
        <Placeholder label="Viewers" />
      </div>

      {/* Log sidebar — shown when live (#64) */}
      <aside style={{ display: 'none' }}>
        <Placeholder label="Events log" />
      </aside>
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
