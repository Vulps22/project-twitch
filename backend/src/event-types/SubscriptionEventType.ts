import { BaseEventType } from './BaseEventType.js';
import type { EventConfig, TemplateData, TwitchRawEvent } from '../types.js';

export class SubscriptionEventType extends BaseEventType {

    get type(): string { return 'subscription'; }

    match(rawEvent: TwitchRawEvent, config: EventConfig): boolean {
        return rawEvent.subscriptionType === 'channel.subscribe'
            && config.event_type === this.type;
    }

    extractTemplateData(rawEvent: TwitchRawEvent): TemplateData {
        const event = rawEvent.event as {
            user_name: string;
            user_id: string;
            tier: string;
        };
        return {
            username: event.user_name,
            display_name: event.user_name,
            user_id: event.user_id,
            tier: event.tier
        };
    }
}
