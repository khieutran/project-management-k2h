import { useState, type FormEvent } from 'react';

import { ApiError } from '../../../api/api-error';
import {
  isEmailValid,
  normalizeEmail,
} from '../../../auth/auth-form-validation';
import type {
  AddProjectMemberInput,
  ProjectMemberRole,
} from '../project.types';

type AddProjectMemberFormProps = {
  onSubmit(input: AddProjectMemberInput): Promise<void>;
};

function getAddMemberError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'PROJECT_MEMBER_ALREADY_EXISTS') {
      return 'Người dùng đã là thành viên của dự án.';
    }

    if (error.code === 'PROJECT_MEMBER_USER_NOT_FOUND') {
      return 'Không tìm thấy tài khoản với email này.';
    }

    if (error.code === 'PROJECT_MEMBER_OWNER_CANNOT_BE_ADDED') {
      return 'Không thể thêm chủ dự án làm thành viên.';
    }
  }

  return 'Không thể thêm thành viên. Vui lòng thử lại.';
}

export function AddProjectMemberForm({
  onSubmit,
}: AddProjectMemberFormProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<ProjectMemberRole>('MEMBER');
  const [emailTouched, setEmailTouched] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string>();
  const emailValid = isEmailValid(email);
  const canSubmit = emailValid && !isSubmitting;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEmailTouched(true);

    if (!canSubmit) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(undefined);

    try {
      await onSubmit({ email: normalizeEmail(email), role });
      setEmail('');
      setRole('MEMBER');
      setEmailTouched(false);
    } catch (error) {
      setSubmitError(getAddMemberError(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="add-member-form" onSubmit={handleSubmit} noValidate>
      <div className="form-field">
        <label htmlFor="project-member-email">Email thành viên</label>
        <input
          id="project-member-email"
          type="email"
          autoComplete="off"
          value={email}
          aria-invalid={emailTouched && !emailValid}
          onBlur={() => setEmailTouched(true)}
          onChange={(event) => setEmail(event.target.value)}
        />
        {emailTouched && !emailValid ? (
          <p className="field-error">Email không đúng định dạng</p>
        ) : (
          <p className="field-hint">
            Nhập chính xác email của tài khoản đã đăng ký.
          </p>
        )}
      </div>

      <div className="form-field">
        <label htmlFor="project-member-role">Vai trò</label>
        <select
          id="project-member-role"
          value={role}
          onChange={(event) =>
            setRole(event.target.value as ProjectMemberRole)
          }
        >
          <option value="MEMBER">Thành viên</option>
          <option value="MANAGER">Quản lý</option>
        </select>
      </div>

      {submitError ? (
        <p className="form-alert" role="alert">
          {submitError}
        </p>
      ) : null}

      <button className="primary-button" type="submit" disabled={!canSubmit}>
        {isSubmitting ? 'Đang thêm...' : 'Thêm thành viên'}
      </button>
    </form>
  );
}
