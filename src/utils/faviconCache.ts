import { useState, useEffect } from 'react'

const CACHE_PREFIX = 'favicon:'

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export async function getCachedFavicon(domain: string): Promise<string | null> {
  const key = `${CACHE_PREFIX}${domain}`

  try {
    const stored = await chrome.storage.local.get(key)
    if (stored[key]) return stored[key] as string

    const res = await fetch(
      `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`,
    )
    if (!res.ok) return null

    const blob = await res.blob()
    const dataUrl = await blobToDataUrl(blob)
    await chrome.storage.local.set({ [key]: dataUrl })
    return dataUrl
  } catch {
    return null
  }
}

export function useFavicon(domain: string | undefined): string | null {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    if (!domain) { setSrc(null); return }
    let cancelled = false
    getCachedFavicon(domain).then((url) => {
      if (!cancelled) setSrc(url)
    })
    return () => { cancelled = true }
  }, [domain])

  return src
}
