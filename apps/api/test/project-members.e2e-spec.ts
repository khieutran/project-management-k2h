import { randomUUID } from 'node:crypto';

import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource, In } from 'typeorm';

import { AppModule } from '../src/app.module';
import { createApplicationValidationPipe } from '../src/common/validation/create-application-validation-pipe';
import type { EnvironmentVariables } from '../src/config/environment.schema';
import { ProjectMemberRole } from '../src/project-members/enums/project-member-role.enum';
import { Project } from '../src/projects/entities/project.entity';
import { ProjectAccessRole } from '../src/projects/enums/project-access-role.enum';
import { RefreshSession } from '../src/refresh-sessions/entities/refresh-session.entity';
import { setupSwagger } from '../src/swagger/setup-swagger';
import { User } from '../src/users/entities/user.entity';
import { UserRole } from '../src/users/enums/user-role.enum';

describe('Project membership (e2e)', () => {
  const password = 'project-member-password-123';
  const ownerEmail = 'member-owner-e2e@example.com';
  const memberEmail = 'member-user-e2e@example.com';
  const outsiderEmail = 'member-outsider-e2e@example.com';
  const adminEmail = 'member-admin-e2e@example.com';
  const testEmails = [ownerEmail, memberEmail, outsiderEmail, adminEmail];

  let app: NestExpressApplication;
  let dataSource: DataSource;
  let ownerToken: string;
  let memberToken: string;
  let outsiderToken: string;
  let adminToken: string;
  let memberUser: User;
  let clientSequence = 0;

  function nextClientIp(): string {
    clientSequence += 1;
    return `198.51.100.${clientSequence}`;
  }

  function uniqueProjectKey(prefix: string): string {
    const suffix = randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase();

    return `${prefix}${suffix}`.slice(0, 10);
  }

  function authorized(token: string) {
    const authorization = `Bearer ${token}`;

    return {
      get: (path: string) =>
        request(app.getHttpServer())
          .get(path)
          .set('Authorization', authorization),
      post: (path: string) =>
        request(app.getHttpServer())
          .post(path)
          .set('Authorization', authorization),
      patch: (path: string) =>
        request(app.getHttpServer())
          .patch(path)
          .set('Authorization', authorization),
      delete: (path: string) =>
        request(app.getHttpServer())
          .delete(path)
          .set('Authorization', authorization),
    };
  }

  async function register(
    email: string,
    displayName: string,
  ): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .set('X-Forwarded-For', nextClientIp())
      .send({ email, password, displayName })
      .expect(201);

    return response.body.accessToken as string;
  }

  async function login(email: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('X-Forwarded-For', nextClientIp())
      .send({ email, password })
      .expect(200);

    return response.body.accessToken as string;
  }

  async function cleanup(): Promise<void> {
    if (!dataSource) {
      return;
    }

    const users = await dataSource.getRepository(User).findBy({
      email: In(testEmails),
    });
    const userIds = users.map((user) => user.id);

    if (userIds.length === 0) {
      return;
    }

    await dataSource.getRepository(Project).delete({
      ownerId: In(userIds),
    });
    await dataSource.getRepository(RefreshSession).delete({
      userId: In(userIds),
    });
    await dataSource.getRepository(User).delete({ id: In(userIds) });
  }

  async function createProject(key: string): Promise<string> {
    const response = await authorized(ownerToken)
      .post('/api/projects')
      .send({
        key,
        name: `Membership project ${key}`,
      })
      .expect(201);

    return response.body.id as string;
  }

  async function addMember(
    projectId: string,
    role = ProjectMemberRole.Member,
  ) {
    return authorized(ownerToken)
      .post(`/api/projects/${projectId}/members`)
      .send({ email: memberEmail, role })
      .expect(201);
  }

  beforeAll(async () => {
    const testingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = testingModule.createNestApplication<NestExpressApplication>();
    app.set('trust proxy', 1);
    app.useGlobalPipes(createApplicationValidationPipe());

    const configService = app.get(ConfigService<EnvironmentVariables, true>);

    app.setGlobalPrefix('api');
    setupSwagger(app, configService.getOrThrow<boolean>('SWAGGER_ENABLED'));

    await app.init();
    dataSource = app.get(DataSource);
  });

  beforeEach(async () => {
    await cleanup();

    ownerToken = await register(ownerEmail, 'Membership Owner');
    memberToken = await register(memberEmail, 'Membership Member');
    outsiderToken = await register(outsiderEmail, 'Membership Outsider');
    await register(adminEmail, 'Membership Admin');

    await dataSource
      .getRepository(User)
      .update({ email: adminEmail }, { role: UserRole.Admin });

    adminToken = await login(adminEmail);
    memberUser = await dataSource
      .getRepository(User)
      .findOneByOrFail({ email: memberEmail });
  });

  afterEach(async () => {
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();

    if (app) {
      await app.close();
    }
  });

  it('allows the owner to add, list, change, and remove a member', async () => {
    const projectId = await createProject(uniqueProjectKey('M1'));

    const addResponse = await authorized(ownerToken)
      .post(`/api/projects/${projectId}/members`)
      .send({
        email: '  MEMBER-USER-E2E@EXAMPLE.COM  ',
        role: ProjectMemberRole.Member,
      })
      .expect(201);

    expect(addResponse.body).toMatchObject({
      user: {
        id: memberUser.id,
        email: memberEmail,
        displayName: 'Membership Member',
      },
      role: ProjectMemberRole.Member,
    });
    expect(addResponse.body.joinedAt).toEqual(expect.any(String));
    expect(addResponse.body.user).not.toHaveProperty('passwordHash');

    const ownerListResponse = await authorized(ownerToken)
      .get(`/api/projects/${projectId}/members`)
      .expect(200);

    expect(ownerListResponse.body.data).toHaveLength(2);
    expect(ownerListResponse.body.data[0]).toMatchObject({
      user: {
        email: ownerEmail,
        displayName: 'Membership Owner',
      },
      role: 'OWNER',
      joinedAt: null,
    });
    expect(ownerListResponse.body.data[1]).toMatchObject({
      user: { id: memberUser.id, email: memberEmail },
      role: ProjectMemberRole.Member,
    });

    const memberProjectList = await authorized(memberToken)
      .get('/api/projects')
      .expect(200);

    expect(memberProjectList.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: projectId,
          accessRole: ProjectAccessRole.Member,
        }),
      ]),
    );

    const memberDetail = await authorized(memberToken)
      .get(`/api/projects/${projectId}`)
      .expect(200);

    expect(memberDetail.body.accessRole).toBe(ProjectAccessRole.Member);

    await authorized(memberToken)
      .get(`/api/projects/${projectId}/members`)
      .expect(200);

    const changeResponse = await authorized(ownerToken)
      .patch(`/api/projects/${projectId}/members/${memberUser.id}`)
      .send({ role: ProjectMemberRole.Manager })
      .expect(200);

    expect(changeResponse.body.role).toBe(ProjectMemberRole.Manager);

    const managerDetail = await authorized(memberToken)
      .get(`/api/projects/${projectId}`)
      .expect(200);

    expect(managerDetail.body.accessRole).toBe(ProjectAccessRole.Manager);

    await authorized(memberToken)
      .patch(`/api/projects/${projectId}`)
      .send({ name: 'Member must not mutate the project' })
      .expect(404);

    await authorized(ownerToken)
      .delete(`/api/projects/${projectId}/members/${memberUser.id}`)
      .expect(204);

    await authorized(memberToken)
      .get(`/api/projects/${projectId}`)
      .expect(404);
    await authorized(memberToken)
      .get(`/api/projects/${projectId}/members`)
      .expect(404);

    const memberProjectsAfterRemoval = await authorized(memberToken)
      .get('/api/projects')
      .expect(200);

    expect(memberProjectsAfterRemoval.body.data).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: projectId })]),
    );
  });

  it('lets a member leave and revokes project access immediately', async () => {
    const projectId = await createProject(uniqueProjectKey('M2'));
    await addMember(projectId, ProjectMemberRole.Manager);

    await authorized(memberToken)
      .delete(`/api/projects/${projectId}/members/me`)
      .expect(204);

    await authorized(memberToken)
      .get(`/api/projects/${projectId}`)
      .expect(404);

    const ownerListResponse = await authorized(ownerToken)
      .get(`/api/projects/${projectId}/members`)
      .expect(200);

    expect(ownerListResponse.body.data).toHaveLength(1);
    expect(ownerListResponse.body.data[0].role).toBe('OWNER');

    const ownerLeaveResponse = await authorized(ownerToken)
      .delete(`/api/projects/${projectId}/members/me`)
      .expect(400);

    expect(ownerLeaveResponse.body).toMatchObject({
      code: 'PROJECT_OWNER_CANNOT_LEAVE',
    });
  });

  it('masks projects from outsiders and keeps ADMIN membership access read-only', async () => {
    const projectId = await createProject(uniqueProjectKey('M3'));
    await addMember(projectId);

    await authorized(outsiderToken)
      .get(`/api/projects/${projectId}`)
      .expect(404);
    await authorized(outsiderToken)
      .get(`/api/projects/${projectId}/members`)
      .expect(404);

    const adminDetail = await authorized(adminToken)
      .get(`/api/projects/${projectId}`)
      .expect(200);

    expect(adminDetail.body.accessRole).toBe(ProjectAccessRole.AdminViewer);

    const adminMemberList = await authorized(adminToken)
      .get(`/api/projects/${projectId}/members`)
      .expect(200);

    expect(adminMemberList.body.data).toHaveLength(2);

    await authorized(adminToken)
      .post(`/api/projects/${projectId}/members`)
      .send({
        email: outsiderEmail,
        role: ProjectMemberRole.Member,
      })
      .expect(404);
    await authorized(adminToken)
      .patch(`/api/projects/${projectId}/members/${memberUser.id}`)
      .send({ role: ProjectMemberRole.Manager })
      .expect(404);
    await authorized(adminToken)
      .delete(`/api/projects/${projectId}/members/${memberUser.id}`)
      .expect(404);
  });

  it('keeps archived membership readable while rejecting every mutation', async () => {
    const projectId = await createProject(uniqueProjectKey('M4'));
    await addMember(projectId);

    await authorized(ownerToken)
      .post(`/api/projects/${projectId}/archive`)
      .expect(200);

    await authorized(ownerToken)
      .get(`/api/projects/${projectId}/members`)
      .expect(200);
    await authorized(memberToken)
      .get(`/api/projects/${projectId}/members`)
      .expect(200);
    await authorized(adminToken)
      .get(`/api/projects/${projectId}/members`)
      .expect(200);

    for (const mutation of [
      {
        name: 'add member',
        send: () =>
          authorized(ownerToken)
            .post(`/api/projects/${projectId}/members`)
            .send({
              email: outsiderEmail,
              role: ProjectMemberRole.Member,
            }),
      },
      {
        name: 'change member role',
        send: () =>
          authorized(ownerToken)
            .patch(`/api/projects/${projectId}/members/${memberUser.id}`)
            .send({ role: ProjectMemberRole.Manager }),
      },
      {
        name: 'remove member',
        send: () =>
          authorized(ownerToken).delete(
            `/api/projects/${projectId}/members/${memberUser.id}`,
          ),
      },
      {
        name: 'leave project',
        send: () =>
          authorized(memberToken).delete(
            `/api/projects/${projectId}/members/me`,
          ),
      },
    ]) {
      const response = await mutation.send();

      expect({
        mutation: mutation.name,
        status: response.status,
        code: response.body.code,
      }).toEqual({
        mutation: mutation.name,
        status: 409,
        code: 'PROJECT_MEMBERSHIP_LOCKED',
      });
    }
  });
});
