import { User } from '../../users/entities/user.entity';
import { UserRole } from '../../users/enums/user-role.enum';
import { Project } from '../entities/project.entity';
import { ProjectStatus } from '../enums/project-status.enum';
import { toProjectResponse } from './to-project-response';

describe('toProjectResponse', () => {
  it('maps a project to its explicit safe API representation', () => {
    const owner = Object.assign(new User(), {
      id: '11111111-1111-4111-8111-111111111111',
      email: 'owner@example.com',
      passwordHash: 'argon2-secret-password-hash',
      displayName: 'Nguyen Van A',
      role: UserRole.User,
      refreshSessions: [{ tokenDigest: 'secret-refresh-token-digest' }],
      createdAt: new Date('2026-10-01T00:00:00.000Z'),
      updatedAt: new Date('2026-10-01T00:00:00.000Z'),
    });
    const project = Object.assign(new Project(), {
      id: '22222222-2222-4222-8222-222222222222',
      key: 'K2H',
      name: 'Project Management K2H',
      description: 'Learn by building',
      ownerId: owner.id,
      owner,
      status: ProjectStatus.Planning,
      startDate: '2026-10-15',
      endDate: '2027-03-31',
      archivedAt: null,
      deletedAt: null,
      createdAt: new Date('2026-10-15T10:00:00.000Z'),
      updatedAt: new Date('2026-10-16T11:30:00.000Z'),
    });

    const result = toProjectResponse(project);

    expect(result).toEqual({
      id: '22222222-2222-4222-8222-222222222222',
      key: 'K2H',
      name: 'Project Management K2H',
      description: 'Learn by building',
      status: ProjectStatus.Planning,
      startDate: '2026-10-15',
      endDate: '2027-03-31',
      archivedAt: null,
      deletedAt: null,
      owner: {
        id: '11111111-1111-4111-8111-111111111111',
        displayName: 'Nguyen Van A',
      },
      createdAt: '2026-10-15T10:00:00.000Z',
      updatedAt: '2026-10-16T11:30:00.000Z',
    });
    expect(result).not.toHaveProperty('ownerId');
    expect(result.owner).not.toHaveProperty('email');
    expect(result.owner).not.toHaveProperty('passwordHash');
    expect(result.owner).not.toHaveProperty('role');
    expect(result.owner).not.toHaveProperty('refreshSessions');
  });

  it('serializes archived and deleted timestamps as ISO strings', () => {
    const owner = Object.assign(new User(), {
      id: '11111111-1111-4111-8111-111111111111',
      displayName: 'Nguyen Van A',
    });
    const project = Object.assign(new Project(), {
      id: '22222222-2222-4222-8222-222222222222',
      key: 'K2H',
      name: 'Project Management K2H',
      description: null,
      owner,
      status: ProjectStatus.Completed,
      startDate: null,
      endDate: null,
      archivedAt: new Date('2026-12-01T08:00:00.000Z'),
      deletedAt: new Date('2026-12-02T09:00:00.000Z'),
      createdAt: new Date('2026-10-15T10:00:00.000Z'),
      updatedAt: new Date('2026-12-02T09:00:00.000Z'),
    });

    const result = toProjectResponse(project);

    expect(result.archivedAt).toBe('2026-12-01T08:00:00.000Z');
    expect(result.deletedAt).toBe('2026-12-02T09:00:00.000Z');
  });

  it('throws when the query did not load the project owner', () => {
    const project = Object.assign(new Project(), {
      owner: undefined,
    });

    expect(() => toProjectResponse(project)).toThrow(
      'Project owner must be loaded before mapping the response',
    );
  });
});
