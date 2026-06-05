import { describe, it, expect } from 'vitest'
import { buildSmsHref } from '../src/lib/sms'

describe('buildSmsHref', () => {
  it('returns a properly encoded sms: href with body', () => {
    const href = buildSmsHref({
      phone: '555-123-4567',
      template: 'Hey {name}, want to play {when}?',
      vars: { name: 'Bob', when: 'Tuesday 6pm' },
    })
    expect(href).toBe('sms:5551234567?body=Hey%20Bob%2C%20want%20to%20play%20Tuesday%206pm%3F')
  })

  it('handles a +1 prefixed phone', () => {
    expect(buildSmsHref({ phone: '+15551234567', template: 'hi', vars: {} })).toBe(
      'sms:+15551234567?body=hi',
    )
  })

  it('leaves unmatched template vars as-is', () => {
    const href = buildSmsHref({
      phone: '5551234567',
      template: 'Hey {name} on {date}',
      vars: { name: 'Bob' },
    })
    expect(decodeURIComponent(href.split('body=')[1])).toBe('Hey Bob on {date}')
  })

  it('throws when phone is missing or empty', () => {
    expect(() => buildSmsHref({ phone: '', template: 'x', vars: {} })).toThrow()
  })
})
