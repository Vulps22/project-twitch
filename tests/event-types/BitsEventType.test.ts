import { describe, it, expect } from 'vitest'
import { BitsEventType } from '../../backend/src/event-types/BitsEventType.js'
import type { EventConfig, TwitchRawEvent } from '../../backend/src/types.js'

const handler = new BitsEventType()
const config: EventConfig = { event_name: 'cheer', event_type: 'bits' }

const makeEvent = (overrides: Record<string, unknown> = {}): TwitchRawEvent => ({
    subscriptionType: 'channel.cheer',
    event: { is_anonymous: false, user_name: 'carol', user_id: 'u789', bits: 100, ...overrides }
})

describe('BitsEventType', () => {
    it('returns "bits" as type', () => {
        expect(handler.type).toBe('bits')
    })

    it('matches a cheer event', () => {
        expect(handler.match(makeEvent(), config)).toBe(true)
    })

    it('does not match a wrong subscriptionType', () => {
        expect(handler.match({ ...makeEvent(), subscriptionType: 'channel.follow' }, config)).toBe(false)
    })

    it('extracts template data for a named cheerer', () => {
        expect(handler.extractTemplateData(makeEvent())).toEqual({
            username: 'carol',
            display_name: 'carol',
            user_id: 'u789',
            count: '100'
        })
    })

    it('uses "Anonymous" for anonymous cheers', () => {
        const data = handler.extractTemplateData(makeEvent({ is_anonymous: true }))
        expect(data.username).toBe('Anonymous')
        expect(data.display_name).toBe('Anonymous')
    })
})
