import { describe, it, expect } from 'vitest'
import { ChatCommandEventType } from '../../backend/src/event-types/ChatCommandEventType.js'
import type { EventConfig, TwitchRawEvent } from '../../backend/src/types.js'

const handler = new ChatCommandEventType()

const makeEvent = (text: string): TwitchRawEvent => ({
    subscriptionType: 'channel.chat.message',
    event: {
        message: { text },
        chatter_user_name: 'alice',
        chatter_user_display_name: 'Alice',
        chatter_user_id: 'u123'
    }
})

const config: EventConfig = { event_name: 'lurk', event_type: 'chat_command', trigger_on: ['lurk'] }

describe('ChatCommandEventType', () => {
    it('returns "chat_command" as type', () => {
        expect(handler.type).toBe('chat_command')
    })

    it('matches a valid command', () => {
        expect(handler.match(makeEvent('!lurk'), config)).toBe(true)
    })

    it('matches a command with trailing text', () => {
        expect(handler.match(makeEvent('!lurk some text'), config)).toBe(true)
    })

    it('is case-insensitive for the command', () => {
        expect(handler.match(makeEvent('!LURK'), config)).toBe(true)
    })

    it('does not match a different command', () => {
        expect(handler.match(makeEvent('!hello'), config)).toBe(false)
    })

    it('does not match a plain message (no !)', () => {
        expect(handler.match(makeEvent('lurk'), config)).toBe(false)
    })

    it('does not match a wrong subscriptionType', () => {
        const event = { ...makeEvent('!lurk'), subscriptionType: 'channel.follow' }
        expect(handler.match(event, config)).toBe(false)
    })

    it('does not match a wrong event_type in config', () => {
        const cfg: EventConfig = { ...config, event_type: 'follow' }
        expect(handler.match(makeEvent('!lurk'), cfg)).toBe(false)
    })

    it('extracts template data correctly', () => {
        const data = handler.extractTemplateData(makeEvent('!lurk'))
        expect(data).toEqual({ username: 'alice', display_name: 'Alice', user_id: 'u123' })
    })
})
