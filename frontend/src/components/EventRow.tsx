import type { EventConfig, Reaction } from '../../../backend/src/types.js';

const TYPE_COLORS: Record<string, string> = {
  chat_command:               'var(--blue)',
  chat_contains:              'var(--cyan)',
  follow:                     'var(--green)',
  subscription:               'var(--gold)',
  raid:                       'var(--red)',
  bits:                       'var(--gold)',
  channel_points_redemption:  'var(--lilac)',
};

const PILL_LABELS: Partial<Record<Reaction['type'], string>> = {
  chat_reply:   'reply',
  image:        'image',
  overlay_text: 'text',
  sound:        'sound',
  video:        'video',
};

interface Props {
  event: EventConfig;
  onEdit: (event: EventConfig) => void;
  onDelete: (name: string) => void;
}

export default function EventRow({ event, onEdit, onDelete }: Props) {
  const badgeColor = TYPE_COLORS[event.event_type] ?? 'var(--muted)';
  const pills = [...new Set(event.reactions.map(r => PILL_LABELS[r.type]).filter(Boolean))];

  function handleTest() {
    fetch(`/api/events/${encodeURIComponent(event.event_name)}/test`, { method: 'POST' })
      .catch(() => {});
  }

  function handleDelete() {
    if (!confirm(`Delete "${event.event_name}"?`)) return;
    fetch(`/api/events/${encodeURIComponent(event.event_name)}`, { method: 'DELETE' })
      .then(r => r.json())
      .then(d => { if (d.ok) onDelete(event.event_name); })
      .catch(() => {});
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '10px 16px',
      borderBottom: '1px solid var(--border)',
    }}>
      <span style={{ width: 220, flexShrink: 0, fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {event.event_name}
      </span>

      <span style={{
        width: 140,
        flexShrink: 0,
        textAlign: 'center',
        fontSize: 11,
        fontWeight: 700,
        padding: '3px 8px',
        borderRadius: 4,
        background: badgeColor + '22',
        color: badgeColor,
        border: `1px solid ${badgeColor}55`,
        letterSpacing: '0.3px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {event.event_type.replace(/_/g, ' ')}
      </span>

      <div style={{ display: 'flex', gap: 6, flex: 1, flexWrap: 'wrap' }}>
        {pills.map(label => (
          <span key={label} style={{
            fontSize: 11,
            fontWeight: 600,
            padding: '2px 8px',
            borderRadius: 4,
            background: 'var(--border)',
            color: 'var(--muted)',
          }}>
            {label}
          </span>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <button className="btn btn-sm" onClick={handleTest} style={{ background: 'transparent', border: '1px solid var(--cyan)', color: 'var(--cyan)' }}>Test</button>
        <button className="btn btn-ghost btn-sm" onClick={() => onEdit(event)}>Edit</button>
        <button className="btn btn-danger btn-sm" onClick={handleDelete}>Delete</button>
      </div>
    </div>
  );
}
