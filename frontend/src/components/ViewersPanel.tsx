import { useEffect, useRef, useState } from 'react';
import type { ChatFlash } from '../hooks/useDashboardSocket.ts';
import type { Viewer } from '../hooks/useViewers.ts';

// 5 pentatonic ratios × 4 octaves = 20 unique pitches, all musically consonant
const PENTATONIC_RATIOS = [1, 1.125, 1.25, 1.5, 1.667];
const BASE_FREQ = 130.81; // C3
const OCTAVES = 4;

function userFrequency(userId: string): number {
    let hash = 0;
    for (const ch of userId) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    const note   = hash % PENTATONIC_RATIOS.length;
    const octave = (hash >>> 8) % OCTAVES;
    return BASE_FREQ * PENTATONIC_RATIOS[note] * Math.pow(2, octave);
}

let sharedAudioCtx: AudioContext | null = null;

function playBeep(userId: string): void {
    try {
        sharedAudioCtx ??= new AudioContext();
        void sharedAudioCtx.resume().then(() => {
            const ctx = sharedAudioCtx!;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = userFrequency(userId);
            gain.gain.setValueAtTime(0.2, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
            osc.start();
            osc.stop(ctx.currentTime + 0.5);
        });
    } catch { /* AudioContext unavailable */ }
}

type ActionMode = 'timeout' | 'ban-confirm';
interface ActiveAction { userId: string; mode: ActionMode }

const btnBase: React.CSSProperties = {
    fontSize: 11,
    padding: '2px 6px',
    borderRadius: 4,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text)',
    cursor: 'pointer',
};

const btnDanger: React.CSSProperties = { ...btnBase, color: '#f87171' };

