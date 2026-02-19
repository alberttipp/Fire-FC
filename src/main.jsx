import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import './index.css'
import './buildInfo.js'
import App from './App.jsx'

// Initialize Sentry error tracking (production only)
const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.VITE_VERCEL_ENV || 'development',
    enabled: !import.meta.env.DEV,
    tracesSampleRate: 0.1,
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
