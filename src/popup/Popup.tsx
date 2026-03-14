import { useEffect, useState } from 'react'
import type { DetectionResult } from '../types/subscription'
import TrackPrompt from './TrackPrompt'
import ManualEntryForm from './ManualEntryForm'

type View = 'loading' | 'track_prompt' | 'manual_entry' | 'success'

export default function Popup() {
  const [view, setView] = useState<View>('loading')
  const [detection, setDetection] = useState<DetectionResult | null>(null)

  useEffect(() => {
    chrome.storage.session.get('pendingDetection', (result) => {
      const pending = result['pendingDetection'] as DetectionResult | undefined
      if (pending) {
        setDetection(pending)
        setView('track_prompt')
      } else {
        setView('manual_entry')
      }
    })
  }, [])

  function handleSaved() {
    chrome.storage.session.remove('pendingDetection')
    setView('success')
  }

  function handleDismiss() {
    chrome.storage.session.remove('pendingDetection')
    setView('manual_entry')
  }

  if (view === 'loading') {
    return <div style={styles.container}><p>Loading…</p></div>
  }

  if (view === 'success') {
    return (
      <div style={styles.container}>
        <p style={styles.successText}>Subscription tracked!</p>
        <button style={styles.linkBtn} onClick={() => setView('manual_entry')}>Track another</button>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <h2 style={styles.heading}>SubRadar</h2>
      {view === 'track_prompt' && detection ? (
        <TrackPrompt result={detection} onSaved={handleSaved} onDismiss={handleDismiss} />
      ) : (
        <ManualEntryForm onSaved={handleSaved} />
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: { padding: '16px', minWidth: '360px', fontFamily: 'system-ui, sans-serif' },
  heading: { margin: '0 0 12px', fontSize: '18px', fontWeight: 700 },
  successText: { color: '#16a34a', fontWeight: 600 },
  linkBtn: { background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', padding: 0, fontSize: '14px' },
}
