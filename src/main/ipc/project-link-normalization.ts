// Pure validation/normalization for project links, extracted from the IPC
// handler so the security-critical URL rules can be unit-tested without
// importing repos.ts (which registers IPC handlers as a side effect).

const PROJECT_LINK_NAME_MAX_LENGTH = 80
const PROJECT_LINK_CATEGORY_MAX_LENGTH = 40
const PROJECT_LINK_URL_MAX_LENGTH = 2048

export function normalizeProjectLinkName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) {
    throw new Error('Link name is required.')
  }
  if (trimmed.length > PROJECT_LINK_NAME_MAX_LENGTH) {
    throw new Error('Link name is too long.')
  }
  return trimmed
}

export function normalizeProjectLinkCategory(category: string): string {
  // Why: blank category is allowed (grouped under "Uncategorized" in the UI).
  const trimmed = category.trim()
  if (trimmed.length > PROJECT_LINK_CATEGORY_MAX_LENGTH) {
    throw new Error('Link category is too long.')
  }
  return trimmed
}

export function normalizeProjectLinkUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim()
  if (!trimmed) {
    throw new Error('Link URL is required.')
  }
  // Why: bare hosts like "example.com" are the common case; default to https so
  // the stored URL is openable rather than being rejected as protocol-less.
  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  let parsed: URL
  try {
    parsed = new URL(withProtocol)
  } catch {
    throw new Error('Link URL is invalid.')
  }
  // Why: shell:openUrl only opens http(s); reject other schemes at save time so
  // we never persist a link that can't be opened (blocks file:/javascript:/data:).
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http and https links are allowed.')
  }
  if (parsed.href.length > PROJECT_LINK_URL_MAX_LENGTH) {
    throw new Error('Link URL is too long.')
  }
  return parsed.href
}
