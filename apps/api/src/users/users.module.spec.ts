import { getRepositoryToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';

import { User } from './entities/user.entity';
import { UsersModule } from './users.module';

describe('UsersModule', () => {
  it('provides the User repository', async () => {
    const userRepository = {};

    const testingModule = await Test.createTestingModule({
      imports: [UsersModule],
    })
      .overrideProvider(getRepositoryToken(User))
      .useValue(userRepository)
      .compile();

    expect(testingModule.get(getRepositoryToken(User))).toBe(userRepository);

    await testingModule.close();
  });
});
