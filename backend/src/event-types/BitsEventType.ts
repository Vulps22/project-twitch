import { BaseEventType } from './BaseEventType.js';
import type { EventConfig, TemplateData, TwitchRawEvent } from '../types.js';

export class BitsEventType extends BaseEventType {

    get type(): string { return 'bits'; }

    match(rawEvent: TwitchRawEvent, config: EventConfig): boolean {
        return rawEvent.subscriptionType === 'channel.cheer'
            && config.event_type === this.type;
    }

    extractTemplateData(rawEvent: TwitchRawEvent): TemplateData {
        const event = rawEvent.event as {
            is_anonymous: boolean;
            user_name: string;
            user_id: string;
            bits: number;
        };
        return {
            username: event.is_anonymous ? 'Anonymous' : event.user_name,
            display_name: event.is_anonymous ? 'Anonymous' : event.user_name,
            user_id: event.user_id ?? '',
            count: String(event.bits)
        };
    }
}
