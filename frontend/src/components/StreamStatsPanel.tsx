import { useEffect, useState } from 'react';

interface StreamStats {
  stream: { title: string; viewerCount: number; startedAt: string } | null;
  followers: number | null;
  subscribers: number | null;
  session: {
    follows: number;
    subs: number;
    bits: number;
    chatMessages: number;
    eventsFired: number;
    raids: number;
  };
}

function useStreamStats() {
  const [stats, setStats] = useState<StreamStats | null>(null);

  useEffect(() => {
    const fetchStats = () =>
      fetch('/api/stream/stats')
        .then(r => r.json() as Promise<StreamStats>)
        .then(setStats)
        .catch(() => {});

    fetchStats();
    const id = setInterval(fetchStats, 30_000);
    return () => clearInterval(id);
  }, []);

  return stats;
}

function uptime(startedAt: string): string {
  const ms = Date.now() - new Date(startedAt).getTime();
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m`;
}

function fmt(n: number | null): string {
  return n === null ? '—' : n.toLocaleString();
}

function delta(n: number, label: string): string | null {
  return n > 0 ? `+${n} ${label}` : null;
}

export default function StreamStatsPanel() {
  const stats = useStreamStats();

  const session = stats?.session ?? { follows: 0, subs: 0, bits: 0, chatMessages: 0, eventsFired: 0, raids: 0 };

  const cards: { label: string; value: string; sub?: string | null; color?: string }[] = [
    { label: 'Viewers',     value: stats?.stream ? fmt(stats.stream.viewerCount) : '—', color: 'var(--accent)' },
    { label: 'Followers',   value: fmt(stats?.followers ?? null), sub: delta(session.follows, 'this stream'), color: 'var(--green)' },
    { label: 'Subscribers', value: fmt(stats?.subscribers ?? null), sub: delta(session.subs, 'this stream'),  color: 'var(--accent)' },
    { label: 'Bits cheered',value: fmt(session.bits),  sub: delta(session.bits, 'this stream'),              color: 'var(--gold)' },
    { label: 'Chat msgs',   value: fmt(session.chatMessages) },
    { label: 'Events fired',value: fmt(session.eventsFired) },
    { label: 'Raids',       value: fmt(session.raids) },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {stats?.stream && (
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}>
          <LiveBadge />
          <span style={{ fontSize: 15, fontWeight: 600, flex: 1 }}>{stats.stream.title}</span>
          <span style={{ fontSize: 13, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
            {uptime(stats.stream.startedAt)}
          </span>
        </div>
      )}

      <div>
        <div style={{ marginBottom: 12 }}>
          <span className="section-title">Stream Stats</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
          {cards.map(c => (
            <div key={c.label} className="card">
              <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
                {c.label}
              </div>
              <div style={{ fontSize: 26, fontWeight: 700, lineHeight: 1, color: c.color ?? 'var(--text)' }}>
                {c.value}
              </div>
              {c.sub && (
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 5 }}>{c.sub}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function LiveBadge() {
  return (
    <span className="live-badge">
      <span className="live-dot" />
      LIVE
    </span>
  );
}
