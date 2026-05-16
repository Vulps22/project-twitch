import { describe, it, expect } from 'vitest'

describe('tooling smoke test', () => {
  it('TypeScript and Vitest are working', () => {
    const greet = (name: string): string => `hello ${name}`
    expect(greet('world')).toBe('hello world')
  })
})
