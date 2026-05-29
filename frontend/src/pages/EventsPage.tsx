import { useEffect, useState } from 'react';
import type { EventConfig } from '../../../backend/src/types.js';
import EventRow from '../components/EventRow.js';
import EventModal from '../components/EventModal.js';

// undefined = closed, null = create mode, EventConfig = edit mode
type ModalState = EventConfig | null | undefined;

export default function EventsPage() {
  const [events, setEvents] = useState<EventConfig[]>([]);
  const [modal, setModal] = useState<ModalState>(undefined);

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

  return (
    <>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 16px 0' }}>
          <span className="section-title">Events</span>
          <button className="btn btn-primary btn-sm" onClick={() => setModal(null)}>+ New event</button>
        </div>

        <div style={{ marginTop: 16 }}>
          {events.length === 0 ? (
            <p style={{ color: 'var(--muted)', fontSize: 13, padding: '16px' }}>No events configured.</p>
          ) : (
            events.map(event => (
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
