import { ConfigService } from '@nestjs/config';
import type { EntityManager, Repository } from 'typeorm';
import { IsNull } from 'typeorm';

import type { EnvironmentVariables } from '../config/environment.schema';
import { RefreshSession } from './entities/refresh-session.entity';
import { RefreshSessionsService } from './refresh-sessions.service';

describe('RefreshSessionsService', () => {
  const now = new Date('2026-10-05T00:00:00.000Z');
  const refreshTokenTtlSeconds = 604_800;

  let repository: {
    create: jest.Mock;
    findOne: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
  };

  let refreshSessionsService: RefreshSessionsService;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(now);

    repository = {
      create: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
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

  describe('findByTokenDigestForUpdate', () => {
    it('finds and locks the refresh session using the transaction repository', async () => {
      const session = Object.assign(new RefreshSession(), {
        id: '22222222-2222-4222-8222-222222222222',
        userId: '11111111-1111-4111-8111-111111111111',
        familyId: '33333333-3333-4333-8333-333333333333',
        tokenDigest: 'a'.repeat(64),
        expiresAt: new Date('2026-10-12T00:00:00.000Z'),
        revokedAt: null,
        replacedBySessionId: null,
      });

      const transactionalRepository = {
        findOne: jest.fn().mockResolvedValue(session),
      };

      const entityManager = {
        getRepository: jest.fn().mockReturnValue(transactionalRepository),
      } as unknown as EntityManager;

      const result = await refreshSessionsService.findByTokenDigestForUpdate(
        'a'.repeat(64),
        entityManager,
      );

      expect(entityManager.getRepository).toHaveBeenCalledWith(RefreshSession);
      expect(transactionalRepository.findOne).toHaveBeenCalledWith({
        where: {
          tokenDigest: 'a'.repeat(64),
        },
        lock: {
          mode: 'pessimistic_write',
        },
      });
      expect(result).toBe(session);
      expect(repository.findOne).not.toHaveBeenCalled();
    });
  });

  describe('rotateActiveSession', () => {
    it('revokes the current session and creates its replacement in the same family', async () => {
      //Arrange
      const currentSession = Object.assign(new RefreshSession(), {
        id: '22222222-2222-4222-8222-222222222222',
        userId: '11111111-1111-4111-8111-111111111111',
        familyId: '33333333-3333-4333-8333-333333333333',
        tokenDigest: 'a'.repeat(64),
        expiresAt: new Date('2026-10-12T00:00:00.000Z'),
        revokedAt: null,
        replacedBySessionId: null,
      });

      const newTokenDigest = 'b'.repeat(64);

      const transactionalRepository = {
        create: jest.fn((input) => Object.assign(new RefreshSession(), input)),
        save: jest.fn(),
      };

      transactionalRepository.save.mockImplementationOnce(
        async (session: RefreshSession) =>
          Object.assign(session, {
            id: '44444444-4444-4444-8444-444444444444',
            createdAt: now,
            updatedAt: now,
          }),
      );

      transactionalRepository.save.mockImplementationOnce(
        async (session: RefreshSession) => session,
      );

      const entityManager = {
        getRepository: jest.fn().mockReturnValue(transactionalRepository),
      } as unknown as EntityManager;

      //Act
      const replacement = await refreshSessionsService.rotateActiveSession(
        currentSession,
        newTokenDigest,
        entityManager,
      );

      //Assert
      expect(entityManager.getRepository).toHaveBeenCalledWith(RefreshSession);

      const replacementInput =
        transactionalRepository.create.mock.calls[0]?.[0];

      expect(replacementInput).toMatchObject({
        userId: currentSession.userId,
        familyId: currentSession.familyId,
        tokenDigest: newTokenDigest,
        expiresAt: new Date('2026-10-12T00:00:00.000Z'),
        revokedAt: null,
        replacedBySessionId: null,
      });

      expect(currentSession.revokedAt).toEqual(now);

      expect(currentSession.replacedBySessionId).toBe(
        '44444444-4444-4444-8444-444444444444',
      );

      expect(transactionalRepository.save).toHaveBeenCalledTimes(2);
      expect(transactionalRepository.save).toHaveBeenNthCalledWith(
        1,
        replacement,
      );
      expect(transactionalRepository.save).toHaveBeenNthCalledWith(
        2,
        currentSession,
      );
      expect(replacement.id).toBe('44444444-4444-4444-8444-444444444444');
      expect(repository.create).not.toHaveBeenCalled();
      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('revokeActiveSessionsByFamilyId', () => {
    it('revokes only active sessions in the target family using the transaction repository', async () => {
      //Arrange
      const familyId = '33333333-3333-4333-8333-333333333333';

      const transactionalRepository = {
        update: jest.fn().mockResolvedValue({
          affected: 2,
        }),
      };

      const entityManager = {
        getRepository: jest.fn().mockReturnValue(transactionalRepository),
      } as unknown as EntityManager;

      //Act
      await refreshSessionsService.revokeActiveSessionsByFamilyId(
        familyId,
        entityManager,
      );

      //Assert
      expect(entityManager.getRepository).toHaveBeenCalledWith(RefreshSession);
      expect(transactionalRepository.update).toHaveBeenCalledWith(
        {
          familyId,
          revokedAt: IsNull(),
        },
        {
          revokedAt: now,
        },
      );
      expect(repository.update).not.toHaveBeenCalled();
    });
  });
});
