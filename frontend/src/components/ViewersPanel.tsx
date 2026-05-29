import { useEffect, useRef, useState } from 'react';
import { useDashboardSocket } from '../hooks/useDashboardSocket.ts';
import type { Viewer } from '../hooks/useViewers.ts';

interface ChatFlash {
    userId: string
    username: string
}

function formatWatchTime(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`;
}

// Pentatonic scale across two octaves — any combination sounds pleasant
const PENTATONIC_HZ = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 784.00, 880.00];

function userFrequency(userId: string): number {
    let hash = 0;
    for (const ch of userId) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    return PENTATONIC_HZ[hash % PENTATONIC_HZ.length];
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
            gain.gain.setValueAtTime(0.08, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
            osc.start();
            osc.stop(ctx.currentTime + 0.12);
        });
    } catch { /* AudioContext unavailable */ }
}

export default function ViewersPanel() {
    const [viewers, setViewers] = useState<Viewer[]>([]);
    const flash = useDashboardSocket();
    const [flashing, setFlashing] = useState<Set<string>>(new Set());
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
            return [...prev, { userId: flash.userId, username: flash.username, watchTime: 0, messageCount: 1 }];
        });

        return () => clearTimeout(timeout);
    }, [flash]);

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
                            <th style={{ paddingBottom: 8, fontWeight: 500 }}>Watching for</th>
                            <th style={{ paddingBottom: 8, fontWeight: 500, textAlign: 'right' }}>Messages</th>
                        </tr>
                    </thead>
                    <tbody>
                        {viewers.map(viewer => (
                            <tr
                                key={viewer.userId}
                                style={{
                                    color: flashing.has(viewer.userId) ? '#4ade80' : 'var(--text)',
                                    transition: 'color 0.3s ease',
                                    borderTop: '1px solid var(--border)',
                                }}
                            >
                                <td style={{ padding: '6px 0' }}>{viewer.username}</td>
                                <td style={{ padding: '6px 0' }}>{formatWatchTime(viewer.watchTime)}</td>
                                <td style={{ padding: '6px 0', textAlign: 'right' }}>{viewer.messageCount}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}
