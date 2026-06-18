import { useEffect, useRef, useState } from 'react';
import type { ChatFlash } from '../hooks/useDashboardSocket.ts';

interface ChatMessage {
    id: number
    userId: string
    username: string
    message: string
}

let nextId = 0;

export default function ChatFeedPanel({ flash }: { flash: ChatFlash | null }) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const prevFlash = useRef<ChatFlash | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const isPausedRef = useRef(false);

    useEffect(() => {
        if (!flash || flash === prevFlash.current) return;
        prevFlash.current = flash;

        setMessages(prev => {
            const next = [...prev, { id: nextId++, userId: flash.userId, username: flash.username, message: flash.message }];
            return next.length > 200 ? next.slice(-200) : next;
        });
    }, [flash]);

    useEffect(() => {
        if (!isPausedRef.current && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    function onScroll() {
        const el = scrollRef.current;
        if (!el) return;
        const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
        isPausedRef.current = !atBottom;
    }

    return (
        <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
        }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600, color: 'var(--text)', flexShrink: 0 }}>
                Chat
            </h3>
            <div
                ref={scrollRef}
                onScroll={onScroll}
                style={{
                    overflowY: 'auto',
                    flex: 1,
                    minHeight: 120,
                    maxHeight: 400,
                }}
            >
                {messages.length === 0 ? (
                    <p style={{ color: 'var(--muted)', fontSize: 13, margin: 0 }}>No messages yet</p>
                ) : (
                    messages.map(msg => (
                        <div key={msg.id} style={{ fontSize: 13, marginBottom: 6, lineHeight: 1.4 }}>
                            <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{msg.username}</span>
                            <span style={{ color: 'var(--muted)' }}>: </span>
                            <span style={{ color: 'var(--text)' }}>{msg.message}</span>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
