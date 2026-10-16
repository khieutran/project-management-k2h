import { ProjectMemberRole } from './project-member-role.enum';

describe('ProjectMemberRole', () => {
  it('exposes only the supported membership roles', () => {
    expect(Object.values(ProjectMemberRole)).toEqual(['MANAGER', 'MEMBER']);
  });
});
