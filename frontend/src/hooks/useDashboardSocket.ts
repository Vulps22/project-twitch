import { useEffect, useState } from 'react';

export interface ChatFlash {
    userId: string
    username: string
}

export function useDashboardSocket(): ChatFlash | null {
    const [flash, setFlash] = useState<ChatFlash | null>(null);

    useEffect(() => {
        const wsUrl = `ws://${window.location.host}/ws/dashboard`;
        const ws = new WebSocket(wsUrl);

        ws.onmessage = (e) => {
            try {
                const event = JSON.parse(e.data as string) as { type: string; userId: string; username: string };
                if (event.type === 'chat') {
                    setFlash({ userId: event.userId, username: event.username });
                }
            } catch { /* ignore malformed messages */ }
        };

        return () => ws.close();
    }, []);

    return flash;
}
