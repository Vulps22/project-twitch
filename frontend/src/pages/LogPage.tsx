import { useEffect, useState } from 'react';

interface LogEntry {
  id: string;
  eventName: string;
  eventType: string;
  username: string;
  detail: string;
  timestamp: string;
}

async function fetchLog(): Promise<LogEntry[]> {
  try {
    const res = await fetch('/api/log');
    if (!res.ok) return [];
    return res.json() as Promise<LogEntry[]>;
  } catch {
    return [];
  }
}

async function replay(id: string): Promise<void> {
  await fetch(`/api/log/${id}/replay`, { method: 'POST' });
}

function formatTime(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function LogPage() {
  const [entries, setEntries] = useState<LogEntry[]>([]);

  useEffect(() => {
    fetchLog().then(setEntries);
    const id = setInterval(() => fetchLog().then(setEntries), 5_000);
    return () => clearInterval(id);
  }, []);

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <span style={{ fontSize: 16, fontWeight: 600 }}>Events Log</span>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>
          {entries.length} event{entries.length !== 1 ? 's' : ''} · in-memory only
        </span>
      </div>

      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        overflow: 'hidden',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              {['Time', 'Type', 'User', 'Detail', ''].map(h => (
                <th key={h} style={{
                  textAlign: 'left',
                  padding: '10px 16px',
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.4px',
                  borderBottom: '1px solid var(--border)',
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '24px 16px', color: 'var(--muted)', textAlign: 'center' }}>
                  No events yet this stream
                </td>
              </tr>
            ) : entries.map((entry, i) => (
              <tr key={entry.id}>
                <td style={{
                  padding: '10px 16px',
                  borderBottom: i < entries.length - 1 ? '1px solid #1a1a1d' : undefined,
                  color: 'var(--muted)',
                  whiteSpace: 'nowrap',
                }}>
                  {formatTime(entry.timestamp)}
                </td>
                <td style={{ padding: '10px 16px', borderBottom: i < entries.length - 1 ? '1px solid #1a1a1d' : undefined }}>
                  <span className={`event-type-badge ${entry.eventType}`}>
                    {entry.eventType.replace(/_/g, ' ')}
                  </span>
                </td>
                <td style={{ padding: '10px 16px', borderBottom: i < entries.length - 1 ? '1px solid #1a1a1d' : undefined }}>
                  {entry.username}
                </td>
                <td style={{ padding: '10px 16px', borderBottom: i < entries.length - 1 ? '1px solid #1a1a1d' : undefined }}>
                  {entry.detail}
                </td>
                <td style={{ padding: '10px 16px', borderBottom: i < entries.length - 1 ? '1px solid #1a1a1d' : undefined }}>
                  <ReplayButton id={entry.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function ReplayButton({ id }: { id: string }) {
  const [replaying, setReplaying] = useState(false);

  const handleReplay = async () => {
    setReplaying(true);
    await replay(id);
    setTimeout(() => setReplaying(false), 1000);
  };

  return (
    <button
      onClick={handleReplay}
      disabled={replaying}
      style={{
        background: 'transparent',
        border: '1px solid var(--border)',
        color: replaying ? 'var(--accent)' : 'var(--muted)',
        fontSize: 10,
        fontWeight: 600,
        padding: '2px 7px',
        borderRadius: 4,
        cursor: replaying ? 'default' : 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {replaying ? '▶ Replaying…' : '▶ Replay'}
    </button>
  );
}
