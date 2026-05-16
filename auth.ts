#!/usr/bin/env node
import 'dotenv/config';

const CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const REDIRECT_URI = 'http://localhost';
const SCOPES = [
    'user:read:chat',
    'user:write:chat',
    'channel:read:subscriptions',
    'moderator:read:followers',
    'moderator:read:chatters',
    'channel:read:redemptions',
    'bits:read',
];

if (!CLIENT_ID) {
    console.error('TWITCH_CLIENT_ID is not set in .env — cannot build authorization URL.');
    process.exit(1);
}

export function buildAuthUrl(clientId: string): string {
    const url = new URL('https://id.twitch.tv/oauth2/authorize');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', REDIRECT_URI);
    url.searchParams.set('response_type', 'token');
    url.searchParams.set('scope', SCOPES.join(' '));
    return url.toString();
}

const authUrl = buildAuthUrl(CLIENT_ID);

console.log('\n1. Click this link to authorize with Twitch:\n');
console.log('   ' + authUrl);
console.log('\n2. After authorizing, copy the access_token value from the redirect URL.');
console.log('3. Paste it into your .env as TWITCH_ACCESS_TOKEN.\n');
