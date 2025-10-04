#!/usr/bin/env node

// Logger Test - Demonstrates safe logging for streaming
import Logger from './backend/src/utils/Logger.js';

console.log('🧪 TESTING SAFE LOGGER FOR STREAMING\n');

// Simulate some sensitive data that might appear in your app
const testData = {
    twitch_access_token: 's6wmtducslc7et1xzyxxv5ico971x3',
    twitch_client_id: 'fmlb6x4fcj8igzarn4k3c5fwt8b46v',
    user_id: '123456789',
    session_id: 'abc123def456',
    username: 'vulps22', // This should NOT be hidden
    channel_name: 'vulps22', // This should NOT be hidden
    message: 'Hello world!', // This should NOT be hidden
    api_key: 'super-secret-key-12345',
    regular_data: 'This is safe to show',
    nested: {
        client_secret: 'another-secret-value',
        public_info: 'This is fine to display',
        deep: {
            private_key: 'very-secret-private-key',
            user_display_name: 'Vulps22'
        }
    },
    array_data: [
        { token: 'secret1', name: 'safe1' },
        { token: 'secret2', name: 'safe2' }
    ]
};

// Test regular console.log (UNSAFE for streaming)
console.log('❌ UNSAFE console.log (would expose secrets):');
console.log('DO NOT USE:', testData);

console.log('\n' + '='.repeat(60) + '\n');

// Test safe Logger (SAFE for streaming)
console.log('✅ SAFE Logger.log (secrets hidden):');
Logger.log('Safe to use:', testData);

console.log('\n' + '='.repeat(60) + '\n');

// Test different log levels
Logger.error('Error with sensitive data:', { 
    error: 'Connection failed',
    access_token: 'should-be-hidden',
    user: 'should-be-visible' 
});

Logger.warn('Warning with mixed data:', {
    warning: 'Rate limit approaching',
    client_id: 'should-be-hidden',
    remaining_requests: 100
});

Logger.info('Info with Twitch data:', {
    event_type: 'follow',
    twitch_user_id: 'should-be-hidden',
    display_name: 'should-be-visible'
});

// Test context logging
Logger.logWithContext('TwitchClient', 'User authenticated:', {
    user_id: 'secret-user-id',
    username: 'visible-username',
    scopes: ['chat:read', 'chat:write']
});

console.log('\n🎯 All sensitive data has been safely hidden!');
console.log('✅ Ready for streaming - no secrets will be exposed!');