export function AuthLoading() {
  return (
    <main className="auth-loading" aria-live="polite" aria-busy="true">
      <span className="auth-loading__spinner" aria-hidden="true" />
      <p>Đang kiểm tra phiên đăng nhập...</p>
    </main>
  );
}
