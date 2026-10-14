import type { PropsWithChildren, ReactNode } from 'react';

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
      <section className="auth-card" aria-labelledby="auth-title">
        <p className="auth-brand">K2H Project Management</p>
        <h1 id="auth-title">{title}</h1>
        <p className="auth-description">{description}</p>
        {children}
        <p className="auth-footer">{footer}</p>
      </section>
    </main>
  );
}
