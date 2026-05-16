import { BaseEventType } from './BaseEventType.js';
import type { EventConfig, TemplateData, TwitchRawEvent } from '../types.js';

const SUBSCRIPTION_TYPE = 'channel.channel_points_custom_reward_redemption.add';

export class ChannelPointsRedemptionEventType extends BaseEventType {

    get type(): string { return 'channel_points_redemption'; }

    match(rawEvent: TwitchRawEvent, config: EventConfig): boolean {
        if (rawEvent.subscriptionType !== SUBSCRIPTION_TYPE) return false;
        if (config.event_type !== this.type) return false;
        const event = rawEvent.event as { reward: { title: string } };
        return (config.trigger_on ?? []).includes(event.reward.title);
    }

    extractTemplateData(rawEvent: TwitchRawEvent): TemplateData {
        const event = rawEvent.event as {
            user_name: string;
            user_id: string;
            reward: { title: string };
            user_input?: string;
        };
        return {
            username: event.user_name,
            display_name: event.user_name,
            user_id: event.user_id,
            reward: event.reward.title,
            user_input: event.user_input ?? ''
        };
    }
}
