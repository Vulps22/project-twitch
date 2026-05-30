import { useEffect, useState } from 'react';

export interface Viewer {
    userId: string
    username: string
    watchTime: number
    messageCount: number
    bits: number
    subs: number
    pointsRedeemed: number
}

export function useViewers(): Viewer[] {
    const [viewers, setViewers] = useState<Viewer[]>([]);

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

    return viewers;
}
