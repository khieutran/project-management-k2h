import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

import { UsersModule } from '../users/users.module';
import { RefreshSessionsModule } from '../refresh-sessions/refresh-sessions.module';
import { PasswordService } from './services/password.service';
import { TokenService } from './services/token.service';

@Module({
  imports: [
    ConfigModule,
    JwtModule.register({}),
    UsersModule,
    RefreshSessionsModule,
  ],
  providers: [PasswordService, TokenService],
})
export class AuthModule {}
