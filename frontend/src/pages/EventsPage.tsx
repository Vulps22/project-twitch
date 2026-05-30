import { useEffect, useState } from 'react';
import type { EventConfig } from '../../../backend/src/types.js';
import EventRow from '../components/EventRow.js';
import EventModal from '../components/EventModal.js';

// undefined = closed, null = create mode, EventConfig = edit mode
type ModalState = EventConfig | null | undefined;

const TABS: { label: string; value: string }[] = [
  { label: 'All',            value: 'all' },
  { label: 'Chat Command',   value: 'chat_command' },
  { label: 'Chat Contains',  value: 'chat_contains' },
  { label: 'Follow',         value: 'follow' },
  { label: 'Subscription',   value: 'subscription' },
  { label: 'Bits',           value: 'bits' },
  { label: 'Raid',           value: 'raid' },
  { label: 'Channel Points', value: 'channel_points_redemption' },
];

export default function EventsPage() {
  const [events, setEvents]       = useState<EventConfig[]>([]);
  const [modal, setModal]         = useState<ModalState>(undefined);
  const [filterType, setFilterType] = useState('all');
  const [search, setSearch]       = useState('');

  useEffect(() => {
    fetch('/api/events')
      .then(r => r.json() as Promise<EventConfig[]>)
      .then(setEvents)
      .catch(() => {});
  }, []);

  function handleDelete(name: string) {
    setEvents(prev => prev.filter(e => e.event_name !== name));
  }

  function handleSave(saved: EventConfig) {
    setEvents(prev => {
      const existing = prev.findIndex(e => e.event_name === saved.event_name);
      if (existing >= 0) {
        const next = [...prev];
        next[existing] = saved;
        return next;
      }
      return [...prev, saved];
    });
    setModal(undefined);
  }

  const visible = events.filter(e => {
    const typeMatch   = filterType === 'all' || e.event_type === filterType;
    const searchMatch = e.event_name.toLowerCase().includes(search.toLowerCase());
    return typeMatch && searchMatch;
  });

  return (
    <>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>

        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 16px 0' }}>
          <span className="section-title">Events</span>
          <button className="btn btn-primary btn-sm" onClick={() => setModal(null)}>+ New event</button>
        </div>

        {/* Tabs + search row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', gap: 12, borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {TABS.map(tab => (
              <button
                key={tab.value}
                onClick={() => setFilterType(tab.value)}
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  padding: '4px 10px',
                  borderRadius: 6,
                  border: 'none',
                  cursor: 'pointer',
                  background: filterType === tab.value ? 'var(--accent)' : 'var(--border)',
                  color:      filterType === tab.value ? '#fff'          : 'var(--muted)',
                  transition: 'background 0.15s, color 0.15s',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search events…"
            style={{
              flexShrink: 0,
              width: 180,
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: '5px 10px',
              color: 'var(--text)',
              fontSize: 13,
              outline: 'none',
            }}
          />
        </div>

        {/* List */}
        <div>
          {visible.length === 0 ? (
            <p style={{ color: 'var(--muted)', fontSize: 13, padding: 16 }}>
              {events.length === 0 ? 'No events configured.' : 'No events match your filter.'}
            </p>
          ) : (
            visible.map(event => (
              <EventRow
                key={event.event_name}
                event={event}
                onEdit={e => setModal(e)}
                onDelete={handleDelete}
              />
            ))
          )}
        </div>
      </div>

      {modal !== undefined && (
        <EventModal
          event={modal}
          onSave={handleSave}
          onClose={() => setModal(undefined)}
        />
      )}
    </>
  );
}
