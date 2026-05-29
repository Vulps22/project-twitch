import { describe, it, expect } from 'vitest'
import { EVENTS } from '../../backend/config/events.js'

const TRIGGER_REQUIRED_TYPES = new Set(['chat_command', 'chat_contains', 'channel_points_redemption'])
const VALID_TYPES = new Set(['chat_command', 'chat_contains', 'follow', 'subscription', 'raid', 'bits', 'channel_points_redemption'])
const VALID_REACTION_TYPES = new Set(['chat_reply', 'overlay_text', 'image', 'sound', 'video'])

describe('EVENTS config', () => {
    it('exports a non-empty object', () => {
        expect(Object.keys(EVENTS).length).toBeGreaterThan(0)
    })

    it('every entry has a matching event_name and key', () => {
        for (const [key, config] of Object.entries(EVENTS)) {
            expect(config.event_name).toBe(key)
        }
    })

    it('every entry has a valid event_type', () => {
        for (const [key, config] of Object.entries(EVENTS)) {
            expect(VALID_TYPES.has(config.event_type), `${key} has unknown event_type: ${config.event_type}`).toBe(true)
        }
    })

    it('entries that require trigger_on have it defined and non-empty', () => {
        for (const [key, config] of Object.entries(EVENTS)) {
            if (TRIGGER_REQUIRED_TYPES.has(config.event_type)) {
                expect(config.trigger_on, `${key} (${config.event_type}) is missing trigger_on`).toBeDefined()
                expect(config.trigger_on!.length, `${key} has empty trigger_on`).toBeGreaterThan(0)
            }
        }
    })

    it('entries without trigger requirement do not need trigger_on', () => {
        const noTriggerEntries = Object.entries(EVENTS).filter(
            ([, c]) => !TRIGGER_REQUIRED_TYPES.has(c.event_type)
        )
        expect(noTriggerEntries.length).toBeGreaterThan(0)
    })

    it('every entry has a reactions array', () => {
        for (const [key, config] of Object.entries(EVENTS)) {
            expect(Array.isArray(config.reactions), `${key} missing reactions array`).toBe(true)
        }
    })

    it('every reaction has a valid type', () => {
        for (const [key, config] of Object.entries(EVENTS)) {
            for (const reaction of config.reactions) {
                expect(VALID_REACTION_TYPES.has(reaction.type), `${key} has unknown reaction type: ${reaction.type}`).toBe(true)
            }
        }
    })

    it('timeout values are valid duration strings when present', () => {
        for (const [key, config] of Object.entries(EVENTS)) {
            for (const reaction of config.reactions) {
                if ('timeout' in reaction && reaction.timeout !== undefined) {
                    expect(reaction.timeout, `${key} reaction has invalid timeout format`).toMatch(/^\d+s$/)
                }
            }
        }
    })
})
