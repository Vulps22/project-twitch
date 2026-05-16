import type { EventConfig } from '../src/types.js';

export const EVENTS: Record<string, EventConfig> = {
    lurk: {
        event_name: 'lurk',
        event_type: 'chat_command',
        trigger_on: ['lurk'],
        image: 'lurk.png',
        sound: 'lurk.mp3',
        text: '{{username}}',
        reply: 'Thank you for lurking, {{username}}!',
        transition_in: 'fade-in',
        transition_out: 'fade-out',
        timeout: '6s'
    },
    discord: {
        event_name: 'discord',
        event_type: 'chat_command',
        trigger_on: ['discord'],
        reply: '\nJoin our Discord: https://discord.vulps.co.uk',
    },
    sus: {
        event_name: 'sus',
        event_type: 'chat_command',
        trigger_on: ['sus'],
        sound: 'lurk.mp3',
        reply: '{{username}} is sus!',
    },
    dancingfox: {
        event_name: 'dancingfox',
        event_type: 'chat_command',
        trigger_on: ['dancingfox'],
        video: 'follow-dance.mp4'
    },
    vindication: {
        event_name: 'vindication',
        event_type: 'chat_command',
        trigger_on: ['vindication'],
        sound: 'vindication.mp3',
        volume: 1.0,
        reply: 'Vindication sound played for {{username}}!'
    },
    spam: {
        event_name: 'spam',
        event_type: 'chat_command',
        trigger_on: ['spam'],
        reply: '!spam',
    },
    follow: {
        event_name: 'follow',
        event_type: 'follow',
        text: '{{username}} is following!',
        video: 'follow-dance.mp4',
        sound: 'follow.mp3',
        reply: 'Thanks {{username}} for the follow!',
        transition_in: 'bounce-in',
        transition_out: 'bounce-out',
        timeout: '20s'
    },
    subscription: {
        event_name: 'subscription',
        event_type: 'subscription',
        text: '{{username}} just subscribed!',
        reply: 'Welcome to the community, {{username}}!',
        transition_in: 'scale-in',
        transition_out: 'scale-out',
        timeout: '6s'
    },
    raid: {
        event_name: 'raid',
        event_type: 'raid',
        text: '{{username}} is raiding with {{count}} viewers!',
        reply: 'Thanks for the raid, {{username}}!',
        transition_in: 'slide-right-in',
        transition_out: 'slide-right-out',
        timeout: '8s'
    }
};

export default EVENTS;
