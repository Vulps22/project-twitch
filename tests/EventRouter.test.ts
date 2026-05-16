import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EventRouter } from '../backend/src/EventRouter.js'
import { BaseEventType } from '../backend/src/event-types/BaseEventType.js'
import type { EventConfig, TwitchRawEvent, TemplateData } from '../backend/src/types.js'

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
})
