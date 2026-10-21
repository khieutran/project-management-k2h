import type { PropsWithChildren, ReactNode } from 'react';

import './auth-scene.css';

type AuthShellProps = PropsWithChildren<{
  title: string;
  description: string;
  footer: ReactNode;
}>;

export function AuthShell({
  title,
  description,
  footer,
  children,
}: AuthShellProps) {
  return (
    <main className="auth-page">
      <div className="auth-scene" role="img" aria-label="Ảnh bãi xe container K2H-PM" />
      <section className="auth-panel">
        <div className="auth-card" aria-labelledby="auth-title">
          <p className="auth-brand">K2H-PM <span>/ KHÔNG GIAN LÀM VIỆC</span></p>
          <h1 id="auth-title">{title}</h1>
          <p className="auth-description">{description}</p>
          {children}
          <p className="auth-footer">{footer}</p>
        </div>
        <p className="auth-panel__footnote">K2H-PM <span>·</span> Đưa mọi dự án vào đúng vị trí.</p>
      </section>
    </main>
  );
}
