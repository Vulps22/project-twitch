import { BaseEventType } from './BaseEventType.js';

const SUBSCRIPTION_TYPE = 'channel.channel_points_custom_reward_redemption.add';

export class ChannelPointsRedemptionEventType extends BaseEventType {

    get type() { return 'channel_points_redemption'; }

    match(rawEvent, config) {
        if (rawEvent.subscriptionType !== SUBSCRIPTION_TYPE) return false;
        if (config.event_type !== this.type) return false;
        return (config.trigger_on ?? []).includes(rawEvent.event.reward.title);
    }

    extractTemplateData(rawEvent) {
        const { event } = rawEvent;
        return {
            username: event.user_name,
            display_name: event.user_name,
            user_id: event.user_id,
            reward: event.reward.title,
            user_input: event.user_input ?? ''
        };
    }
}
