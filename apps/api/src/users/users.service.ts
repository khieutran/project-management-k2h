import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type EntityManager, Repository } from 'typeorm';

import { User } from './entities/user.entity';
import { UserRole } from './enums/user-role.enum';
import type { CreateUserInput } from './types/create-user-input.type';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  findByEmail(
    email: string,
    entityManager?: EntityManager,
  ): Promise<User | null> {
    const normalizedEmail = email.trim().toLowerCase();
    const repository = this.getRepository(entityManager);

    return repository.findOneBy({
      email: normalizedEmail,
    });
  }

  async create(
    input: CreateUserInput,
    entityManager?: EntityManager,
  ): Promise<User> {
    const repository = this.getRepository(entityManager);

    const user = repository.create({
      email: input.email.trim().toLowerCase(),
      passwordHash: input.passwordHash,
      displayName: input.displayName,
      role: UserRole.User,
    });

    return repository.save(user);
  }

  private getRepository(entityManager?: EntityManager): Repository<User> {
    return entityManager
      ? entityManager.getRepository(User)
      : this.usersRepository;
  }
}
