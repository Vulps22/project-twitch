import { describe, it, expect } from 'vitest'
import { ChannelPointsRedemptionEventType } from '../../backend/src/event-types/ChannelPointsRedemptionEventType.js'
import type { EventConfig, TwitchRawEvent } from '../../backend/src/types.js'

const handler = new ChannelPointsRedemptionEventType()
const SUBSCRIPTION_TYPE = 'channel.channel_points_custom_reward_redemption.add'

const config: EventConfig = {
    event_name: 'hydrate',
    event_type: 'channel_points_redemption',
    trigger_on: ['Hydrate!']
}

const makeEvent = (rewardTitle: string, userInput = ''): TwitchRawEvent => ({
    subscriptionType: SUBSCRIPTION_TYPE,
    event: {
        user_name: 'eve',
        user_id: 'u001',
        reward: { title: rewardTitle },
        user_input: userInput
    }
})

describe('ChannelPointsRedemptionEventType', () => {
    it('returns "channel_points_redemption" as type', () => {
        expect(handler.type).toBe('channel_points_redemption')
    })

    it('matches when reward title is in trigger_on', () => {
        expect(handler.match(makeEvent('Hydrate!'), config)).toBe(true)
    })

    it('does not match when reward title is not in trigger_on', () => {
        expect(handler.match(makeEvent('Other Reward'), config)).toBe(false)
    })

    it('does not match a wrong subscriptionType', () => {
        const event = { ...makeEvent('Hydrate!'), subscriptionType: 'channel.follow' }
        expect(handler.match(event, config)).toBe(false)
    })

    it('does not match a wrong event_type in config', () => {
        expect(handler.match(makeEvent('Hydrate!'), { ...config, event_type: 'follow' })).toBe(false)
    })

    it('extracts template data including user_input', () => {
        expect(handler.extractTemplateData(makeEvent('Hydrate!', 'drink water'))).toEqual({
            username: 'eve',
            display_name: 'eve',
            user_id: 'u001',
            reward: 'Hydrate!',
            user_input: 'drink water'
        })
    })

    it('defaults user_input to empty string when absent', () => {
        const event: TwitchRawEvent = {
            subscriptionType: SUBSCRIPTION_TYPE,
            event: { user_name: 'eve', user_id: 'u001', reward: { title: 'Hydrate!' } }
        }
        expect(handler.extractTemplateData(event).user_input).toBe('')
    })
})
