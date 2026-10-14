import { describe, expect, it } from 'vitest';

import {
  suggestProjectKey,
  validateProjectForm,
} from './project-form-validation';

describe('project form validation', () => {
  it('suggests an uppercase key without accents or separators', () => {
    expect(suggestProjectKey('Quản lý công việc')).toBe('QLCV');
  });

  it('rejects an end date before the start date', () => {
    expect(
      validateProjectForm({
        key: 'K2H',
        name: 'Project K2H',
        description: '',
        startDate: '2026-10-20',
        endDate: '2026-10-19',
      }).endDate,
    ).toBe('Ngày kết thúc không được trước ngày bắt đầu');
  });
});
