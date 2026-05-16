import { describe, it, expect } from 'vitest'
import { RaidEventType } from '../../backend/src/event-types/RaidEventType.js'
import type { EventConfig, TwitchRawEvent } from '../../backend/src/types.js'

const handler = new RaidEventType()
const config: EventConfig = { event_name: 'incoming_raid', event_type: 'raid' }

const raidEvent: TwitchRawEvent = {
    subscriptionType: 'channel.raid',
    event: {
        from_broadcaster_user_name: 'raider',
        from_broadcaster_user_id: 'r123',
        viewers: 42
    }
}

describe('RaidEventType', () => {
    it('returns "raid" as type', () => {
        expect(handler.type).toBe('raid')
    })

    it('matches a raid event', () => {
        expect(handler.match(raidEvent, config)).toBe(true)
    })

    it('does not match a wrong subscriptionType', () => {
        expect(handler.match({ ...raidEvent, subscriptionType: 'channel.follow' }, config)).toBe(false)
    })

    it('extracts template data correctly', () => {
        expect(handler.extractTemplateData(raidEvent)).toEqual({
            username: 'raider',
            display_name: 'raider',
            user_id: 'r123',
            count: '42'
        })
    })
})
