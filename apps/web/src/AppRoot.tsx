import { BrowserRouter } from 'react-router-dom';

import App from './App';
import { AuthProvider } from './auth/AuthProvider';
import { AuthenticatedQueryBoundary } from './query/AuthenticatedQueryBoundary';

export function AppRoot() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AuthenticatedQueryBoundary>
          <App />
        </AuthenticatedQueryBoundary>
      </AuthProvider>
    </BrowserRouter>
  );
}
