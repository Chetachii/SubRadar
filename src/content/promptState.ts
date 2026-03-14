const promptedUrls = new Map<string, number>()

/** Returns true if this URL has already triggered a prompt this session */
export function hasBeenPrompted(url: string): boolean {
  return promptedUrls.has(normalizeUrl(url))
}

/** Records that a prompt was shown for this URL */
export function markPrompted(url: string): void {
  promptedUrls.set(normalizeUrl(url), Date.now())
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
