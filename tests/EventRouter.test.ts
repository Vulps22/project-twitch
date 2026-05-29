import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EventRouter } from '../backend/src/EventRouter.js'
import { BaseEventType } from '../backend/src/event-types/BaseEventType.js'
import type { EventConfig, TwitchRawEvent, TemplateData } from '../backend/src/types.js'
import eventLog from '../backend/src/EventLog.js'

// Suppress Logger output during tests
vi.mock('../backend/src/utils/Logger.js', () => ({
    default: {
        warn: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
        log: vi.fn(),
    },
}))

// --- Helpers ---

function makeConfig(overrides: Partial<EventConfig> = {}): EventConfig {
    return {
        event_name: 'test_event',
        event_type: 'chat_command',
        ...overrides,
    }
}

function makeRawEvent(overrides: Partial<TwitchRawEvent> = {}): TwitchRawEvent {
    return {
        subscriptionType: 'channel.chat.message',
        event: { message: { text: '!lurk' } },
        ...overrides,
    }
}

/** Creates a mock BaseEventType whose match() returns the given value. */
function makeMockEventType(matches: boolean, templateData: TemplateData = {}): BaseEventType {
    return {
        type: 'mock',
        match: vi.fn().mockReturnValue(matches),
        extractTemplateData: vi.fn().mockReturnValue(templateData),
    } as unknown as BaseEventType
}

// --- Tests ---

