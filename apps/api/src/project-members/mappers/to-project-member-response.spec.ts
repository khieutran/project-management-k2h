import { Project } from '../../projects/entities/project.entity';
import { User } from '../../users/entities/user.entity';
import { UserRole } from '../../users/enums/user-role.enum';
import { ProjectMember } from '../entities/project-member.entity';
import { ProjectMemberRole } from '../enums/project-member-role.enum';
import {
  toProjectMemberResponse,
  toProjectOwnerMemberResponse,
} from './to-project-member-response';

describe('project member response mappers', () => {
  const user = Object.assign(new User(), {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'member@example.com',
    displayName: 'Project Member',
    passwordHash: 'argon2-secret-password-hash',
    role: UserRole.User,
    createdAt: new Date('2026-10-15T00:00:00.000Z'),
    updatedAt: new Date('2026-10-15T00:00:00.000Z'),
  });

  it('maps a loaded membership to an explicit safe response', () => {
    const membership = Object.assign(new ProjectMember(), {
      id: '22222222-2222-4222-8222-222222222222',
      projectId: '33333333-3333-4333-8333-333333333333',
      userId: user.id,
      user,
      role: ProjectMemberRole.Manager,
      joinedAt: new Date('2026-10-16T08:30:00.000Z'),
      createdAt: new Date('2026-10-16T08:30:00.000Z'),
      updatedAt: new Date('2026-10-16T08:30:00.000Z'),
    });

    const result = toProjectMemberResponse(membership);

    expect(result).toEqual({
      user: {
        id: user.id,
        email: 'member@example.com',
        displayName: 'Project Member',
      },
      role: ProjectMemberRole.Manager,
      joinedAt: '2026-10-16T08:30:00.000Z',
    });
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(result).not.toHaveProperty('id');
    expect(result).not.toHaveProperty('projectId');
    expect(result).not.toHaveProperty('createdAt');
    expect(result).not.toHaveProperty('updatedAt');
  });

  it('maps a project owner without fabricating a membership', () => {
    const project = Object.assign(new Project(), {
      ownerId: user.id,
      owner: user,
    });

    expect(toProjectOwnerMemberResponse(project)).toEqual({
      user: {
        id: user.id,
        email: 'member@example.com',
        displayName: 'Project Member',
      },
      role: 'OWNER',
      joinedAt: null,
    });
  });

  it('rejects a membership whose user relation was not loaded', () => {
    const membership = Object.assign(new ProjectMember(), {
      user: undefined,
    });

    expect(() => toProjectMemberResponse(membership)).toThrow(
      'Project member user must be loaded before mapping the response',
    );
  });

  it('rejects a project whose owner relation was not loaded', () => {
    const project = Object.assign(new Project(), {
      owner: undefined,
    });

    expect(() => toProjectOwnerMemberResponse(project)).toThrow(
      'Project owner must be loaded before mapping the member response',
    );
  });
});
