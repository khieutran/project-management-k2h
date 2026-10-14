import type { PropsWithChildren } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../../../auth/use-auth';

export function ProjectPageShell({ children }: PropsWithChildren) {
  const { state, logout } = useAuth();
  if (state.status !== 'authenticated') return null;

  return (
    <div className="home-page">
      <header className="home-header">
        <Link className="brand-link" to="/"><span className="home-brand">K2H</span><strong>Project Management</strong></Link>
        <nav className="project-nav" aria-label="Điều hướng chính">
          <Link to="/projects">Dự án</Link>
          <span>{state.user.displayName}</span>
          <button className="secondary-button" type="button" onClick={() => void logout()}>Đăng xuất</button>
        </nav>
      </header>
      <main className="projects-content">{children}</main>
    </div>
  );
}
