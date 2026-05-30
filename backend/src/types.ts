export interface ChatReplyReaction {
    type: 'chat_reply'
    message: string
}

export interface OverlayTextReaction {
    type: 'overlay_text'
    text: string
    transition_in?: string
    transition_out?: string
    timeout?: string
}

export interface ImageReaction {
    type: 'image'
    url: string
    offsetX?: number
    offsetY?: number
    offsetZ?: number
    transition_in?: string
    transition_out?: string
    timeout?: string
}

export interface SoundReaction {
    type: 'sound'
    filename: string
    volume?: number
}

export interface VideoReaction {
    type: 'video'
    filename: string
    offsetX?: number
    offsetY?: number
    offsetZ?: number
    transition_in?: string
    transition_out?: string
    timeout?: string
}

export type OverlayReaction = OverlayTextReaction | ImageReaction | SoundReaction | VideoReaction
export type Reaction = ChatReplyReaction | OverlayReaction

export interface EventConfig {
    event_name: string
    event_type: string
    trigger_on?: string[]
    reactions: Reaction[]
}

export type TemplateData = Record<string, string>

export interface TwitchRawEvent {
    subscriptionType: string
    event: Record<string, unknown>
}

export interface OverlayEvent {
    type: 'event'
    event_name: string
    reactions: OverlayReaction[]
}

export interface DashboardChatEvent {
    type: 'chat'
    userId: string
    username: string
    message: string
}

export interface IDashboardBroadcaster {
    broadcast(event: DashboardChatEvent): void
    getClientCount(): number
}

export interface ViewerData {
    userId: string
    username: string
    watchTime: number
    messageCount: number
    bits: number
    subs: number
    pointsRedeemed: number
}

export interface ITwitchClient {
    sendChatMessage(message: string): Promise<boolean>
    getChatters(): Promise<{ userId: string; username: string }[]>
}

export interface IOverlayBroadcaster {
    broadcast(event: OverlayEvent): Promise<boolean>
}

export interface IEventRouter {
    route(rawEvent: TwitchRawEvent, replay?: boolean): Promise<void>
}
