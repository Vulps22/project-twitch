import { BaseEventType } from './BaseEventType.js';
import type { EventConfig, TemplateData, TwitchRawEvent } from '../types.js';

export class ChatCommandEventType extends BaseEventType {

    get type(): string { return 'chat_command'; }

    match(rawEvent: TwitchRawEvent, config: EventConfig): boolean {
        if (rawEvent.subscriptionType !== 'channel.chat.message') return false;
        if (config.event_type !== this.type) return false;
        const event = rawEvent.event as { message: { text: string } };
        const command = this.#parseCommand(event.message.text);
        return command !== null && (config.trigger_on ?? []).includes(command);
    }

    extractTemplateData(rawEvent: TwitchRawEvent): TemplateData {
        const event = rawEvent.event as {
            chatter_user_name: string;
            chatter_user_display_name: string;
            chatter_user_id: string;
        };
        return {
            username: event.chatter_user_name,
            display_name: event.chatter_user_display_name,
            user_id: event.chatter_user_id
        };
    }

    #parseCommand(text: string): string | null {
        if (!text?.startsWith('!')) return null;
        return text.substring(1).split(' ')[0].toLowerCase();
    }
}
