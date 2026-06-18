import { useState } from 'react';
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

function validateAsset(value: string): string | null {
  if (!value) return null;
  if (!value.startsWith('http://') && !value.startsWith('https://')) return 'Must be a URL starting with http:// or https://';
  return null;
}

function convertGoogleUrl(value: string): string {
  const driveMatch = value.match(/drive\.google\.com\/file\/d\/([^/?#]+)/);
  if (driveMatch) return `https://drive.usercontent.google.com/download?id=${driveMatch[1]}&export=download&authuser=0`;

  const driveOpenMatch = value.match(/drive\.google\.com\/(?:open|uc)\?.*?[?&]id=([^&]+)/);
  if (driveOpenMatch) return `https://drive.usercontent.google.com/download?id=${driveOpenMatch[1]}&export=download&authuser=0`;

  return value;
}

function isGoogleUrl(value: string): boolean {
  return /drive\.google\.com|drive\.usercontent\.google\.com|photos\.google\.com/.test(value);
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
            onChange={e => onChange({ ...reaction, url: convertGoogleUrl(e.target.value) })}
            placeholder="https://example.com/image.png"
          />
          <AssetValidation value={reaction.url} />
        </div>
        <PreviewBox key={reaction.url} url={reaction.url} assetType="image" />
        <OffsetFields reaction={reaction} onChange={onChange} />
        <TransitionFields reaction={reaction} onChange={onChange} />
        <TimeoutField reaction={reaction} onChange={onChange} />
      </>}

      {reaction.type === 'sound' && <>
        <div className="field">
          <label>URL</label>
          <input
            value={reaction.filename}
            onChange={e => onChange({ ...reaction, filename: convertGoogleUrl(e.target.value) })}
            placeholder="https://example.com/sound.mp3"
          />
          <AssetValidation value={reaction.filename} />
        </div>
        <PreviewBox key={reaction.filename} url={reaction.filename} assetType="sound" />
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
          <label>URL</label>
          <input
            value={reaction.filename}
            onChange={e => onChange({ ...reaction, filename: convertGoogleUrl(e.target.value) })}
            placeholder="https://example.com/clip.mp4"
          />
          <AssetValidation value={reaction.filename} />
        </div>
        <PreviewBox key={reaction.filename} url={reaction.filename} assetType="video" />
        <OffsetFields reaction={reaction} onChange={onChange} />
        <TransitionFields reaction={reaction} onChange={onChange} />
        <TimeoutField reaction={reaction} onChange={onChange} />
      </>}
    </div>
  );
}

function AssetValidation({ value }: { value: string }) {
  if (!value) return null;
  const error = validateAsset(value);
  if (error) return <div className="field-hint" style={{ color: 'var(--red)' }}>{error}</div>;
  if (isGoogleUrl(value)) {
    return (
      <div className="field-hint" style={{ color: '#a970ff' }}>
        Your Google URL will be converted to a downloadable URL
      </div>
    );
  }
  return null;
}

type PreviewState = 'idle' | 'loading' | 'done' | 'error';

function PreviewBox({ url, assetType }: { url: string; assetType: 'image' | 'sound' | 'video' }) {
  const [state, setState] = useState<PreviewState>('idle');
  const [cachedPath, setCachedPath] = useState('');
  const [error, setError] = useState('');

  async function handlePreview() {
    setState('loading');
    setError('');
    try {
      const res = await fetch('/api/asset/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, assetType }),
      });
      const data = await res.json() as { path?: string; error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Preview failed');
        setState('error');
      } else {
        setCachedPath(data.path ?? '');
        setState('done');
      }
    } catch {
      setError('Network error');
      setState('error');
    }
  }

  const validUrl = url && !validateAsset(url);

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 4, padding: 8, marginBottom: 12 }}>
      <button
        onClick={handlePreview}
        disabled={!validUrl || state === 'loading'}
        style={{ fontSize: 12, padding: '3px 10px' }}
      >
        {state === 'loading' ? 'Loading…' : 'Preview'}
      </button>
      {state === 'error' && (
        <div className="field-hint" style={{ color: 'var(--red)', marginTop: 6 }}>{error}</div>
      )}
      {state === 'done' && assetType === 'image' && (
        <img src={cachedPath} alt="preview" style={{ maxHeight: 80, maxWidth: '100%', borderRadius: 4, marginTop: 6, objectFit: 'contain', display: 'block' }} />
      )}
      {state === 'done' && assetType === 'sound' && (
        <audio src={cachedPath} controls style={{ width: '100%', marginTop: 6 }} />
      )}
      {state === 'done' && assetType === 'video' && (
        <video src={cachedPath} controls style={{ maxWidth: '100%', maxHeight: 120, marginTop: 6, borderRadius: 4, display: 'block' }} />
      )}
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
