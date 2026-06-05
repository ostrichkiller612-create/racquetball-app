export type SmsInput = {
  phone: string
  template: string
  vars: Record<string, string>
}

/**
 * Builds an sms: URL with phone + URL-encoded body, interpolating {key}
 * placeholders from `vars` into `template`. Unmatched placeholders are
 * left literal. Tap on Android/iOS opens the messaging app pre-filled.
 */
export function buildSmsHref({ phone, template, vars }: SmsInput): string {
  if (!phone || !phone.trim()) {
    throw new Error('Phone is required')
  }
  const cleaned = phone.startsWith('+')
    ? '+' + phone.slice(1).replace(/\D/g, '')
    : phone.replace(/\D/g, '')

  let body = template
  for (const [k, v] of Object.entries(vars)) {
    body = body.split(`{${k}}`).join(v)
  }
  return `sms:${cleaned}?body=${encodeURIComponent(body)}`
}
