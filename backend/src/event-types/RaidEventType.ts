import { BaseEventType } from './BaseEventType.js';
import type { EventConfig, TemplateData, TwitchRawEvent } from '../types.js';

export class RaidEventType extends BaseEventType {

    get type(): string { return 'raid'; }

    match(rawEvent: TwitchRawEvent, config: EventConfig): boolean {
        return rawEvent.subscriptionType === 'channel.raid'
            && config.event_type === this.type;
    }

    extractTemplateData(rawEvent: TwitchRawEvent): TemplateData {
        const event = rawEvent.event as {
            from_broadcaster_user_name: string;
            from_broadcaster_user_id: string;
            viewers: number;
        };
        return {
            username: event.from_broadcaster_user_name,
            display_name: event.from_broadcaster_user_name,
            user_id: event.from_broadcaster_user_id,
            count: String(event.viewers)
        };
    }
}
