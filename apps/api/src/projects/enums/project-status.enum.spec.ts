import { ProjectStatus } from './project-status.enum';

describe('ProjectStatus', () => {
  it('exposes the supported project lifecycle values', () => {
    expect(Object.values(ProjectStatus)).toEqual([
      'PLANNING',
      'ACTIVE',
      'COMPLETED',
    ]);
  });
});
