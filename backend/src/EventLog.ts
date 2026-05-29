import { randomUUID } from 'crypto';
import Logger from './utils/Logger.js';

export interface LogEntry {
    id: string;
    eventName: string;
    eventType: string;
    subscriptionType: string;
    username: string;
    detail: string;
    timestamp: Date;
    data: Record<string, unknown>;
}

const MAX_ENTRIES = 500;

class EventLog {
    private entries: LogEntry[] = [];

    append(entry: Omit<LogEntry, 'id' | 'timestamp'>): void {
        this.entries.unshift({
            id: randomUUID(),
            timestamp: new Date(),
            ...entry,
        });

        if (this.entries.length > MAX_ENTRIES) {
            this.entries.length = MAX_ENTRIES;
        }
    }

    getAll(): LogEntry[] {
        return this.entries;
    }

    getById(id: string): LogEntry | undefined {
        return this.entries.find(e => e.id === id);
    }

    reset(): void {
        this.entries = [];
        Logger.info('EventLog: cleared for new stream');
    }
}

export default new EventLog();
