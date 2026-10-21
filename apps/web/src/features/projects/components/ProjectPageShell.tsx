import { useState, type PropsWithChildren } from 'react';
import { Link, NavLink } from 'react-router-dom';

import { useAuth } from '../../../auth/use-auth';

import '../cargo-theme.css';

export function ProjectPageShell({ children }: PropsWithChildren) {
  const { state, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  if (state.status !== 'authenticated') return null;

  async function handleLogout(): Promise<void> {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await logout();
    } catch {
      // The auth provider clears the local session even when the request fails.
    } finally {
      setIsLoggingOut(false);
    }
  }

  const initials = state.user.displayName.trim().slice(0, 1).toUpperCase();

  return (
    <div className="workspace-shell cargo-workspace">
      <header className="workspace-header">
        <div className="workspace-header-inner">
          <Link className="workspace-brand" to="/projects" aria-label="K2H-PM, về bãi dự án">
            <span className="cargo-brand-mark" aria-hidden="true"><span /></span>
            <span className="workspace-brand-name">K2H<span>-PM</span></span>
          </Link>
          <nav className="workspace-navigation" aria-label="Điều hướng chính">
            <NavLink to="/" end>Tổng quan</NavLink>
            <NavLink to="/projects">Dự án</NavLink>
          </nav>
          <div className="workspace-account">
            <span className="workspace-account-avatar" aria-hidden="true">{initials}</span>
            <span className="workspace-account-name">{state.user.displayName}</span>
            <button type="button" disabled={isLoggingOut} onClick={() => void handleLogout()}>
              {isLoggingOut ? 'Đang đăng xuất...' : 'Đăng xuất'}
            </button>
          </div>
        </div>
      </header>
      <div className="cargo-workspace-body">
        <aside className="cargo-sidebar" aria-label="Khu vực dự án">
          <nav aria-label="Điều hướng dự án">
            <NavLink to="/" end><span aria-hidden="true">⌂</span>Tổng quan</NavLink>
            <NavLink to="/projects" end><span aria-hidden="true">▦</span>Bãi dự án</NavLink>
            <NavLink to="/projects/new"><span aria-hidden="true">＋</span>Dự án mới</NavLink>
          </nav>
          <span className="cargo-sidebar-signature">K2H-PM · Project workspace</span>
        </aside>
        <main className="workspace-main">
          {state.user.demoExpiresAt ? (
            <div className="workspace-demo-notice" role="status">
              <span className="workspace-demo-dot" aria-hidden="true" />
              <strong>Không gian trải nghiệm</strong>
              <span>Dữ liệu riêng của bạn sẽ tự xóa lúc{' '}
                {new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(state.user.demoExpiresAt))}
              </span>
            </div>
          ) : null}
          {children}
        </main>
      </div>
    </div>
  );
}
