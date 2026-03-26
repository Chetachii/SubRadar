import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import Popup from './Popup'

// Keep the background service worker alive while the popup is open.
// An open port prevents Chrome from terminating the SW mid-request.
chrome.runtime.connect({ name: 'popup-keepalive' })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Popup />
  </StrictMode>,
)
