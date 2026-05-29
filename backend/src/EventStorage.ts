import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { EventConfig } from './types.js';
import { EVENTS } from '../config/events.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(__dirname, '../../data/events.json');

export class EventStorage {
    private events: Record<string, EventConfig> = {};
    private loaded = false;

    async load(): Promise<void> {
        try {
            const raw = await readFile(DATA_PATH, 'utf-8');
            this.events = JSON.parse(raw);
        } catch (err: unknown) {
            if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
            this.events = { ...EVENTS };
            await this.persist();
        }
        this.loaded = true;
    }

    getAll(): EventConfig[] {
        this.assertLoaded();
        return Object.values(this.events);
    }

    async delete(name: string): Promise<boolean> {
        this.assertLoaded();
        if (!(name in this.events)) return false;
        delete this.events[name];
        await this.persist();
        return true;
    }

    private async persist(): Promise<void> {
        await mkdir(dirname(DATA_PATH), { recursive: true });
        await writeFile(DATA_PATH, JSON.stringify(this.events, null, 2), 'utf-8');
    }

    private assertLoaded(): void {
        if (!this.loaded) throw new Error('EventStorage: call load() before use');
    }
}

export default new EventStorage();
