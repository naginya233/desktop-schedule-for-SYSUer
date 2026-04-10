import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './desktop-widget.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// Auto-enable autostart if running inside Tauri
if (window.__TAURI_INTERNALS__) {
  import('@tauri-apps/plugin-autostart').then(({ enable, isEnabled }) => {
    isEnabled().then(enabled => { if (!enabled) enable(); }).catch(()=>{});
  }).catch(()=>{});
}