describe('EventRouter', () => {
    let router: EventRouter

    beforeEach(() => {
        router = new EventRouter()
        // Do NOT call init() — inject eventTypes directly to bypass dynamic import
        eventLog.reset()
    })

    describe('setConfigs', () => {
        it('accepts an array of configs', () => {
            const configs = [makeConfig({ event_name: 'a' }), makeConfig({ event_name: 'b' })]
            router.setConfigs(configs)
            expect(router.configs).toHaveLength(2)
            expect(router.configs[0].event_name).toBe('a')
        })

        it('accepts a keyed object of configs and converts to array', () => {
            const configs: Record<string, EventConfig> = {
                lurk: makeConfig({ event_name: 'lurk' }),
                hype: makeConfig({ event_name: 'hype' }),
            }
            router.setConfigs(configs)
            expect(router.configs).toHaveLength(2)
            const names = router.configs.map(c => c.event_name)
            expect(names).toContain('lurk')
            expect(names).toContain('hype')
        })

        it('replaces previously loaded configs', () => {
            router.setConfigs([makeConfig({ event_name: 'first' })])
            router.setConfigs([makeConfig({ event_name: 'second' })])
            expect(router.configs).toHaveLength(1)
            expect(router.configs[0].event_name).toBe('second')
        })
    })

    describe('route', () => {
        it('calls executeConfig when an event type matches a config', async () => {
            const config = makeConfig()
            const templateData: TemplateData = { username: 'streamer' }
            const mockType = makeMockEventType(true, templateData)

            router.eventTypes.push(mockType)
            router.setConfigs([config])

            const execSpy = vi.spyOn(router, 'executeConfig').mockResolvedValue(undefined)
            const rawEvent = makeRawEvent()

            await router.route(rawEvent)

            expect(mockType.match).toHaveBeenCalledWith(rawEvent, config)
            expect(mockType.extractTemplateData).toHaveBeenCalledWith(rawEvent)
            expect(execSpy).toHaveBeenCalledWith(config, templateData)
        })

        it('skips executeConfig when no event type matches', async () => {
            const mockType = makeMockEventType(false)
            router.eventTypes.push(mockType)
            router.setConfigs([makeConfig()])

            const execSpy = vi.spyOn(router, 'executeConfig').mockResolvedValue(undefined)

            await router.route(makeRawEvent())

            expect(execSpy).not.toHaveBeenCalled()
        })

        it('calls executeConfig once per matching config', async () => {
            const configs = [
                makeConfig({ event_name: 'lurk' }),
                makeConfig({ event_name: 'hype' }),
            ]
            const mockType = makeMockEventType(true, {})
            router.eventTypes.push(mockType)
            router.setConfigs(configs)

            const execSpy = vi.spyOn(router, 'executeConfig').mockResolvedValue(undefined)

            await router.route(makeRawEvent())

            expect(execSpy).toHaveBeenCalledTimes(2)
        })

        it('handles multiple event types, calling executeConfig for each match', async () => {
            const config = makeConfig()
            const matchingType = makeMockEventType(true, { username: 'alice' })
            const nonMatchingType = makeMockEventType(false)

            router.eventTypes.push(matchingType, nonMatchingType)
            router.setConfigs([config])

            const execSpy = vi.spyOn(router, 'executeConfig').mockResolvedValue(undefined)

            await router.route(makeRawEvent())

            expect(execSpy).toHaveBeenCalledTimes(1)
            expect(execSpy).toHaveBeenCalledWith(config, { username: 'alice' })
        })

        it('does nothing when configs list is empty', async () => {
            const mockType = makeMockEventType(true)
            router.eventTypes.push(mockType)

            const execSpy = vi.spyOn(router, 'executeConfig').mockResolvedValue(undefined)

            await router.route(makeRawEvent())

            expect(execSpy).not.toHaveBeenCalled()
        })

        it('does nothing when eventTypes list is empty', async () => {
            router.setConfigs([makeConfig()])

            const execSpy = vi.spyOn(router, 'executeConfig').mockResolvedValue(undefined)

            await router.route(makeRawEvent())

            expect(execSpy).not.toHaveBeenCalled()
        })
    })

    describe('event log integration', () => {
        it('appends to the event log when a match is found', async () => {
            const config = makeConfig({ event_name: 'lurk', event_type: 'chat_command' })
            router.eventTypes.push(makeMockEventType(true, { username: 'alice' }))
            router.setConfigs([config])
            vi.spyOn(router, 'executeConfig').mockResolvedValue(undefined)

            await router.route(makeRawEvent({ subscriptionType: 'channel.follow', event: {} }))

            expect(eventLog.getAll()).toHaveLength(1)
            expect(eventLog.getAll()[0].username).toBe('alice')
            expect(eventLog.getAll()[0].eventName).toBe('lurk')
        })

        it('does not append to the event log when no match', async () => {
            router.eventTypes.push(makeMockEventType(false))
            router.setConfigs([makeConfig()])
            vi.spyOn(router, 'executeConfig').mockResolvedValue(undefined)

            await router.route(makeRawEvent())

            expect(eventLog.getAll()).toHaveLength(0)
        })

        it('does not append to the event log when replay=true', async () => {
            router.eventTypes.push(makeMockEventType(true, { username: 'alice' }))
            router.setConfigs([makeConfig()])
            vi.spyOn(router, 'executeConfig').mockResolvedValue(undefined)

            await router.route(makeRawEvent(), true)

            expect(eventLog.getAll()).toHaveLength(0)
        })

        it('appends one entry per matched config', async () => {
            const configs = [makeConfig({ event_name: 'a' }), makeConfig({ event_name: 'b' })]
            router.eventTypes.push(makeMockEventType(true, { username: 'bob' }))
            router.setConfigs(configs)
            vi.spyOn(router, 'executeConfig').mockResolvedValue(undefined)

            await router.route(makeRawEvent())

            expect(eventLog.getAll()).toHaveLength(2)
        })
    })

    describe('extractDetail', () => {
        async function routeAndGetDetail(subscriptionType: string, event: Record<string, unknown>) {
            router.eventTypes.push(makeMockEventType(true, { username: 'x' }))
            router.setConfigs([makeConfig()])
            vi.spyOn(router, 'executeConfig').mockResolvedValue(undefined)
            await router.route({ subscriptionType, event })
            return eventLog.getAll()[0]?.detail
        }

        beforeEach(() => {
            router = new EventRouter()
            eventLog.reset()
        })

        it('describes a follow', async () => {
            expect(await routeAndGetDetail('channel.follow', {})).toBe('Followed the channel')
        })

        it('describes a Tier 1 sub', async () => {
            expect(await routeAndGetDetail('channel.subscribe', { tier: '1000' })).toBe('Subscribed (Tier 1)')
        })

        it('describes a Tier 2 sub', async () => {
            expect(await routeAndGetDetail('channel.subscribe', { tier: '2000' })).toBe('Subscribed (Tier 2)')
        })

        it('describes a Tier 3 sub', async () => {
            expect(await routeAndGetDetail('channel.subscribe', { tier: '3000' })).toBe('Subscribed (Tier 3)')
        })

        it('describes a cheer with bit count', async () => {
            expect(await routeAndGetDetail('channel.cheer', { bits: 500 })).toBe('Cheered 500 bits')
        })

        it('describes a raid with viewer count', async () => {
            expect(await routeAndGetDetail('channel.raid', { viewers: 120 })).toBe('Raided with 120 viewers')
        })

        it('describes a chat message with its text', async () => {
            expect(await routeAndGetDetail('channel.chat.message', { message: { text: '!lurk' } })).toBe('!lurk')
        })

        it('describes a channel points redemption with reward title', async () => {
            const event = { reward: { title: 'Hydrate!' } }
            expect(await routeAndGetDetail('channel.channel_points_custom_reward_redemption.add', event))
                .toBe('Redeemed: Hydrate!')
        })

        it('falls back to subscriptionType for unknown events', async () => {
            expect(await routeAndGetDetail('channel.unknown.event', {})).toBe('channel.unknown.event')
        })
    })
})
