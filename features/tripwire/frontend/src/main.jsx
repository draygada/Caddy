import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

if (!document.querySelector('meta[name="viewport"]')) {
  const viewport = document.createElement('meta')
  viewport.name = 'viewport'
  viewport.content = 'width=device-width, initial-scale=1'
  document.head.append(viewport)
}

if (!document.querySelector('link[rel="icon"]')) {
  const favicon = document.createElement('link')
  favicon.rel = 'icon'
  favicon.href = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 32 32%22%3E%3Crect width=%2232%22 height=%2232%22 fill=%22%230b1116%22/%3E%3Cpath d=%22M7 8h18v5h-6v12h-6V13H7z%22 fill=%22%23d7aa5e%22/%3E%3C/svg%3E'
  document.head.append(favicon)
}

createRoot(document.getElementById('root')).render(<App />)