export default function ViewersPanel({ flash }: { flash: ChatFlash | null }) {
    const [viewers, setViewers] = useState<Viewer[]>([]);
    const [flashing, setFlashing] = useState<Set<string>>(new Set());
    const [hoveredUserId, setHoveredUserId] = useState<string | null>(null);
    const [activeAction, setActiveAction] = useState<ActiveAction | null>(null);
    const [customDuration, setCustomDuration] = useState('');
    const prevFlash = useRef<ChatFlash | null>(null);

    // Base poll — syncs the full list from the server
    useEffect(() => {
        const load = () =>
            fetch('/api/viewers')
                .then(r => r.json() as Promise<Viewer[]>)
                .then(setViewers)
                .catch(() => {});
        load();
        const id = setInterval(load, 30_000);
        return () => clearInterval(id);
    }, []);

    // Real-time update — increment count immediately on WS event
    useEffect(() => {
        if (!flash || flash === prevFlash.current) return;
        prevFlash.current = flash;

        playBeep(flash.userId);

        setFlashing(prev => new Set(prev).add(flash.userId));
        const timeout = setTimeout(() => {
            setFlashing(prev => {
                const next = new Set(prev);
                next.delete(flash.userId);
                return next;
            });
        }, 2000);

        setViewers(prev => {
            const exists = prev.some(v => v.userId === flash.userId);
            if (exists) {
                return prev.map(v =>
                    v.userId === flash.userId
                        ? { ...v, messageCount: v.messageCount + 1 }
                        : v
                );
            }
            return [...prev, { userId: flash.userId, username: flash.username, watchTime: 0, messageCount: 1, bits: 0, subs: 0, pointsRedeemed: 0 }];
        });

        return () => clearTimeout(timeout);
    }, [flash]);

    const handleTimeout = async (userId: string, duration: number) => {
        await fetch(`/api/mod/timeout/${userId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ duration }),
        }).catch(() => {});
        setActiveAction(null);
    };

    const handleBan = async (userId: string) => {
        await fetch(`/api/mod/ban/${userId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
        }).catch(() => {});
        setActiveAction(null);
    };

    const renderActions = (viewer: Viewer) => {
        const action = activeAction?.userId === viewer.userId ? activeAction.mode : null;
        const isVisible = hoveredUserId === viewer.userId || action !== null;

        if (action === 'timeout') {
            return (
                <td style={{ padding: '4px 0', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' }}>
                        {([{ label: '60s', secs: 60 }, { label: '10m', secs: 600 }, { label: '1h', secs: 3600 }] as const).map(p => (
                            <button key={p.secs} style={btnBase} onClick={() => void handleTimeout(viewer.userId, p.secs)}>
                                {p.label}
                            </button>
                        ))}
                        <input
                            type="number"
                            placeholder="custom"
                            value={customDuration}
                            onChange={e => setCustomDuration(e.target.value)}
                            style={{ width: 56, fontSize: 11, background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 4px' }}
                        />
                        <button style={btnBase} onClick={() => { const d = parseInt(customDuration, 10); if (d > 0) void handleTimeout(viewer.userId, d); }}>
                            Go
                        </button>
                        <button style={btnBase} onClick={() => setActiveAction(null)}>✕</button>
                    </div>
                </td>
            );
        }

        if (action === 'ban-confirm') {
            return (
                <td style={{ padding: '4px 0', textAlign: 'right' }}>
                    <span style={{ color: 'var(--muted)', fontSize: 12, marginRight: 6 }}>Ban {viewer.username}?</span>
                    <button style={{ ...btnBase, color: '#f87171', marginRight: 4 }} onClick={() => void handleBan(viewer.userId)}>
                        Confirm
                    </button>
                    <button style={btnBase} onClick={() => setActiveAction(null)}>Cancel</button>
                </td>
            );
        }

        return (
            <td style={{ padding: '4px 0', textAlign: 'right' }}>
                {isVisible && (
                    <>
                        <button style={{ ...btnBase, marginRight: 4 }} onClick={() => { setActiveAction({ userId: viewer.userId, mode: 'timeout' }); setCustomDuration(''); }}>
                            Timeout
                        </button>
                        <button style={btnDanger} onClick={() => setActiveAction({ userId: viewer.userId, mode: 'ban-confirm' })}>
                            Ban
                        </button>
                    </>
                )}
            </td>
        );
    };

    return (
        <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: 24,
        }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                Viewers ({viewers.length})
            </h3>
            {viewers.length === 0 ? (
                <p style={{ color: 'var(--muted)', fontSize: 13, margin: 0 }}>No viewers yet</p>
            ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                        <tr style={{ color: 'var(--muted)', textAlign: 'left' }}>
                            <th style={{ paddingBottom: 8, fontWeight: 500 }}>Username</th>
                            <th style={{ paddingBottom: 8, fontWeight: 500, textAlign: 'right' }}>Msgs</th>
                            <th style={{ paddingBottom: 8, fontWeight: 500, textAlign: 'right' }}>Bits</th>
                            <th style={{ paddingBottom: 8, fontWeight: 500, textAlign: 'right' }}>Subs</th>
                            <th style={{ paddingBottom: 8, fontWeight: 500, textAlign: 'right' }}>Points</th>
                            <th style={{ paddingBottom: 8, fontWeight: 500, textAlign: 'right' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {viewers.map(viewer => (
                            <tr
                                key={viewer.userId}
                                onMouseEnter={() => setHoveredUserId(viewer.userId)}
                                onMouseLeave={() => setHoveredUserId(prev => prev === viewer.userId ? null : prev)}
                                style={{
                                    color: flashing.has(viewer.userId) ? '#4ade80' : 'var(--text)',
                                    transition: 'color 0.3s ease',
                                    borderTop: '1px solid var(--border)',
                                }}
                            >
                                <td style={{ padding: '6px 0' }}>{viewer.username}</td>
                                <td style={{ padding: '6px 0', textAlign: 'right' }}>{viewer.messageCount}</td>
                                <td style={{ padding: '6px 0', textAlign: 'right' }}>{viewer.bits.toLocaleString()}</td>
                                <td style={{ padding: '6px 0', textAlign: 'right' }}>{viewer.subs}</td>
                                <td style={{ padding: '6px 0', textAlign: 'right' }}>{viewer.pointsRedeemed.toLocaleString()}</td>
                                {renderActions(viewer)}
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}
