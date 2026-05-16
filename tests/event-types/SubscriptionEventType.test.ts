import { describe, it, expect } from 'vitest'
import { SubscriptionEventType } from '../../backend/src/event-types/SubscriptionEventType.js'
import type { EventConfig, TwitchRawEvent } from '../../backend/src/types.js'

const handler = new SubscriptionEventType()
const config: EventConfig = { event_name: 'new_sub', event_type: 'subscription' }

const subEvent: TwitchRawEvent = {
    subscriptionType: 'channel.subscribe',
    event: { user_name: 'dave', user_id: 'u999', tier: '1000' }
}

describe('SubscriptionEventType', () => {
    it('returns "subscription" as type', () => {
        expect(handler.type).toBe('subscription')
    })

    it('matches a subscribe event', () => {
        expect(handler.match(subEvent, config)).toBe(true)
    })

    it('does not match a wrong subscriptionType', () => {
        expect(handler.match({ ...subEvent, subscriptionType: 'channel.raid' }, config)).toBe(false)
    })

    it('extracts template data correctly', () => {
        expect(handler.extractTemplateData(subEvent)).toEqual({
            username: 'dave',
            display_name: 'dave',
            user_id: 'u999',
            tier: '1000'
        })
    })
})
