export interface StatsSnapshot {
    follows: number;
    subs: number;
    bits: number;
    chatMessages: number;
    eventsFired: number;
    raids: number;
}

class SessionStats {
    private follows = 0;
    private subs = 0;
    private bits = 0;
    private chatMessages = 0;
    private eventsFired = 0;
    private raids = 0;

    recordEvent(subscriptionType: string, event: Record<string, unknown>): void {
        switch (subscriptionType) {
            case 'channel.follow':        this.follows++;    break;
            case 'channel.subscribe':     this.subs++;       break;
            case 'channel.cheer':         this.bits += Number(event['bits'] ?? 0); break;
            case 'channel.raid':          this.raids++;      break;
            case 'channel.chat.message':  this.chatMessages++; break;
        }
        this.eventsFired++;
    }

    snapshot(): StatsSnapshot {
        return {
            follows:      this.follows,
            subs:         this.subs,
            bits:         this.bits,
            chatMessages: this.chatMessages,
            eventsFired:  this.eventsFired,
            raids:        this.raids,
        };
    }
}

export default new SessionStats();
