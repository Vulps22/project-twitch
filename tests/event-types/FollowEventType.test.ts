import { describe, it, expect } from 'vitest'
import { FollowEventType } from '../../backend/src/event-types/FollowEventType.js'
import type { EventConfig, TwitchRawEvent } from '../../backend/src/types.js'

const handler = new FollowEventType()

const followEvent: TwitchRawEvent = {
    subscriptionType: 'channel.follow',
    event: {
        user_name: 'bob',
        user_display_name: 'Bob',
        user_id: 'u456',
        followed_at: '2024-01-01T00:00:00Z'
    }
}

const config: EventConfig = { event_name: 'new_follow', event_type: 'follow' }

describe('FollowEventType', () => {
    it('returns "follow" as type', () => {
        expect(handler.type).toBe('follow')
    })

    it('matches a follow event with correct config', () => {
        expect(handler.match(followEvent, config)).toBe(true)
    })

    it('does not match a wrong subscriptionType', () => {
        expect(handler.match({ ...followEvent, subscriptionType: 'channel.cheer' }, config)).toBe(false)
    })

    it('does not match a wrong event_type in config', () => {
        expect(handler.match(followEvent, { ...config, event_type: 'bits' })).toBe(false)
    })

    it('extracts template data correctly', () => {
        expect(handler.extractTemplateData(followEvent)).toEqual({
            username: 'bob',
            display_name: 'Bob',
            user_id: 'u456',
            followed_at: '2024-01-01T00:00:00Z'
        })
    })
})
