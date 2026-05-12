import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { bootTheme } from './utils/theme'
import App from './App.jsx'

bootTheme()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
