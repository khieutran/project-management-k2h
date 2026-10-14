import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { ApiError } from '../api/api-error';
import { AuthShell } from '../auth/AuthShell';
import {
  isEmailValid,
  isRegisterPasswordValid,
  normalizeEmail,
} from '../auth/auth-form-validation';
import { useAuth } from '../auth/use-auth';

type TouchedFields = {
  displayName: boolean;
  email: boolean;
  password: boolean;
  confirmPassword: boolean;
};

const untouchedFields: TouchedFields = {
  displayName: false,
  email: false,
  password: false,
  confirmPassword: false,
};

function getRegisterError(error: unknown): string {
  if (
    error instanceof ApiError &&
    error.code === 'AUTH_EMAIL_ALREADY_EXISTS'
  ) {
    return 'Email này đã được sử dụng';
  }

  if (
    error instanceof ApiError &&
    error.code === 'RATE_LIMIT_EXCEEDED'
  ) {
    return error.message;
  }

  return 'Không thể tạo tài khoản. Vui lòng thử lại.';
}

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [touched, setTouched] = useState(untouchedFields);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const displayNameValid = displayName.trim().length > 0;
  const emailValid = isEmailValid(email);
  const passwordValid = isRegisterPasswordValid(password);
  const confirmationValid =
    confirmPassword.length > 0 && confirmPassword === password;
  const canSubmit =
    displayNameValid &&
    emailValid &&
    passwordValid &&
    confirmationValid &&
    !isSubmitting;

  function touch(field: keyof TouchedFields) {
    setTouched((current) => ({ ...current, [field]: true }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTouched({
      displayName: true,
      email: true,
      password: true,
      confirmPassword: true,
    });

    if (!canSubmit) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await register({
        displayName: displayName.trim(),
        email: normalizeEmail(email),
        password,
      });
      navigate('/', { replace: true });
    } catch (error) {
      setSubmitError(getRegisterError(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Tạo tài khoản"
      description="Bắt đầu sử dụng hệ thống quản lý dự án"
      footer={
        <>
          Đã có tài khoản? <Link to="/login">Đăng nhập</Link>
        </>
      }
    >
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <div className="form-field">
          <label htmlFor="register-display-name">Tên hiển thị</label>
          <input
            id="register-display-name"
            name="displayName"
            autoComplete="name"
            value={displayName}
            aria-invalid={touched.displayName && !displayNameValid}
            onBlur={() => touch('displayName')}
            onChange={(event) => setDisplayName(event.target.value)}
          />
          {touched.displayName && !displayNameValid && (
            <p className="field-error">Tên hiển thị không được để trống</p>
          )}
        </div>

        <div className="form-field">
          <label htmlFor="register-email">Email</label>
          <input
            id="register-email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            aria-invalid={touched.email && !emailValid}
            onBlur={() => touch('email')}
            onChange={(event) => setEmail(event.target.value)}
          />
          {touched.email && !emailValid && (
            <p className="field-error">Email không đúng định dạng</p>
          )}
        </div>

        <div className="form-field">
          <label htmlFor="register-password">Mật khẩu</label>
          <input
            id="register-password"
            name="password"
            type="password"
            autoComplete="new-password"
            maxLength={128}
            value={password}
            aria-invalid={touched.password && !passwordValid}
            onBlur={() => touch('password')}
            onChange={(event) => setPassword(event.target.value)}
          />
          {touched.password && !passwordValid ? (
            <p className="field-error">Mật khẩu phải có từ 10 đến 128 ký tự</p>
          ) : (
            <p className="field-hint">Từ 10 đến 128 ký tự</p>
          )}
        </div>

        <div className="form-field">
          <label htmlFor="register-confirm-password">Xác nhận mật khẩu</label>
          <input
            id="register-confirm-password"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            maxLength={128}
            value={confirmPassword}
            aria-invalid={touched.confirmPassword && !confirmationValid}
            onBlur={() => touch('confirmPassword')}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
          {touched.confirmPassword && !confirmationValid && (
            <p className="field-error">Mật khẩu xác nhận không khớp</p>
          )}
        </div>

        {submitError && (
          <p className="form-alert" role="alert">
            {submitError}
          </p>
        )}

        <button className="primary-button" type="submit" disabled={!canSubmit}>
          {isSubmitting ? 'Đang tạo tài khoản...' : 'Tạo tài khoản'}
        </button>
      </form>
    </AuthShell>
  );
}
