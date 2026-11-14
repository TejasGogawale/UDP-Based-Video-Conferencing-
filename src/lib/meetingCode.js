// Meeting codes are 12 characters (A-Z, 0-9). They are shown as XXXX-XXXX-XXXX;
// the server accepts them with or without dashes/spaces and in any case.

export const normalizeMeetingCode = (value = '') => value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()

export function formatMeetingCode(code = '') {
  const clean = normalizeMeetingCode(code)
  if (clean.length !== 12) return code || ''
  return `${clean.slice(0, 4)}-${clean.slice(4, 8)}-${clean.slice(8, 12)}`
}

/** Accepts a code, a dashed code, or a full meeting link and returns the URL segment to navigate to. */
export function meetingRefFromInput(input = '') {
  const trimmed = input.trim()
  const fromLink = trimmed.match(/\/conference\/([^/?#\s]+)/i)
  const raw = fromLink ? decodeURIComponent(fromLink[1]) : trimmed
  // Database ids are UUIDs; keep them intact. Everything else is a code.
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)) return raw.toLowerCase()
  return normalizeMeetingCode(raw)
}

export const meetingLink = (code) => `${window.location.origin}/conference/${normalizeMeetingCode(code) || code}`
