import { useEffect, useRef, useState } from 'react';
import { useViewers } from '../hooks/useViewers.ts';
import { useDashboardSocket } from '../hooks/useDashboardSocket.ts';

function formatWatchTime(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`;
}

function playBeep(): void {
    try {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
        osc.onended = () => ctx.close();
    } catch { /* AudioContext unavailable */ }
}

export default function ViewersPanel() {
    const viewers = useViewers();
    const flash = useDashboardSocket();
    const [flashing, setFlashing] = useState<Set<string>>(new Set());
    const prevFlash = useRef<ChatFlash | null>(null);

    useEffect(() => {
        if (!flash || flash === prevFlash.current) return;
        prevFlash.current = flash;

        playBeep();

        setFlashing(prev => new Set(prev).add(flash.userId));
        const timeout = setTimeout(() => {
            setFlashing(prev => {
                const next = new Set(prev);
                next.delete(flash.userId);
                return next;
            });
        }, 2000);

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

interface ChatFlash {
    userId: string
    username: string
}
