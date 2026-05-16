import type { EventConfig, TemplateData, TwitchRawEvent } from '../types.js';

export abstract class BaseEventType {
    abstract get type(): string;
    abstract match(rawEvent: TwitchRawEvent, config: EventConfig): boolean;
    abstract extractTemplateData(rawEvent: TwitchRawEvent): TemplateData;
}
