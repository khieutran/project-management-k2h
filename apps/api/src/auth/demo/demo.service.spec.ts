import { ConfigService } from '@nestjs/config';
import type { DataSource, EntityManager } from 'typeorm';

import type { EnvironmentVariables } from '../../config/environment.schema';
import { Project } from '../../projects/entities/project.entity';
import { User } from '../../users/entities/user.entity';
import type { RefreshSessionsService } from '../../refresh-sessions/refresh-sessions.service';
import type { PasswordService } from '../services/password.service';
import type { TokenService } from '../services/token.service';
import { DemoService } from './demo.service';

describe('DemoService', () => {
  const savedUsers: User[] = [];
  const savedProjects: Project[] = [];
  let service: DemoService;

  beforeEach(() => {
    savedUsers.length = 0;
    savedProjects.length = 0;
    const manager = {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === User)
          return {
            create: (input: User) => input,
            save: async (input: User) => {
              const user = Object.assign(new User(), input, {
                id: `user-${savedUsers.length + 1}`,
              });
              savedUsers.push(user);
              return user;
            },
          };
        if (entity === Project)
          return {
            create: (input: Project) => input,
            save: async (input: Project[]) => {
              const projects = input.map((item, index) =>
                Object.assign(new Project(), item, {
                  id: `project-${savedProjects.length + index + 1}`,
                }),
              );
              savedProjects.push(...projects);
              return projects;
            },
          };
        throw new Error('Unexpected entity');
      }),
    } as unknown as EntityManager;
    const dataSource = {
      transaction: jest.fn(
        async (callback: (manager: EntityManager) => Promise<unknown>) =>
          callback(manager),
      ),
      query: jest.fn(),
    } as unknown as DataSource;
    const passwordService = {
      hash: jest.fn().mockResolvedValue('hashed-secret'),
    } as unknown as PasswordService;
    const tokenService = {
      generateRefreshToken: jest.fn().mockReturnValue('refresh-token'),
      digestRefreshToken: jest.fn().mockReturnValue('digest'),
      issueAccessToken: jest.fn().mockResolvedValue('access-token'),
      getAccessTokenExpiresInSeconds: jest.fn().mockReturnValue(900),
    } as unknown as TokenService;
    const refreshSessions = {
      createInitialSession: jest.fn().mockResolvedValue({ id: 'session-1' }),
    } as unknown as RefreshSessionsService;
    const config = {
      getOrThrow: jest.fn().mockReturnValue(86400),
    } as unknown as ConfigService<EnvironmentVariables, true>;
    service = new DemoService(
      dataSource,
      passwordService,
      tokenService,
      refreshSessions,
      config,
    );
  });

  it('creates separate users and projects for simultaneous visitors', async () => {
    const first = await service.createSession();
    const second = await service.createSession();

    expect(first.response.user.id).not.toBe(second.response.user.id);
    expect(savedUsers).toHaveLength(2);
    expect(savedProjects).toHaveLength(6);
    expect(
      savedProjects
        .slice(0, 3)
        .every((project) => project.ownerId === first.response.user.id),
    ).toBe(true);
    expect(
      savedProjects
        .slice(3)
        .every((project) => project.ownerId === second.response.user.id),
    ).toBe(true);
    expect(savedProjects[0]?.key).not.toBe(savedProjects[3]?.key);
    expect(first.response).not.toHaveProperty('refreshToken');
  });
});
