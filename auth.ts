#!/usr/bin/env node
import 'dotenv/config';

const CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const REDIRECT_URI = 'http://localhost';

const SCOPES = {
    bot: [
        'user:read:chat',
        'user:write:chat',
        'moderator:read:followers',
        'moderator:read:chatters',
    ],
    streamer: [
        'channel:read:subscriptions',
        'channel:read:redemptions',
        'bits:read',
    ],
};

const mode = process.argv[2] as 'bot' | 'streamer' | undefined;

if (!CLIENT_ID) {
    console.error('TWITCH_CLIENT_ID is not set in .env — cannot build authorization URL.');
    process.exit(1);
}

if (!mode || !(mode in SCOPES)) {
    console.error('Usage: npm run auth:bot  OR  npm run auth:streamer');
    process.exit(1);
}

const url = new URL('https://id.twitch.tv/oauth2/authorize');
url.searchParams.set('client_id', CLIENT_ID);
url.searchParams.set('redirect_uri', REDIRECT_URI);
url.searchParams.set('response_type', 'token');
url.searchParams.set('scope', SCOPES[mode].join(' '));

const envVar = mode === 'bot' ? 'TWITCH_ACCESS_TOKEN' : 'TWITCH_BROADCASTER_TOKEN';

console.log(`\n1. Log into Twitch as your ${mode} account, then open this link:\n`);
console.log('   ' + url.toString());
console.log(`\n2. After authorizing, copy the access_token from the redirect URL.`);
console.log(`3. Paste it into your .env as ${envVar}.\n`);
