import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

const PASSWORD_HASH_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65_536,
  timeCost: 3,
  parallelism: 4,
} satisfies argon2.HashOptions;

@Injectable()
export class PasswordService {
  hash(password: string): Promise<string> {
    return argon2.hash(password, PASSWORD_HASH_OPTIONS);
  }
  async verify(
    passwordHash: string,
    candidatePassword: string,
  ): Promise<boolean> {
    try {
      return await argon2.verify(passwordHash, candidatePassword);
    } catch {
      return false;
    }
  }
}
