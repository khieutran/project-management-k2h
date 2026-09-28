import { useEffect, useState } from 'react';

import './App.css';
import {
  fetchHealth,
  type HealthResponse,
} from './api/health';

type ViewState =
  | {
      status: 'loading';
    }
  | {
      status: 'healthy';
      health: HealthResponse;
    }
  | {
      status: 'unavailable';
    };

function App() {
  const [viewState, setViewState] = useState<ViewState>({
    status: 'loading',
  });

  useEffect(() => {
    const controller = new AbortController();

    void fetchHealth(controller.signal)
      .then((health) => {
        if (controller.signal.aborted) {
          return;
        }

        setViewState({
          status: 'healthy',
          health,
        });
      })
      .catch(() => {
        if (controller.signal.aborted) {
          return;
        }

        setViewState({
          status: 'unavailable',
        });
      });

    return () => {
      controller.abort();
    };
  }, []);

  return (
    <main className="app-shell">
      <header className="app-header">
        <p className="eyebrow">K2H</p>
        <h1>Project Management</h1>
        <p className="subtitle">
          System status
        </p>
      </header>

      <section
        className="status-card"
        aria-live="polite"
      >
        {viewState.status === 'loading' && (
          <>
            <span
              className="status-indicator status-indicator--loading"
              aria-hidden="true"
            />
            <p>Checking system status...</p>
          </>
        )}

        {viewState.status === 'healthy' && (
          <>
            <span
              className="status-indicator status-indicator--healthy"
              aria-hidden="true"
            />

            <h2>System healthy</h2>

            <dl className="status-list">
              <div>
                <dt>API</dt>
                <dd>API online</dd>
              </div>

              <div>
                <dt>Database</dt>
                <dd>Database up</dd>
              </div>

              <div>
                <dt>Environment</dt>
                <dd>
                  Environment: {viewState.health.environment}
                </dd>
              </div>
            </dl>
          </>
        )}

        {viewState.status === 'unavailable' && (
          <>
            <span
              className="status-indicator status-indicator--unavailable"
              aria-hidden="true"
            />

            <h2>System unavailable</h2>
            <p>
              The application cannot reach its backend services.
            </p>
          </>
        )}
      </section>
    </main>
  );
}

export default App;