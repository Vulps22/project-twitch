import { readdir } from 'fs/promises';
import { pathToFileURL } from 'url';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Handler } from './base/Handler.js';
import { BaseEventType } from './event-types/BaseEventType.js';
import Logger from './utils/Logger.js';
import type { EventConfig, TwitchRawEvent, TemplateData, ITwitchClient, IOverlayBroadcaster } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export class EventRouter extends Handler {
    eventTypes: BaseEventType[];
    configs: EventConfig[];

    constructor(
        twitchClient: ITwitchClient | null = null,
        overlayBroadcasterService: IOverlayBroadcaster | null = null
    ) {
        super(twitchClient, overlayBroadcasterService);
        this.eventTypes = [];
        this.configs = [];
    }

    async init(): Promise<void> {
        await this.loadEventTypes();
        Logger.info('EventRouter: Ready');
    }

    setConfigs(configs: EventConfig[] | Record<string, EventConfig>): void {
        this.configs = Array.isArray(configs) ? configs : Object.values(configs);
        Logger.info(`EventRouter: Loaded ${this.configs.length} event configs`);
    }

    async route(rawEvent: TwitchRawEvent): Promise<void> {
        Logger.info(`EventRouter: Routing "${rawEvent.subscriptionType}"`);
        let matched = false;
        for (const eventType of this.eventTypes) {
            for (const config of this.configs) {
                if (eventType.match(rawEvent, config)) {
                    Logger.info(`EventRouter: Matched [${eventType.type}] → "${config.event_name}"`);
                    const templateData: TemplateData = eventType.extractTemplateData(rawEvent);
                    await this.executeConfig(config, templateData);
                    matched = true;
                }
            }
        }
        if (!matched) {
            Logger.info(`EventRouter: No match for "${rawEvent.subscriptionType}"`);
        }
    }

    protected async loadEventTypes(): Promise<void> {
        const dir = join(__dirname, 'event-types');
        const files = await readdir(dir);

        for (const file of files) {
            // Accept .js (compiled) and .ts (tsx dev mode); skip declaration files
            if (file.endsWith('.d.ts')) continue;
            if (!file.endsWith('.js') && !file.endsWith('.ts')) continue;

            const module = await import(pathToFileURL(join(dir, file)).href) as Record<string, unknown>;

            for (const exported of Object.values(module)) {
                if (
                    typeof exported === 'function'
                    && (exported as { prototype: unknown }).prototype instanceof BaseEventType
                ) {
                    this.eventTypes.push(new (exported as new () => BaseEventType)());
                }
            }
        }

        Logger.info('EventRouter: Loaded event types:', this.eventTypes.map(et => et.type));
    }
}
