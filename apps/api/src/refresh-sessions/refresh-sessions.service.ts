import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { type EntityManager, Repository } from 'typeorm';

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

  private getRepository(
    entityManager?: EntityManager,
  ): Repository<RefreshSession> {
    return entityManager
      ? entityManager.getRepository(RefreshSession)
      : this.refreshSessionsRepository;
  }
}
