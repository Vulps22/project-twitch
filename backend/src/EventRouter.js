import { readdir } from 'fs/promises';
import { pathToFileURL } from 'url';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Handler } from './base/Handler.js';
import { BaseEventType } from './event-types/BaseEventType.js';
import Logger from './utils/Logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export class EventRouter extends Handler {

    constructor(twitchClient = null, overlayBroadcasterService = null) {
        super(twitchClient, overlayBroadcasterService);
        this.eventTypes = [];
        this.configs = [];
    }

    async init() {
        await this.#loadEventTypes();
        Logger.info('EventRouter: Ready');
    }

    /** Accepts either an array or a keyed object of event configs */
    setConfigs(configs) {
        this.configs = Array.isArray(configs) ? configs : Object.values(configs);
        Logger.info(`EventRouter: Loaded ${this.configs.length} event configs`);
    }

    /**
     * Route a raw platform event through all registered event types.
     * @param {{ subscriptionType: string, event: object }} rawEvent
     */
    async route(rawEvent) {
        for (const eventType of this.eventTypes) {
            for (const config of this.configs) {
                if (eventType.match(rawEvent, config)) {
                    const templateData = eventType.extractTemplateData(rawEvent);
                    await this.executeConfig(config, templateData);
                }
            }
        }
    }

    async #loadEventTypes() {
        const dir = join(__dirname, 'event-types');
        const files = await readdir(dir);

        for (const file of files) {
            if (!file.endsWith('.js')) continue;

            const module = await import(pathToFileURL(join(dir, file)).href);

            for (const exported of Object.values(module)) {
                if (typeof exported === 'function'
                    && exported.prototype instanceof BaseEventType) {
                    this.eventTypes.push(new exported());
                }
            }
        }

        Logger.info('EventRouter: Loaded event types:', this.eventTypes.map(et => et.type));
    }
}

export default EventRouter;
