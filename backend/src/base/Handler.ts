import Logger from '../utils/Logger.js';
import type { EventConfig, ITwitchClient, IOverlayBroadcaster, OverlayEvent, TemplateData } from '../types.js';

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
        if (config.reply && this.twitchClient) {
            await this.twitchClient.sendChatMessage(this.processTemplate(config.reply, templateData));
        }

        if (config.image || config.sound || config.text || config.video) {
            const overlayEvent: OverlayEvent = {
                type: 'event',
                event_name: config.event_name,
                image: config.image,
                sound: config.sound,
                volume: config.volume,
                video: config.video,
                text: this.processTemplate(config.text, templateData),
                transition_in: config.transition_in,
                transition_out: config.transition_out,
                timeout: config.timeout
            };

            if (this.overlayBroadcasterService) {
                await this.overlayBroadcasterService.broadcast(overlayEvent);
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
