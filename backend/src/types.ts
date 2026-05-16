export interface EventConfig {
    event_name: string
    event_type: string
    trigger_on?: string[]
    reply?: string
    image?: string
    sound?: string
    volume?: number
    video?: string
    text?: string
    transition_in?: string
    transition_out?: string
    timeout?: string
}

export type TemplateData = Record<string, string>

export interface TwitchRawEvent {
    subscriptionType: string
    event: Record<string, unknown>
}

export interface OverlayEvent {
    type: 'event'
    event_name: string
    image?: string
    sound?: string
    volume?: number
    video?: string
    text?: string
    transition_in?: string
    transition_out?: string
    timeout?: string
}

export interface ITwitchClient {
    sendChatMessage(message: string): Promise<void>
}

export interface IOverlayBroadcaster {
    broadcast(event: OverlayEvent): Promise<void>
}

export interface IEventRouter {
    route(rawEvent: TwitchRawEvent): Promise<void>
}
