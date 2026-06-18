import Logger from '../utils/Logger.js';
import type { EventConfig, ITwitchClient, IOverlayBroadcaster, OverlayEvent, OverlayReaction, TemplateData } from '../types.js';

export class Handler {
    protected twitchClient: ITwitchClient | null;
    protected overlayBroadcasterService: IOverlayBroadcaster | null;

    constructor(
        twitchClient: ITwitchClient | null = null,
        overlayBroadcasterService: IOverlayBroadcaster | null = null
    ) {
        this.twitchClient = twitchClient;
        this.overlayBroadcasterService = overlayBroadcasterService;
    }

    async executeConfig(config: EventConfig, templateData: TemplateData): Promise<void> {
        Logger.info(`Handler: Executing "${config.event_name}"`);

        const overlayReactions: OverlayReaction[] = [];

        for (const reaction of config.reactions) {
            if (reaction.type === 'chat_reply') {
                if (this.twitchClient) {
                    const message = this.processTemplate(reaction.message, templateData);
                    Logger.info(`Handler: Sending chat reply: "${message}"`);
                    const ok = await this.twitchClient.sendChatMessage(message);
                    Logger.info(`Handler: Chat reply ${ok ? 'sent' : 'FAILED'}`);
                } else {
                    Logger.warn('Handler: Skipping reply — twitchClient not set');
                }
            } else if (reaction.type === 'overlay_text') {
                overlayReactions.push({
                    ...reaction,
                    text: this.processTemplate(reaction.text, templateData),
                });
            } else {
                overlayReactions.push(reaction);
            }
        }

        if (overlayReactions.length > 0) {
            if (this.overlayBroadcasterService) {
                const overlayEvent: OverlayEvent = {
                    type: 'event',
                    event_name: config.event_name,
                    reactions: overlayReactions,
                };
                Logger.info(`Handler: Broadcasting overlay event for "${config.event_name}"`);
                await this.overlayBroadcasterService.broadcast(overlayEvent);
            } else {
                Logger.warn('Handler: Skipping overlay broadcast — overlayBroadcasterService not set');
            }
        }
    }

    processTemplate(template: string | undefined, data: TemplateData): string {
        if (!template) return '';
        return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => data[key] ?? '');
    }

    setTwitchClient(twitchClient: ITwitchClient): void {
        this.twitchClient = twitchClient;
    }

    setOverlayBroadcasterService(overlayBroadcasterService: IOverlayBroadcaster): void {
        this.overlayBroadcasterService = overlayBroadcasterService;
    }
}

export default Handler;
