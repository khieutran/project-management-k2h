import type { CreateProjectInput } from './project.types';

export type ProjectFormValues = {
  key: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
};

export type ProjectFormErrors = Partial<Record<keyof ProjectFormValues, string>>;

export function suggestProjectKey(name: string): string {
  const normalized = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .trim();
  const words = normalized.match(/[a-z0-9]+/gi) ?? [];
  const key =
    words.length > 1
      ? words.map((word) => word[0]).join('')
      : (words[0] ?? '').slice(0, 10);

  return key.toUpperCase().slice(0, 10);
}

export function validateProjectForm(
  values: ProjectFormValues,
  options: { requireKey?: boolean } = {},
): ProjectFormErrors {
  const errors: ProjectFormErrors = {};
  if (options.requireKey !== false && !/^[A-Z0-9]{2,10}$/.test(values.key)) {
    errors.key = 'Mã gồm 2–10 ký tự in hoa hoặc chữ số';
  }
  const name = values.name.trim();
  if (name.length < 3 || name.length > 100) {
    errors.name = 'Tên dự án phải có từ 3 đến 100 ký tự';
  }
  if (values.description.trim().length > 2000) {
    errors.description = 'Mô tả không được vượt quá 2000 ký tự';
  }
  if (values.startDate && values.endDate && values.endDate < values.startDate) {
    errors.endDate = 'Ngày kết thúc không được trước ngày bắt đầu';
  }
  return errors;
}

export function toCreateProjectInput(values: ProjectFormValues): CreateProjectInput {
  return {
    key: values.key.trim().toUpperCase(),
    name: values.name.trim(),
    description: values.description.trim() || null,
    startDate: values.startDate || null,
    endDate: values.endDate || null,
  };
}
