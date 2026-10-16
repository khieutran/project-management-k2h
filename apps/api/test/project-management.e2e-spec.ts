import { randomUUID } from 'node:crypto';

import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource, In } from 'typeorm';

import { AppModule } from '../src/app.module';
import { createApplicationValidationPipe } from '../src/common/validation/create-application-validation-pipe';
import type { EnvironmentVariables } from '../src/config/environment.schema';
import { Project } from '../src/projects/entities/project.entity';
import { ProjectStatus } from '../src/projects/enums/project-status.enum';
import { RefreshSession } from '../src/refresh-sessions/entities/refresh-session.entity';
import { setupSwagger } from '../src/swagger/setup-swagger';
import { User } from '../src/users/entities/user.entity';
import { UserRole } from '../src/users/enums/user-role.enum';

describe('Project management (e2e)', () => {
  const password = 'project-password-123';
  const ownerEmail = 'project-owner-e2e@example.com';
  const otherEmail = 'project-other-e2e@example.com';
  const adminEmail = 'project-admin-e2e@example.com';
  const testEmails = [ownerEmail, otherEmail, adminEmail];

  let app: NestExpressApplication;
  let dataSource: DataSource;
  let ownerToken: string;
  let otherToken: string;
  let adminToken: string;
  let clientSequence = 0;

  function nextClientIp(): string {
    clientSequence += 1;
    return `203.0.113.${clientSequence}`;
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

  async function register(email: string, displayName: string): Promise<string> {
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

  async function createOwnerProject(key: string) {
    return authorized(ownerToken)
      .post('/api/projects')
      .send({
        key,
        name: 'Project Management K2H',
        description: 'Backend and frontend learning project',
        startDate: '2026-10-15',
        endDate: '2027-03-31',
      })
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

    ownerToken = await register(ownerEmail, 'Project Owner');
    otherToken = await register(otherEmail, 'Other User');
    await register(adminEmail, 'Project Admin');

    await dataSource
      .getRepository(User)
      .update({ email: adminEmail }, { role: UserRole.Admin });

    adminToken = await login(adminEmail);
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

  it('runs the owner CRUD, lifecycle, archive, restore, and delete flow', async () => {
    const projectKey = uniqueProjectKey('K2H');
    const createResponse = await authorized(ownerToken)
      .post('/api/projects')
      .send({
        key: `  ${projectKey.toLowerCase()}  `,
        name: '  Project Management K2H  ',
        startDate: '2026-10-15',
        endDate: '2027-03-31',
      })
      .expect(201);

    expect(createResponse.body).toMatchObject({
      key: projectKey,
      name: 'Project Management K2H',
      status: ProjectStatus.Planning,
      owner: { displayName: 'Project Owner' },
    });
    expect(createResponse.body).not.toHaveProperty('ownerId');

    const projectId = createResponse.body.id as string;

    const listResponse = await authorized(ownerToken)
      .get(`/api/projects?page=1&limit=20&search=${projectKey}`)
      .expect(200);

    expect(listResponse.body.pagination).toEqual({
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
    });
    expect(listResponse.body.data).toHaveLength(1);

    await authorized(ownerToken).get(`/api/projects/${projectId}`).expect(200);

    const updateResponse = await authorized(ownerToken)
      .patch(`/api/projects/${projectId}`)
      .send({ name: 'Renamed Project', description: null })
      .expect(200);

    expect(updateResponse.body).toMatchObject({
      name: 'Renamed Project',
      description: null,
    });

    await authorized(ownerToken)
      .patch(`/api/projects/${projectId}/status`)
      .send({ status: ProjectStatus.Active })
      .expect(200);

    await authorized(ownerToken)
      .patch(`/api/projects/${projectId}/status`)
      .send({ status: ProjectStatus.Completed })
      .expect(200);

    const archiveResponse = await authorized(ownerToken)
      .post(`/api/projects/${projectId}/archive`)
      .expect(200);

    expect(archiveResponse.body.status).toBe(ProjectStatus.Completed);
    expect(archiveResponse.body.archivedAt).toEqual(expect.any(String));

    const archivedList = await authorized(ownerToken)
      .get('/api/projects?view=archived')
      .expect(200);

    expect(archivedList.body.data).toHaveLength(1);

    const restoreResponse = await authorized(ownerToken)
      .post(`/api/projects/${projectId}/restore`)
      .expect(200);

    expect(restoreResponse.body.archivedAt).toBeNull();
    expect(restoreResponse.body.status).toBe(ProjectStatus.Completed);

    await authorized(ownerToken)
      .delete(`/api/projects/${projectId}`)
      .expect(204);

    await authorized(ownerToken).get(`/api/projects/${projectId}`).expect(404);

    await authorized(ownerToken)
      .delete(`/api/projects/${projectId}`)
      .expect(404);

    const deletedResponse = await authorized(adminToken)
      .get(`/api/projects/${projectId}?includeDeleted=true`)
      .expect(200);

    expect(deletedResponse.body.deletedAt).toEqual(expect.any(String));
  });

  it('maps duplicate project keys to a sanitized conflict', async () => {
    const projectKey = uniqueProjectKey('DUP');
    await createOwnerProject(projectKey);

    const response = await authorized(otherToken)
      .post('/api/projects')
      .send({ key: projectKey, name: 'Duplicate key project' })
      .expect(409);

    expect(response.body).toMatchObject({
      code: 'PROJECT_KEY_ALREADY_EXISTS',
      message: 'Mã project đã tồn tại',
    });
    expect(JSON.stringify(response.body)).not.toContain('23505');
  });

  it('isolates USER reads while allowing global ADMIN reads', async () => {
    const projectKey = uniqueProjectKey('ACL');
    const createResponse = await createOwnerProject(projectKey);
    const projectId = createResponse.body.id as string;

    const otherList = await authorized(otherToken)
      .get('/api/projects')
      .expect(200);

    expect(otherList.body.data).toHaveLength(0);

    await authorized(otherToken).get(`/api/projects/${projectId}`).expect(404);

    const adminList = await authorized(adminToken)
      .get('/api/projects')
      .expect(200);

    expect(adminList.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: projectId, key: projectKey }),
      ]),
    );

    await authorized(adminToken).get(`/api/projects/${projectId}`).expect(200);

    await authorized(adminToken)
      .patch(`/api/projects/${projectId}`)
      .send({ name: 'Admin must not mutate this project' })
      .expect(404);
  });

  it('allows an ADMIN to mutate a project that the ADMIN owns', async () => {
    const projectKey = uniqueProjectKey('ADM');
    const createResponse = await authorized(adminToken)
      .post('/api/projects')
      .send({ key: projectKey, name: 'Admin owned project' })
      .expect(201);

    const projectId = createResponse.body.id as string;

    const updateResponse = await authorized(adminToken)
      .patch(`/api/projects/${projectId}`)
      .send({ name: 'Admin updated own project' })
      .expect(200);

    expect(updateResponse.body.name).toBe('Admin updated own project');
  });
});
