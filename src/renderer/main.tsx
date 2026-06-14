import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import * as tauriApi from './api/tauri'

if (!window.electronAPI) {
  window.electronAPI = tauriApi as unknown as Window['electronAPI']
}

const root = ReactDOM.createRoot(document.getElementById('root')!)

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
