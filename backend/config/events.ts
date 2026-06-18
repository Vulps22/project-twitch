import type { EventConfig } from '../src/types.js';

export const EVENTS: Record<string, EventConfig> = {
    lurk: {
        event_name: 'lurk',
        event_type: 'channel_points_redemption',
        trigger_on: ['lurk'],
        reactions: [
            { type: 'chat_reply', message: 'Thank you for lurking, {{username}}!' },
            { type: 'image', url: 'lurk.png', transition_in: 'fade-in', transition_out: 'fade-out', timeout: '6s' },
            { type: 'overlay_text', text: '{{username}}', transition_in: 'fade-in', transition_out: 'fade-out', timeout: '6s' },
            { type: 'sound', filename: 'lurk.mp3' },
        ],
    },
    discord: {
        event_name: 'discord',
        event_type: 'chat_command',
        trigger_on: ['discord'],
        reactions: [
            { type: 'chat_reply', message: '\nJoin our Discord: https://discord.vulps.co.uk' },
        ],
    },
    sus: {
        event_name: 'sus',
        event_type: 'chat_command',
        trigger_on: ['sus'],
        reactions: [
            { type: 'chat_reply', message: '{{username}} is sus!' },
            { type: 'sound', filename: 'lurk.mp3' },
        ],
    },
    dancingfox: {
        event_name: 'dancingfox',
        event_type: 'chat_command',
        trigger_on: ['dancingfox'],
        reactions: [
            { type: 'video', filename: 'follow-dance.mp4' },
        ],
    },
    vindication: {
        event_name: 'vindication',
        event_type: 'chat_command',
        trigger_on: ['vindication'],
        reactions: [
            { type: 'chat_reply', message: 'Vindication sound played for {{username}}!' },
            { type: 'sound', filename: 'vindication.mp3', volume: 1.0 },
        ],
    },
    spam: {
        event_name: 'spam',
        event_type: 'chat_command',
        trigger_on: ['spam'],
        reactions: [
            { type: 'chat_reply', message: '!spam' },
        ],
    },
    follow: {
        event_name: 'follow',
        event_type: 'follow',
        reactions: [
            { type: 'chat_reply', message: 'Thanks {{username}} for the follow!' },
            { type: 'overlay_text', text: '{{username}} is following!', transition_in: 'bounce-in', transition_out: 'bounce-out', timeout: '20s' },
            { type: 'video', filename: 'follow-dance.mp4', transition_in: 'bounce-in', transition_out: 'bounce-out', timeout: '20s' },
            { type: 'sound', filename: 'follow.mp3' },
        ],
    },
    subscription: {
        event_name: 'subscription',
        event_type: 'subscription',
        reactions: [
            { type: 'chat_reply', message: 'Welcome to the community, {{username}}!' },
            { type: 'overlay_text', text: '{{username}} just subscribed!', transition_in: 'scale-in', transition_out: 'scale-out', timeout: '6s' },
        ],
    },
    raid: {
        event_name: 'raid',
        event_type: 'raid',
        reactions: [
            { type: 'chat_reply', message: 'Thanks for the raid, {{username}}!' },
            { type: 'overlay_text', text: '{{username}} is raiding with {{count}} viewers!', transition_in: 'slide-right-in', transition_out: 'slide-right-out', timeout: '8s' },
        ],
    },
};

export default EVENTS;
