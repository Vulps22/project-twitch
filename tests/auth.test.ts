import { describe, it, expect } from 'vitest'
import { buildAuthUrl } from '../auth.js'

describe('buildAuthUrl', () => {
    const url = new URL(buildAuthUrl('test_client_id'))

    it('points to the Twitch authorization endpoint', () => {
        expect(url.origin + url.pathname).toBe('https://id.twitch.tv/oauth2/authorize')
    })

    it('sets the client_id', () => {
        expect(url.searchParams.get('client_id')).toBe('test_client_id')
    })

    it('uses implicit token flow', () => {
        expect(url.searchParams.get('response_type')).toBe('token')
    })

    it('includes all required scopes', () => {
        const scopes = url.searchParams.get('scope')!.split(' ')
        expect(scopes).toContain('user:read:chat')
        expect(scopes).toContain('user:write:chat')
        expect(scopes).toContain('channel:read:subscriptions')
        expect(scopes).toContain('moderator:read:followers')
        expect(scopes).toContain('moderator:read:chatters')
        expect(scopes).toContain('channel:read:redemptions')
        expect(scopes).toContain('bits:read')
    })

    it('redirects to http://localhost', () => {
        expect(url.searchParams.get('redirect_uri')).toBe('http://localhost')
    })
})
