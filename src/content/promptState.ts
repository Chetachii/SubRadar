const MAX_SIZE = 100
const promptedUrls = new Map<string, true>()

/** Returns true if this URL has already triggered a prompt this session */
export function hasBeenPrompted(url: string): boolean {
  return promptedUrls.has(normalizeUrl(url))
}

/** Records that a prompt was shown for this URL */
export function markPrompted(url: string): void {
  if (promptedUrls.size >= MAX_SIZE) {
    const firstKey = promptedUrls.keys().next().value
    if (firstKey !== undefined) promptedUrls.delete(firstKey)
  }
  promptedUrls.set(normalizeUrl(url), true)
}

/** Clears all prompt state (e.g. when navigating away) */
export function clearPromptState(): void {
  promptedUrls.clear()
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url)
    return `${u.hostname}${u.pathname}`
  } catch {
    return url
  }
}
