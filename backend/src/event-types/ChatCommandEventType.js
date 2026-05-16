import { BaseEventType } from './BaseEventType.js';

export class ChatCommandEventType extends BaseEventType {

    get type() { return 'chat_command'; }

    match(rawEvent, config) {
        if (rawEvent.subscriptionType !== 'channel.chat.message') return false;
        if (config.event_type !== this.type) return false;
        const command = this.#parseCommand(rawEvent.event.message.text);
        return command !== null && (config.trigger_on ?? []).includes(command);
    }

    extractTemplateData(rawEvent) {
        const { event } = rawEvent;
        return {
            username: event.chatter_user_name,
            display_name: event.chatter_user_display_name,
            user_id: event.chatter_user_id
        };
    }

    /** @returns {string|null} Command name without the leading '!', or null if not a command */
    #parseCommand(text) {
        if (!text?.startsWith('!')) return null;
        return text.substring(1).split(' ')[0].toLowerCase();
    }
}
