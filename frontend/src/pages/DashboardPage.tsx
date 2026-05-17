export default function DashboardPage() {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 320px',
      gap: 20,
      alignItems: 'start',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Stream stats, viewers panel added in subsequent issues */}
        <Placeholder label="Stream stats" />
        <Placeholder label="Viewers" />
      </div>

      {/* Log sidebar — hidden until live (#64) */}
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
