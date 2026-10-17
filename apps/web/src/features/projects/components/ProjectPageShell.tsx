import type { PropsWithChildren } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../../../auth/use-auth";

export function ProjectPageShell({ children }: PropsWithChildren) {
  const { state, logout } = useAuth();
  if (state.status !== "authenticated") return null;

  return (
    <div className="home-page">
      <header className="home-header">
        <Link className="brand-link" to="/projects">
          <span className="home-brand">K2H</span>
          <strong>Project Management</strong>
        </Link>
        <nav className="project-nav" aria-label="Điều hướng chính">
          <Link to="/projects">Dự án</Link>
          <span>{state.user.displayName}</span>
          <button
            className="secondary-button"
            type="button"
            onClick={() => void logout()}
          >
            Đăng xuất
          </button>
        </nav>
      </header>
      <main className="projects-content">
        {state.user.demoExpiresAt ? (
          <div className="demo-notice" role="status">
            Không gian demo riêng của bạn · Dữ liệu sẽ tự xóa lúc{" "}
            {new Intl.DateTimeFormat("vi-VN", {
              dateStyle: "short",
              timeStyle: "short",
            }).format(new Date(state.user.demoExpiresAt))}
          </div>
        ) : null}
        {children}
      </main>
    </div>
  );
}
