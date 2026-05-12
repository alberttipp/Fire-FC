import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import './index.css'
import './buildInfo.js'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

// Initialize Sentry error tracking (production only)
const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
if (sentryDsn) {
  // PII scrubbing — this app has minor users; default Sentry capture
  // would ship form values, emails, and tokens in breadcrumbs.
  const SENSITIVE_URL_PATTERNS = [
    /\/auth/i,
    /\/login/i,
    /\/reset-password/i,
    /\/player-access\//i,
  ];
  const SENSITIVE_KEY_RX = /(email|phone|pin|password|token|secret|api[_-]?key|guardian)/i;

  const scrubObject = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;
    for (const k of Object.keys(obj)) {
      if (SENSITIVE_KEY_RX.test(k)) obj[k] = '[redacted]';
      else if (obj[k] && typeof obj[k] === 'object') scrubObject(obj[k]);
    }
    return obj;
  };

  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.VITE_VERCEL_ENV || 'development',
    enabled: !import.meta.env.DEV,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.category === 'ui.input') return null;
      if (breadcrumb.data) scrubObject(breadcrumb.data);
      const url = breadcrumb.data?.url || breadcrumb.data?.to;
      if (url && SENSITIVE_URL_PATTERNS.some((rx) => rx.test(url))) return null;
      return breadcrumb;
    },
    beforeSend(event) {
      const url = event.request?.url || '';
      if (SENSITIVE_URL_PATTERNS.some((rx) => rx.test(url))) return null;
      if (event.user) {
        delete event.user.email;
        delete event.user.username;
        delete event.user.ip_address;
      }
      if (event.request) {
        delete event.request.cookies;
        delete event.request.headers?.cookie;
        delete event.request.headers?.authorization;
        if (event.request.data) scrubObject(event.request.data);
        if (event.request.query_string) scrubObject({ q: event.request.query_string });
      }
      if (event.extra) scrubObject(event.extra);
      if (event.contexts) scrubObject(event.contexts);
      return event;
    },
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
