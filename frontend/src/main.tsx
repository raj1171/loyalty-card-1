// ============================================================================
// File: frontend/src/main.tsx
// Description: Customer frontend application entry point with context providers
// ============================================================================

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.js';
import { RestaurantProvider } from './context/RestaurantContext.js';
import { AuthProvider } from './context/AuthContext.js';
import './index.css';

// Parse restaurant slug from query parameter '?r=slug' or path '/r/slug', default to 'artisan-coffee'
function getInitialRestaurantSlug(): string {
  const urlParams = new URLSearchParams(window.location.search);
  const querySlug = urlParams.get('r');
  if (querySlug) return querySlug;

  const pathParts = window.location.pathname.split('/').filter(Boolean);
  if (pathParts.length >= 2 && pathParts[0] === 'r') {
    return pathParts[1];
  }

  return 'sa-dosa-cafe';
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found in DOM');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <RestaurantProvider initialSlug={getInitialRestaurantSlug()}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </RestaurantProvider>
  </React.StrictMode>
);
