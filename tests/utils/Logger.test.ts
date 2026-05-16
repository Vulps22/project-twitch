import { describe, it, expect, beforeEach } from 'vitest'
import { Logger } from '../../backend/src/utils/Logger.js'

describe('Logger.sanitizeValue', () => {
    it('returns null/undefined values unchanged', () => {
        expect(Logger.sanitizeValue('anything', null)).toBeNull()
        expect(Logger.sanitizeValue('anything', undefined)).toBeUndefined()
    })

    it('masks short sensitive strings', () => {
        expect(Logger.sanitizeValue('token', 'abc')).toBe('XXX')
    })

    it('masks medium sensitive strings', () => {
        expect(Logger.sanitizeValue('secret', 'abcdefgh')).toBe('XXXXXXX')
    })

    it('masks long sensitive strings, preserving first 2 and last 2 chars', () => {
        // 'abcdefghijkl' is 12 chars — above the <= 10 boundary
        const result = Logger.sanitizeValue('password', 'abcdefghijkl') as string
        expect(result.startsWith('ab')).toBe(true)
        expect(result.endsWith('kl')).toBe(true)
        expect(result).toContain('XXXXXXXX')
    })

    it('masks non-string sensitive values as XXXXXXX', () => {
        expect(Logger.sanitizeValue('token', 12345)).toBe('XXXXXXX')
    })

    it('returns non-sensitive values unchanged', () => {
        expect(Logger.sanitizeValue('username', 'StreamerName')).toBe('StreamerName')
        expect(Logger.sanitizeValue('count', 42)).toBe(42)
    })
})

describe('Logger.sanitizeObject', () => {
    it('returns null unchanged', () => {
        expect(Logger.sanitizeObject(null)).toBeNull()
    })

    it('sanitizes sensitive keys in a flat object', () => {
        const result = Logger.sanitizeObject({ token: 'supersecret', name: 'Alice' }) as Record<string, unknown>
        expect(result.token).not.toBe('supersecret')
        expect(result.name).toBe('Alice')
    })

    it('sanitizes nested objects recursively', () => {
        const result = Logger.sanitizeObject({ user: { token: 'abc', name: 'Bob' } }) as Record<string, unknown>
        const user = result.user as Record<string, unknown>
        expect(user.token).toBe('XXX')
        expect(user.name).toBe('Bob')
    })

    it('handles arrays, recursing into object elements', () => {
        const result = Logger.sanitizeObject([{ token: 'abc' }, { name: 'Alice' }]) as Record<string, unknown>[]
        expect(result[0].token).toBe('XXX')
        expect(result[1].name).toBe('Alice')
    })

    it('stops at maxDepth and returns a placeholder', () => {
        const result = Logger.sanitizeObject({ a: 1 }, 0)
        expect(result).toBe('[Max Depth Reached]')
    })

    it('returns primitives unchanged', () => {
        expect(Logger.sanitizeObject('hello')).toBe('hello')
        expect(Logger.sanitizeObject(42)).toBe(42)
    })
})

describe('Logger.addSensitivePattern', () => {
    beforeEach(() => {
        // Reset patterns to a known baseline between tests
        Logger.SENSITIVE_PATTERNS = []
    })

    it('accepts a RegExp', () => {
        Logger.addSensitivePattern(/mypattern/i)
        const result = Logger.sanitizeValue('mypattern', 'value')
        expect(result).not.toBe('value')
    })

    it('accepts a string and converts it to a case-insensitive RegExp', () => {
        Logger.addSensitivePattern('customfield')
        const result = Logger.sanitizeValue('customfield', 'value')
        expect(result).not.toBe('value')
    })
})

describe('Logger.addSensitiveValue', () => {
    beforeEach(() => {
        Logger.SENSITIVE_VALUES = []
    })

    it('masks any value that contains the registered sensitive value', () => {
        Logger.addSensitiveValue('MY_SECRET_TOKEN')
        const result = Logger.sanitizeValue('output', 'prefix_MY_SECRET_TOKEN_suffix')
        expect(result).not.toBe('prefix_MY_SECRET_TOKEN_suffix')
    })

    it('does not add duplicates', () => {
        Logger.addSensitiveValue('token123')
        Logger.addSensitiveValue('token123')
        expect(Logger.SENSITIVE_VALUES.filter(v => v === 'token123')).toHaveLength(1)
    })
})
