import { ConfigService } from '@nestjs/config';
import type { EntityManager, Repository } from 'typeorm';

import type { EnvironmentVariables } from '../config/environment.schema';
import { RefreshSession } from './entities/refresh-session.entity';
import { RefreshSessionsService } from './refresh-sessions.service';

describe('RefreshSessionsService', () => {
  const now = new Date('2026-10-05T00:00:00.000Z');
  const refreshTokenTtlSeconds = 604_800;

  let repository: {
    create: jest.Mock;
    save: jest.Mock;
  };

  let refreshSessionsService: RefreshSessionsService;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(now);

    repository = {
      create: jest.fn(),
      save: jest.fn(),
    };

    const configService = new ConfigService<EnvironmentVariables, true>({
      REFRESH_TOKEN_TTL_SECONDS: refreshTokenTtlSeconds,
    });

    refreshSessionsService = new RefreshSessionsService(
      repository as unknown as Repository<RefreshSession>,
      configService,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('createInitialSession', () => {
    it('creates an active refresh session containing only the token digest', async () => {
      repository.create.mockImplementation((input) =>
        Object.assign(new RefreshSession(), input),
      );

      repository.save.mockImplementation(async (session: RefreshSession) =>
        Object.assign(session, {
          id: '22222222-2222-4222-8222-222222222222',
          createdAt: now,
          updatedAt: now,
        }),
      );

      const result = await refreshSessionsService.createInitialSession({
        userId: '11111111-1111-4111-8111-111111111111',
        tokenDigest: 'a'.repeat(64),
      });

      const createInput = repository.create.mock.calls[0]?.[0];

      expect(createInput).toMatchObject({
        userId: '11111111-1111-4111-8111-111111111111',
        tokenDigest: 'a'.repeat(64),
        expiresAt: new Date('2026-10-12T00:00:00.000Z'),
        revokedAt: null,
        replacedBySessionId: null,
      });

      expect(createInput.familyId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );

      expect(createInput).not.toHaveProperty('refreshToken');
      expect(repository.save).toHaveBeenCalled();
      expect(result.id).toBe('22222222-2222-4222-8222-222222222222');
    });

    it('uses the transaction repository when an EntityManager is provided', async () => {
      const transactionalRepository = {
        create: jest.fn(),
        save: jest.fn(),
      };

      const entityManager = {
        getRepository: jest.fn().mockReturnValue(transactionalRepository),
      } as unknown as EntityManager;

      const unsavedSession = Object.assign(new RefreshSession(), {
        userId: '11111111-1111-4111-8111-111111111111',
        familyId: '33333333-3333-4333-8333-333333333333',
        tokenDigest: 'a'.repeat(64),
        expiresAt: new Date('2026-10-12T00:00:00.000Z'),
        revokedAt: null,
        replacedBySessionId: null,
      });

      transactionalRepository.create.mockReturnValue(unsavedSession);
      transactionalRepository.save.mockResolvedValue(unsavedSession);

      await refreshSessionsService.createInitialSession(
        {
          userId: '11111111-1111-4111-8111-111111111111',
          tokenDigest: 'a'.repeat(64),
        },
        entityManager,
      );

      expect(entityManager.getRepository).toHaveBeenCalledWith(RefreshSession);
      expect(transactionalRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: '11111111-1111-4111-8111-111111111111',
          tokenDigest: 'a'.repeat(64),
          revokedAt: null,
          replacedBySessionId: null,
        }),
      );

      expect(transactionalRepository.save).toHaveBeenCalledWith(unsavedSession);
      expect(repository.create).not.toHaveBeenCalled();
      expect(repository.save).not.toHaveBeenCalled();
    });
  });
});
