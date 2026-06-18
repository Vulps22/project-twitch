import type { Reaction } from '../../../backend/src/types.js';

const ALL_REACTION_TYPES: Reaction['type'][] = ['chat_reply', 'overlay_text', 'image', 'sound', 'video'];

const TYPE_LABELS: Record<Reaction['type'], string> = {
  chat_reply:   'Chat Reply',
  overlay_text: 'Overlay Text',
  image:        'Image',
  sound:        'Sound',
  video:        'Video',
};

const TRANSITION_IN  = ['', 'fade-in', 'bounce-in', 'scale-in', 'slide-right-in', 'slide-left-in'];
const TRANSITION_OUT = ['', 'fade-out', 'bounce-out', 'scale-out', 'slide-right-out', 'slide-left-out'];

const TEMPLATE_HINT = '{{username}}, {{display_name}}, {{count}}';

export function defaultReaction(type: Reaction['type']): Reaction {
  switch (type) {
    case 'chat_reply':   return { type: 'chat_reply', message: '' };
    case 'overlay_text': return { type: 'overlay_text', text: '' };
    case 'image':        return { type: 'image', url: '' };
    case 'sound':        return { type: 'sound', filename: '' };
    case 'video':        return { type: 'video', filename: '' };
  }
}

interface Props {
  reaction: Reaction;
  usedTypes: Set<Reaction['type']>;
  onChange: (r: Reaction) => void;
  onRemove: () => void;
}

export default function ReactionCard({ reaction, usedTypes, onChange, onRemove }: Props) {
  const availableTypes = ALL_REACTION_TYPES.filter(t => t === reaction.type || !usedTypes.has(t));

  function handleTypeChange(newType: Reaction['type']) {
    onChange(defaultReaction(newType));
  }

  return (
    <div className="card" style={{ padding: 14, marginBottom: 10, position: 'relative' }}>
      <button
        onClick={onRemove}
        style={{ position: 'absolute', top: 10, right: 10, background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}
        title="Remove reaction"
      >×</button>

      <div className="field" style={{ marginBottom: 12 }}>
        <label>TYPE</label>
        <select value={reaction.type} onChange={e => handleTypeChange(e.target.value as Reaction['type'])}>
          {availableTypes.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
        </select>
      </div>

      {reaction.type === 'chat_reply' && (
        <div className="field" style={{ marginBottom: 0 }}>
          <label>MESSAGE</label>
          <input
            value={reaction.message}
            onChange={e => onChange({ ...reaction, message: e.target.value })}
            placeholder="Your message here..."
          />
          <div className="field-hint">{TEMPLATE_HINT}</div>
        </div>
      )}

      {reaction.type === 'overlay_text' && <>
        <div className="field">
          <label>TEXT</label>
          <input
            value={reaction.text}
            onChange={e => onChange({ ...reaction, text: e.target.value })}
            placeholder="Text to display..."
          />
          <div className="field-hint">{TEMPLATE_HINT}</div>
        </div>
        <TransitionFields reaction={reaction} onChange={onChange} />
        <TimeoutField reaction={reaction} onChange={onChange} />
      </>}

      {reaction.type === 'image' && <>
        <div className="field">
          <label>URL</label>
          <input
            value={reaction.url}
            onChange={e => onChange({ ...reaction, url: e.target.value })}
            placeholder="lurk.png"
          />
        </div>
        {reaction.url && (
          <img
            src={`/assets/img/${reaction.url}`}
            alt="preview"
            style={{ maxHeight: 80, maxWidth: '100%', borderRadius: 4, marginBottom: 12, objectFit: 'contain', background: 'var(--bg)' }}
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
            onLoad={e => { (e.target as HTMLImageElement).style.display = 'block'; }}
          />
        )}
        <OffsetFields reaction={reaction} onChange={onChange} />
        <TransitionFields reaction={reaction} onChange={onChange} />
        <TimeoutField reaction={reaction} onChange={onChange} />
      </>}

      {reaction.type === 'sound' && <>
        <div className="field">
          <label>FILENAME</label>
          <input
            value={reaction.filename}
            onChange={e => onChange({ ...reaction, filename: e.target.value })}
            placeholder="sound.mp3"
          />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>VOLUME (0–1)</label>
          <input
            type="number"
            min={0} max={1} step={0.1}
            value={reaction.volume ?? 0.5}
            onChange={e => onChange({ ...reaction, volume: parseFloat(e.target.value) })}
          />
        </div>
      </>}

      {reaction.type === 'video' && <>
        <div className="field">
          <label>FILENAME</label>
          <input
            value={reaction.filename}
            onChange={e => onChange({ ...reaction, filename: e.target.value })}
            placeholder="video.mp4"
          />
        </div>
        <OffsetFields reaction={reaction} onChange={onChange} />
        <TransitionFields reaction={reaction} onChange={onChange} />
        <TimeoutField reaction={reaction} onChange={onChange} />
      </>}
    </div>
  );
}

type WithTransitions = { transition_in?: string; transition_out?: string };
type WithTimeout     = { timeout?: string };
type WithOffsets     = { offsetX?: number; offsetY?: number; offsetZ?: number };

function TransitionFields<T extends WithTransitions>({ reaction, onChange }: { reaction: T; onChange: (r: T) => void }) {
  return (
    <div className="field-row" style={{ marginBottom: 12 }}>
      <div className="field" style={{ marginBottom: 0 }}>
        <label>TRANSITION IN</label>
        <select value={reaction.transition_in ?? ''} onChange={e => onChange({ ...reaction, transition_in: e.target.value || undefined })}>
          {TRANSITION_IN.map(t => <option key={t} value={t}>{t || '(none)'}</option>)}
        </select>
      </div>
      <div className="field" style={{ marginBottom: 0 }}>
        <label>TRANSITION OUT</label>
        <select value={reaction.transition_out ?? ''} onChange={e => onChange({ ...reaction, transition_out: e.target.value || undefined })}>
          {TRANSITION_OUT.map(t => <option key={t} value={t}>{t || '(none)'}</option>)}
        </select>
      </div>
    </div>
  );
}

function TimeoutField<T extends WithTimeout>({ reaction, onChange }: { reaction: T; onChange: (r: T) => void }) {
  return (
    <div className="field" style={{ marginBottom: 0 }}>
      <label>TIMEOUT</label>
      <input
        value={reaction.timeout ?? ''}
        onChange={e => onChange({ ...reaction, timeout: e.target.value || undefined })}
        placeholder="6s"
      />
      <div className="field-hint">e.g. 6s, 20s</div>
    </div>
  );
}

function OffsetFields<T extends WithOffsets>({ reaction, onChange }: { reaction: T; onChange: (r: T) => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
      {(['offsetX', 'offsetY', 'offsetZ'] as const).map(key => (
        <div className="field" key={key} style={{ marginBottom: 0 }}>
          <label>{key.toUpperCase()}</label>
          <input
            type="number"
            value={reaction[key] ?? 0}
            onChange={e => onChange({ ...reaction, [key]: parseInt(e.target.value, 10) || 0 })}
          />
        </div>
      ))}
    </div>
  );
}
