import { readdir } from 'fs/promises';
import { pathToFileURL } from 'url';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Handler } from './base/Handler.js';
import { BaseEventType } from './event-types/BaseEventType.js';
import Logger from './utils/Logger.js';
import type { EventConfig, TwitchRawEvent, TemplateData, ITwitchClient, IOverlayBroadcaster } from './types.js';
import sessionStats from './SessionStats.js';
import eventLog from './EventLog.js';
import viewerTracker from './ViewerTracker.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function extractDetail(subscriptionType: string, event: Record<string, unknown>): string {
    switch (subscriptionType) {
        case 'channel.follow':
            return 'Followed the channel';
        case 'channel.subscribe': {
            const tier = String(event['tier'] ?? '1000');
            const tierLabel = tier === '3000' ? 'Tier 3' : tier === '2000' ? 'Tier 2' : 'Tier 1';
            return `Subscribed (${tierLabel})`;
        }
        case 'channel.cheer':
            return `Cheered ${event['bits'] ?? '?'} bits`;
        case 'channel.raid':
            return `Raided with ${event['viewers'] ?? '?'} viewers`;
        case 'channel.chat.message': {
            const msg = event['message'] as Record<string, unknown> | undefined;
            return String(msg?.['text'] ?? '');
        }
        case 'channel.channel_points_custom_reward_redemption.add': {
            const reward = event['reward'] as Record<string, unknown> | undefined;
            return `Redeemed: ${reward?.['title'] ?? 'Unknown reward'}`;
        }
        default:
            return subscriptionType;
    }
}

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

    async route(rawEvent: TwitchRawEvent, replay = false): Promise<void> {
        Logger.info(`EventRouter: Routing "${rawEvent.subscriptionType}"${replay ? ' (replay)' : ''}`);
        sessionStats.recordEvent(rawEvent.subscriptionType, rawEvent.event);
        viewerTracker.recordEvent(rawEvent.subscriptionType, rawEvent.event);

        let matched = false;
        for (const eventType of this.eventTypes) {
            for (const config of this.configs) {
                if (eventType.match(rawEvent, config)) {
                    Logger.info(`EventRouter: Matched [${eventType.type}] → "${config.event_name}"`);
                    const templateData: TemplateData = eventType.extractTemplateData(rawEvent);
                    await this.executeConfig(config, templateData);

                    if (!replay) {
                        eventLog.append({
                            eventName:        config.event_name,
                            eventType:        config.event_type,
                            subscriptionType: rawEvent.subscriptionType,
                            username:         templateData['username'] ?? templateData['display_name'] ?? 'unknown',
                            detail:           extractDetail(rawEvent.subscriptionType, rawEvent.event),
                            data:             rawEvent.event,
                        });
                    }

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
