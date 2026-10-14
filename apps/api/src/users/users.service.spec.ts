import type { EntityManager, Repository } from 'typeorm';

import { User } from './entities/user.entity';
import { UserRole } from './enums/user-role.enum';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let repository: {
    findOneBy: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };

  let usersService: UsersService;

  beforeEach(() => {
    repository = {
      findOneBy: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    usersService = new UsersService(repository as unknown as Repository<User>);
  });

  describe('findByEmail', () => {
    it('normalizes the email before querying PostgreSQL', async () => {
      const user = Object.assign(new User(), {
        id: '11111111-1111-4111-8111-111111111111',
        email: 'user@example.com',
        passwordHash: 'argon2-password-hash',
        displayName: 'Nguyen Van A',
        role: UserRole.User,
        createdAt: new Date('2026-10-03T00:00:00.000Z'),
        updatedAt: new Date('2026-10-03T00:00:00.000Z'),
      });

      repository.findOneBy.mockResolvedValue(user);

      await expect(
        usersService.findByEmail('  USER@Example.COM  '),
      ).resolves.toBe(user);

      expect(repository.findOneBy).toHaveBeenCalledWith({
        email: 'user@example.com',
      });
    });

    it('returns null when the normalized email does not exist', async () => {
      repository.findOneBy.mockResolvedValue(null);

      await expect(
        usersService.findByEmail('missing@example.com'),
      ).resolves.toBeNull();
    });
  });

  describe('create', () => {
    it('creates a normalized USER without handing plaintext password', async () => {
      const unsavedUser = Object.assign(new User(), {
        email: 'user@example.com',
        passwordHash: 'argon2-password-hash',
        displayName: 'Nguyen Van A',
        role: UserRole.User,
      });

      const savedUser = Object.assign(unsavedUser, {
        id: '11111111-1111-4111-8111-111111111111',
        createdAt: new Date('2026-10-03T00:00:00.000Z'),
        updatedAt: new Date('2026-10-03T00:00:00.000Z'),
      });

      repository.create.mockReturnValue(unsavedUser);
      repository.save.mockResolvedValue(savedUser);

      const result = await usersService.create({
        email: '  USER@Example.COM  ',
        passwordHash: 'argon2-password-hash',
        displayName: 'Nguyen Van A',
      });

      expect(repository.create).toHaveBeenCalledWith({
        email: 'user@example.com',
        passwordHash: 'argon2-password-hash',
        displayName: 'Nguyen Van A',
        role: UserRole.User,
      });

      expect(repository.save).toHaveBeenCalledWith(unsavedUser);
      expect(result).toBe(savedUser);

      const createInput = repository.create.mock.calls[0]?.[0];

      expect(createInput).not.toHaveProperty('password');
    });

    it('uses the transaction repository when an EntityManager is provided', async () => {
      const transactionalRepository = {
        create: jest.fn(),
        save: jest.fn(),
      };

      const entityManager = {
        getRepository: jest.fn().mockReturnValue(transactionalRepository),
      } as unknown as EntityManager;

      const unsavedUser = Object.assign(new User(), {
        email: 'user@example.com',
        passwordHash: 'argon2-password-hash',
        displayName: 'Nguyen Van A',
        role: UserRole.User,
      });

      transactionalRepository.create.mockReturnValue(unsavedUser);
      transactionalRepository.save.mockResolvedValue(unsavedUser);

      await usersService.create(
        {
          email: 'user@example.com',
          passwordHash: 'argon2-password-hash',
          displayName: 'Nguyen Van A',
        },
        entityManager,
      );

      expect(entityManager.getRepository).toHaveBeenCalledWith(User);
      expect(transactionalRepository.create).toHaveBeenCalled();
      expect(transactionalRepository.create).toHaveBeenCalledWith({
        email: 'user@example.com',
        passwordHash: 'argon2-password-hash',
        displayName: 'Nguyen Van A',
        role: UserRole.User,
      });

      expect(transactionalRepository.save).toHaveBeenCalledWith(unsavedUser);
      expect(repository.create).not.toHaveBeenCalled();
      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('finds the user using the transaction repository', async () => {
      //Arrange
      const user = Object.assign(new User(), {
        id: '11111111-1111-4111-8111-111111111111',
        email: 'user@example.com',
        passwordHash: 'argon2-password-hash',
        displayName: 'Nguyen Van A',
        role: UserRole.User,
      });

      const transactionalRepository = {
        findOneBy: jest.fn().mockResolvedValue(user),
      };

      const entityManager = {
        getRepository: jest.fn().mockReturnValue(transactionalRepository),
      } as unknown as EntityManager;

      //Act
      const result = await usersService.findById(user.id, entityManager);

      //Assert
      expect(entityManager.getRepository).toHaveBeenCalledWith(User);
      expect(transactionalRepository.findOneBy).toHaveBeenCalledWith({
        id: user.id,
      });

      expect(result).toBe(user);
      expect(repository.findOneBy).not.toHaveBeenCalled();
    });
  });
});
