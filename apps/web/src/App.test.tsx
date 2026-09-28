import {
  render,
  screen,
} from '@testing-library/react';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import App from './App';
import {
  fetchHealth,
  type HealthResponse,
} from './api/health';

vi.mock('./api/health', () => ({
  fetchHealth: vi.fn(),
}));

const fetchHealthMock = vi.mocked(fetchHealth);

describe('App', () => {
  beforeEach(() => {
    fetchHealthMock.mockReset();
  });

  it('shows a loading state while checking health', () => {
    fetchHealthMock.mockImplementation(
      () => new Promise<HealthResponse>(() => {}),
    );

    render(<App />);

    expect(
      screen.getByText('Checking system status...'),
    ).toBeInTheDocument();
  });

  it('shows API, database and environment when healthy', async () => {
    fetchHealthMock.mockResolvedValue({
      status: 'ok',
      database: 'up',
      environment: 'development',
    });

    render(<App />);

    expect(
      await screen.findByText('API online'),
    ).toBeInTheDocument();

    expect(
      screen.getByText('Database up'),
    ).toBeInTheDocument();

    expect(
      screen.getByText('Environment: development'),
    ).toBeInTheDocument();
  });

  it.each([
    ['a network error', new TypeError('Failed to fetch')],
    ['a non-success response', new Error('Health request failed with status 503')],
    ['a malformed response', new Error('Invalid health response')],
  ])(
    'shows unavailable for %s',
    async (_description, error) => {
      fetchHealthMock.mockRejectedValue(error);

      render(<App />);

      expect(
        await screen.findByText('System unavailable'),
      ).toBeInTheDocument();
    },
  );

  it('aborts the health request when unmounted', () => {
    let receivedSignal: AbortSignal | undefined;

    fetchHealthMock.mockImplementation((signal) => {
      receivedSignal = signal;

      return new Promise<HealthResponse>(() => {});
    });

    const { unmount } = render(<App />);

    expect(fetchHealthMock).toHaveBeenCalledTimes(1);
    expect(receivedSignal?.aborted).toBe(false);

    unmount();

    expect(receivedSignal?.aborted).toBe(true);
  });
});
