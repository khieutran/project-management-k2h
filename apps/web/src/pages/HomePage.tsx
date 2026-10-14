import { useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../auth/use-auth';

export function HomePage() {
  const { state, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  if (state.status !== 'authenticated') {
    return null;
  }

  const { user } = state;

  async function handleLogout() {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);

    try {
      await logout();
    } catch {
      // AuthProvider still clears local authentication in its finally block.
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <div className="home-page">
      <header className="home-header">
        <div>
          <p className="home-brand">K2H</p>
          <strong>Project Management</strong>
        </div>
        <div className="home-account">
          <span>{user.displayName}</span>
          <button
            className="secondary-button"
            type="button"
            disabled={isLoggingOut}
            onClick={() => void handleLogout()}
          >
            {isLoggingOut ? 'Đang đăng xuất...' : 'Đăng xuất'}
          </button>
        </div>
      </header>

      <main className="home-content">
        <section className="welcome-panel">
          <p className="home-eyebrow">Authentication ready</p>
          <h1>Xin chào, {user.displayName}</h1>
          <p>Bạn đã đăng nhập thành công vào hệ thống quản lý dự án K2H.</p>
          <Link className="primary-link" to="/projects">Mở danh sách dự án</Link>
        </section>

        <section className="account-card" aria-labelledby="account-title">
          <h2 id="account-title">Thông tin tài khoản</h2>
          <dl>
            <div>
              <dt>Tên</dt>
              <dd>{user.displayName}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{user.email}</dd>
            </div>
            <div>
              <dt>Role</dt>
              <dd>{user.role}</dd>
            </div>
          </dl>
        </section>
      </main>
    </div>
  );
}
