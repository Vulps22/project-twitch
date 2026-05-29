import { useEffect, useState } from 'react';
import type { EventConfig } from '../../../backend/src/types.js';
import EventRow from '../components/EventRow.js';

export default function EventsPage() {
  const [events, setEvents] = useState<EventConfig[]>([]);

  useEffect(() => {
    fetch('/api/events')
      .then(r => r.json() as Promise<EventConfig[]>)
      .then(setEvents)
      .catch(() => {});
  }, []);

  function handleDelete(name: string) {
    setEvents(prev => prev.filter(e => e.event_name !== name));
  }

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 16px 0' }}>
        <span className="section-title">Events</span>
        <button className="btn btn-primary btn-sm" disabled title="Coming in #69">+ New event</button>
      </div>

      <div style={{ marginTop: 16 }}>
        {events.length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: 13, padding: '16px' }}>No events configured.</p>
        ) : (
          events.map(event => (
            <EventRow key={event.event_name} event={event} onDelete={handleDelete} />
          ))
        )}
      </div>
    </div>
  );
}
