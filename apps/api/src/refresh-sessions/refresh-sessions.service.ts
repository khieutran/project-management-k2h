import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { IsNull, type EntityManager, Repository } from 'typeorm';

import type { EnvironmentVariables } from '../config/environment.schema';
import { RefreshSession } from './entities/refresh-session.entity';
import type { CreateInitialRefreshSessionInput } from './types/create-initial-refresh-session-input.type';

const MILLISECONDS_PER_SECOND = 1000;

@Injectable()
export class RefreshSessionsService {
  private readonly refreshTokenTtlSeconds: number;

  constructor(
    @InjectRepository(RefreshSession)
    private readonly refreshSessionsRepository: Repository<RefreshSession>,
    configService: ConfigService<EnvironmentVariables, true>,
  ) {
    this.refreshTokenTtlSeconds = configService.getOrThrow<number>(
      'REFRESH_TOKEN_TTL_SECONDS',
    );
  }

  async createInitialSession(
    input: CreateInitialRefreshSessionInput,
    entityManager?: EntityManager,
  ): Promise<RefreshSession> {
    const repository = this.getRepository(entityManager);

    const session = repository.create({
      userId: input.userId,
      familyId: randomUUID(),
      tokenDigest: input.tokenDigest,
      expiresAt: new Date(
        Date.now() + this.refreshTokenTtlSeconds * MILLISECONDS_PER_SECOND,
      ),
      revokedAt: null,
      replacedBySessionId: null,
    });

    return repository.save(session);
  }

  async rotateActiveSession(
    currentSession: RefreshSession,
    newTokenDigest: string,
    entityManager: EntityManager,
  ): Promise<RefreshSession> {
    const repository = this.getRepository(entityManager);

    const replacement = repository.create({
      userId: currentSession.userId,
      familyId: currentSession.familyId,
      tokenDigest: newTokenDigest,
      expiresAt: new Date(
        Date.now() + this.refreshTokenTtlSeconds * MILLISECONDS_PER_SECOND,
      ),
      revokedAt: null,
      replacedBySessionId: null,
    });

    const savedReplacement = await repository.save(replacement);

    currentSession.revokedAt = new Date();
    currentSession.replacedBySessionId = savedReplacement.id;

    await repository.save(currentSession);

    return savedReplacement;
  }

  findByTokenDigestForUpdate(
    tokenDigest: string,
    entityManager: EntityManager,
  ): Promise<RefreshSession | null> {
    const repository = this.getRepository(entityManager);

    return repository.findOne({
      where: {
        tokenDigest,
      },
      lock: {
        mode: 'pessimistic_write',
      },
    });
  }

  async revokeActiveSessionsByFamilyId(
    familyId: string,
    entityManager: EntityManager,
  ): Promise<void> {
    const repository = this.getRepository(entityManager);

    await repository.update(
      {
        familyId,
        revokedAt: IsNull(),
      },
      {
        revokedAt: new Date(),
      },
    );
  }

  async revokeActiveSessionByTokenDigest(tokenDigest: string): Promise<void> {
    await this.refreshSessionsRepository.update(
      {
        tokenDigest,
        revokedAt: IsNull(),
      },
      {
        revokedAt: new Date(),
      },
    );
  }

  private getRepository(
    entityManager?: EntityManager,
  ): Repository<RefreshSession> {
    return entityManager
      ? entityManager.getRepository(RefreshSession)
      : this.refreshSessionsRepository;
  }
}
