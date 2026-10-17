import { randomUUID } from 'node:crypto';

import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource, In } from 'typeorm';

import { AppModule } from '../src/app.module';
import { DemoService } from '../src/auth/demo/demo.service';
import { createApplicationValidationPipe } from '../src/common/validation/create-application-validation-pipe';
import { Project } from '../src/projects/entities/project.entity';
import { User } from '../src/users/entities/user.entity';

describe('Demo workspaces (e2e)', () => {
  let app: NestExpressApplication;
  let dataSource: DataSource;
  let demoService: DemoService;
  const demoUserIds: string[] = [];

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication<NestExpressApplication>();
    app.set('trust proxy', 1);
    app.useGlobalPipes(createApplicationValidationPipe());
    app.setGlobalPrefix('api');
    await app.init();
    dataSource = app.get(DataSource);
    demoService = app.get(DemoService);
  });

  afterAll(async () => {
    if (dataSource && demoUserIds.length) {
      await dataSource
        .getRepository(Project)
        .delete({ ownerId: In(demoUserIds) });
      await dataSource.getRepository(User).delete({ id: In(demoUserIds) });
    }
    if (app) await app.close();
  });

  it('gives concurrent visitors separate editable projects and removes expired data', async () => {
    const [first, second] = await Promise.all([
      request(app.getHttpServer())
        .post('/api/auth/demo')
        .set('X-Forwarded-For', '198.51.100.61')
        .expect(200),
      request(app.getHttpServer())
        .post('/api/auth/demo')
        .set('X-Forwarded-For', '198.51.100.62')
        .expect(200),
    ]);
    const firstUserId = first.body.user.id as string;
    const secondUserId = second.body.user.id as string;
    demoUserIds.push(firstUserId, secondUserId);
    expect(firstUserId).not.toBe(secondUserId);
    expect(first.body.user.demoExpiresAt).toEqual(expect.any(String));
    expect(first.headers['set-cookie']).toBeDefined();

    const list = (token: string) =>
      request(app.getHttpServer())
        .get('/api/projects')
        .set('Authorization', `Bearer ${token}`);
    const firstProjects = await list(first.body.accessToken as string).expect(
      200,
    );
    const secondProjects = await list(second.body.accessToken as string).expect(
      200,
    );
    expect(firstProjects.body.data).toHaveLength(3);
    expect(secondProjects.body.data).toHaveLength(3);
    expect(
      firstProjects.body.data.every(
        (project: { owner: { id: string } }) =>
          project.owner.id === firstUserId,
      ),
    ).toBe(true);
    expect(
      secondProjects.body.data.every(
        (project: { owner: { id: string } }) =>
          project.owner.id === secondUserId,
      ),
    ).toBe(true);

    await request(app.getHttpServer())
      .post('/api/projects')
      .set('Authorization', `Bearer ${first.body.accessToken as string}`)
      .send({
        key: randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase(),
        name: 'Dự án riêng',
      })
      .expect(201);
    expect(
      (await list(first.body.accessToken as string).expect(200)).body.data,
    ).toHaveLength(4);
    expect(
      (await list(second.body.accessToken as string).expect(200)).body.data,
    ).toHaveLength(3);

    await dataSource
      .getRepository(User)
      .update(
        { id: In(demoUserIds) },
        { demoExpiresAt: new Date(Date.now() - 1_000) },
      );
    expect(await demoService.cleanupExpired()).toBeGreaterThanOrEqual(2);
    expect(
      await dataSource.getRepository(User).countBy({ id: In(demoUserIds) }),
    ).toBe(0);
    expect(
      await dataSource
        .getRepository(Project)
        .countBy({ ownerId: In(demoUserIds) }),
    ).toBe(0);
  });
});
