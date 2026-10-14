import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { ApiError } from '../api/api-error';
import { AuthShell } from '../auth/AuthShell';
import {
  isEmailValid,
  isLoginPasswordValid,
  normalizeEmail,
} from '../auth/auth-form-validation';
import { useAuth } from '../auth/use-auth';

type LoginLocationState = {
  from?: {
    pathname?: string;
    search?: string;
    hash?: string;
  };
};

function getDestination(state: LoginLocationState | null): string {
  const from = state?.from;

  if (
    !from?.pathname?.startsWith('/') ||
    from.pathname.startsWith('//')
  ) {
    return '/';
  }

  return `${from.pathname}${from.search ?? ''}${from.hash ?? ''}`;
}

function getLoginError(error: unknown): string {
  if (
    error instanceof ApiError &&
    error.code === 'RATE_LIMIT_EXCEEDED'
  ) {
    return error.message;
  }

  return 'Email hoặc mật khẩu không hợp lệ';
}

export function LoginPage() {
  const { login } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const emailValid = isEmailValid(email);
  const passwordValid = isLoginPasswordValid(password);
  const canSubmit = emailValid && passwordValid && !isSubmitting;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEmailTouched(true);

    if (!canSubmit) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await login({
        email: normalizeEmail(email),
        password,
      });
      navigate(
        getDestination(location.state as LoginLocationState | null),
        { replace: true },
      );
    } catch (error) {
      setSubmitError(getLoginError(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Đăng nhập"
      description="Đăng nhập để tiếp tục vào hệ thống"
      footer={
        <>
          Chưa có tài khoản? <Link to="/register">Đăng ký</Link>
        </>
      }
    >
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <div className="form-field">
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            aria-invalid={emailTouched && !emailValid}
            aria-describedby={
              emailTouched && !emailValid ? 'login-email-error' : undefined
            }
            onBlur={() => setEmailTouched(true)}
            onChange={(event) => setEmail(event.target.value)}
          />
          {emailTouched && !emailValid && (
            <p id="login-email-error" className="field-error">
              Email không đúng định dạng
            </p>
          )}
        </div>

        <div className="form-field">
          <label htmlFor="login-password">Mật khẩu</label>
          <input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            maxLength={128}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>

        {submitError && (
          <p className="form-alert" role="alert">
            {submitError}
          </p>
        )}

        <button className="primary-button" type="submit" disabled={!canSubmit}>
          {isSubmitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
        </button>
      </form>
    </AuthShell>
  );
}
