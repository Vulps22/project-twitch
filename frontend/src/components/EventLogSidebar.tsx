import { useEffect, useRef, useState } from 'react';

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
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function EventLogSidebar() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const prevCountRef = useRef(0);

  useEffect(() => {
    fetchLog().then(setEntries);
    const id = setInterval(() => fetchLog().then(setEntries), 5_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    prevCountRef.current = entries.length;
  }, [entries]);

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      display: 'flex',
      flexDirection: 'column',
      maxHeight: 'calc(100vh - 120px)',
      position: 'sticky',
      top: 20,
    }}>
      <div style={{
        padding: '14px 16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>Events Log</span>
        <span style={{
          fontSize: 11,
          background: 'var(--accent)',
          color: '#fff',
          padding: '1px 7px',
          borderRadius: 10,
          fontWeight: 600,
        }}>
          {entries.length}
        </span>
      </div>

      <div style={{ overflowY: 'auto', flex: 1, padding: '8px 0' }}>
        {entries.map((entry, i) => (
          <LogEntryRow
            key={entry.id}
            entry={entry}
            isNew={i < entries.length - prevCountRef.current}
          />
        ))}
      </div>
    </div>
  );
}

function LogEntryRow({ entry, isNew }: { entry: LogEntry; isNew: boolean }) {
  return (
    <div style={{
      padding: '10px 14px',
      borderBottom: '1px solid #1a1a1d',
      fontSize: 12,
      animation: isNew ? 'slideIn 0.25s ease' : undefined,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <span className={`event-type-badge ${entry.eventType}`}>{entry.eventType.replace(/_/g, ' ')}</span>
            <span style={{ fontWeight: 600 }}>{entry.username}</span>
          </div>
          <div style={{ color: 'var(--muted)', fontSize: 11 }}>{entry.detail}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
          <span style={{ fontSize: 10, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
            {formatTime(entry.timestamp)}
          </span>
          <button
            onClick={() => replay(entry.id)}
            style={{
              background: 'transparent',
              border: '1px solid var(--border)',
              color: 'var(--muted)',
              fontSize: 10,
              fontWeight: 600,
              padding: '2px 7px',
              borderRadius: 4,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => { (e.target as HTMLButtonElement).style.color = 'var(--accent)'; (e.target as HTMLButtonElement).style.borderColor = 'var(--accent)'; }}
            onMouseLeave={e => { (e.target as HTMLButtonElement).style.color = 'var(--muted)'; (e.target as HTMLButtonElement).style.borderColor = 'var(--border)'; }}
          >
            ▶ Replay
          </button>
        </div>
      </div>
    </div>
  );
}
