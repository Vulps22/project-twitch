import { useState } from 'react';
import type { EventConfig, Reaction } from '../../../backend/src/types.js';
import ReactionCard, { defaultReaction } from './ReactionCard.js';

const EVENT_TYPES = [
  'chat_command',
  'chat_contains',
  'follow',
  'subscription',
  'raid',
  'bits',
  'channel_points_redemption',
];

const TRIGGER_REQUIRED = new Set(['chat_command', 'chat_contains', 'channel_points_redemption']);

const TRIGGER_LABELS: Record<string, string> = {
  chat_command:               'Commands (comma-separated, without !)',
  chat_contains:              'Phrases (comma-separated)',
  channel_points_redemption:  'Reward titles (comma-separated)',
};

const ALL_REACTION_TYPES: Reaction['type'][] = ['chat_reply', 'overlay_text', 'image', 'sound', 'video'];

interface Props {
  event: EventConfig | null; // null = create mode
  onSave: (event: EventConfig) => void;
  onClose: () => void;
}

interface FormState {
  event_name: string;
  event_type: string;
  trigger_on: string;
  reactions: Reaction[];
}

export default function EventModal({ event, onSave, onClose }: Props) {
  const isCreate = event === null;

  const [form, setForm] = useState<FormState>({
    event_name:  event?.event_name  ?? '',
    event_type:  event?.event_type  ?? 'chat_command',
    trigger_on:  event?.trigger_on?.join(', ') ?? '',
    reactions:   event?.reactions   ?? [],
  });

  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const usedTypes = new Set(form.reactions.map(r => r.type));
  const availableTypes = ALL_REACTION_TYPES.filter(t => !usedTypes.has(t));

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function addReaction(type: Reaction['type']) {
    setForm(prev => ({ ...prev, reactions: [...prev.reactions, defaultReaction(type)] }));
    setAddMenuOpen(false);
  }

  function updateReaction(index: number, reaction: Reaction) {
    setForm(prev => {
      const reactions = [...prev.reactions];
      reactions[index] = reaction;
      return { ...prev, reactions };
    });
  }

  function removeReaction(index: number) {
    setForm(prev => ({ ...prev, reactions: prev.reactions.filter((_, i) => i !== index) }));
  }

  async function handleSave() {
    if (!form.event_name.trim()) { setError('Event name is required'); return; }
    if (!form.event_type)        { setError('Event type is required'); return; }

    const config: EventConfig = {
      event_name: form.event_name.trim(),
      event_type: form.event_type,
      reactions:  form.reactions,
    };

    if (TRIGGER_REQUIRED.has(form.event_type)) {
      config.trigger_on = form.trigger_on.split(',').map(s => s.trim()).filter(Boolean);
    }

    setSaving(true);
    setError(null);

    try {
      const url    = isCreate ? '/api/events' : `/api/events/${encodeURIComponent(event!.event_name)}`;
      const method = isCreate ? 'POST' : 'PUT';
      const res    = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Save failed'); return; }
      onSave(config);
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="card" style={{ width: 560, height: '92vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>{isCreate ? 'New event' : `Edit: ${event!.event_name}`}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>

        {/* Fixed fields — event name, type, trigger */}
        <div style={{ padding: '20px 20px 0', flexShrink: 0 }}>
          <div className="field">
            <label>EVENT NAME</label>
            <input
              value={form.event_name}
              onChange={e => setField('event_name', e.target.value)}
              placeholder="my_event"
              disabled={!isCreate}
              style={!isCreate ? { opacity: 0.5 } : {}}
            />
          </div>

          <div className="field">
            <label>EVENT TYPE</label>
            <select value={form.event_type} onChange={e => setField('event_type', e.target.value)}>
              {EVENT_TYPES.map(t => (
                <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>

          {TRIGGER_REQUIRED.has(form.event_type) && (
            <div className="field">
              <label>{TRIGGER_LABELS[form.event_type]?.toUpperCase() ?? 'TRIGGER ON'}</label>
              <input
                value={form.trigger_on}
                onChange={e => setField('trigger_on', e.target.value)}
                placeholder={form.event_type === 'chat_command' ? 'lurk, hype' : form.event_type === 'chat_contains' ? 'gg, poggers' : 'My Reward'}
              />
            </div>
          )}

          {/* Reactions header + add button */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span className="section-title">Reactions</span>
            <div style={{ position: 'relative' }}>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setAddMenuOpen(o => !o)}
                disabled={availableTypes.length === 0}
              >+ Add reaction</button>
              {addMenuOpen && (
                <div style={{
                  position: 'absolute', right: 0, top: '100%', marginTop: 4,
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 6, zIndex: 10, minWidth: 160, overflow: 'hidden',
                }}>
                  {availableTypes.map(t => (
                    <button
                      key={t}
                      onClick={() => addReaction(t)}
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 14px', background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', fontSize: 13 }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--border)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                    >
                      {t.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Scrollable reactions list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px' }}>
          {form.reactions.length === 0 && (
            <p style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
              No reactions yet. Add one above.
            </p>
          )}
          {form.reactions.map((reaction, i) => (
            <ReactionCard
              key={`${reaction.type}-${i}`}
              reaction={reaction}
              usedTypes={usedTypes}
              onChange={r => updateReaction(i, r)}
              onRemove={() => removeReaction(i)}
            />
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          {error && <span style={{ color: 'var(--red)', fontSize: 13 }}>{error}</span>}
          {!error && <span />}
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
