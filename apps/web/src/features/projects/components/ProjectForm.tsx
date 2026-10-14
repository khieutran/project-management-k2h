import { type FormEvent, useState } from 'react';

import {
  suggestProjectKey,
  toCreateProjectInput,
  validateProjectForm,
  type ProjectFormValues,
} from '../project-form-validation';
import type { CreateProjectInput, UpdateProjectInput } from '../project.types';

type ProjectFormProps = {
  mode: 'create' | 'edit';
  initialValues?: Partial<ProjectFormValues>;
  isSubmitting?: boolean;
  serverError?: string;
  onSubmit(input: CreateProjectInput | UpdateProjectInput): void | Promise<void>;
};

const EMPTY_VALUES: ProjectFormValues = {
  key: '', name: '', description: '', startDate: '', endDate: '',
};

export function ProjectForm({
  mode,
  initialValues,
  isSubmitting = false,
  serverError,
  onSubmit,
}: ProjectFormProps) {
  const [values, setValues] = useState<ProjectFormValues>({
    ...EMPTY_VALUES,
    ...initialValues,
  });
  const [errors, setErrors] = useState(() => validateProjectForm(values, { requireKey: mode === 'create' }));
  const [keyWasEdited, setKeyWasEdited] = useState(mode === 'edit');

  function setField(field: keyof ProjectFormValues, value: string): void {
    const next = { ...values, [field]: value };
    if (field === 'name' && mode === 'create' && !keyWasEdited) {
      next.key = suggestProjectKey(value);
    }
    if (field === 'key') {
      next.key = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
      setKeyWasEdited(true);
    }
    setValues(next);
    setErrors(validateProjectForm(next, { requireKey: mode === 'create' }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const nextErrors = validateProjectForm(values, { requireKey: mode === 'create' });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const normalized = toCreateProjectInput(values);
    if (mode === 'create') {
      void onSubmit(normalized);
    } else {
      const { key: _key, ...update } = normalized;
      void onSubmit(update);
    }
  }

  return (
    <form className="project-form" onSubmit={handleSubmit} noValidate>
      {serverError ? <p className="form-alert" role="alert">{serverError}</p> : null}
      <div className="form-field">
        <label htmlFor="project-name">Tên dự án</label>
        <input id="project-name" value={values.name} maxLength={100} onChange={(e) => setField('name', e.target.value)} aria-invalid={Boolean(errors.name)} />
        {errors.name ? <p className="field-error">{errors.name}</p> : null}
      </div>
      {mode === 'create' ? (
        <div className="form-field">
          <label htmlFor="project-key">Mã dự án</label>
          <input id="project-key" value={values.key} maxLength={10} onChange={(e) => setField('key', e.target.value)} aria-invalid={Boolean(errors.key)} />
          {errors.key ? <p className="field-error">{errors.key}</p> : <p className="field-hint">2–10 ký tự in hoa hoặc chữ số; không đổi sau khi tạo.</p>}
        </div>
      ) : null}
      <div className="form-field">
        <label htmlFor="project-description">Mô tả</label>
        <textarea id="project-description" rows={5} value={values.description} maxLength={2000} onChange={(e) => setField('description', e.target.value)} />
        {errors.description ? <p className="field-error">{errors.description}</p> : null}
      </div>
      <div className="project-date-grid">
        <div className="form-field"><label htmlFor="project-start">Ngày bắt đầu</label><input id="project-start" type="date" value={values.startDate} onChange={(e) => setField('startDate', e.target.value)} /></div>
        <div className="form-field"><label htmlFor="project-end">Ngày kết thúc</label><input id="project-end" type="date" value={values.endDate} onChange={(e) => setField('endDate', e.target.value)} aria-invalid={Boolean(errors.endDate)} />{errors.endDate ? <p className="field-error">{errors.endDate}</p> : null}</div>
      </div>
      <button className="primary-button" type="submit" disabled={isSubmitting || Object.keys(errors).length > 0}>
        {isSubmitting ? 'Đang lưu...' : mode === 'create' ? 'Tạo dự án' : 'Lưu thay đổi'}
      </button>
    </form>
  );
}
