import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

import { UsersModule } from '../users/users.module';
import { RefreshSessionsModule } from '../refresh-sessions/refresh-sessions.module';
import { PasswordService } from './services/password.service';
import { TokenService } from './services/token.service';
import { AuthService } from './auth.service';
import { RefreshTokenCookieService } from './services/refresh-token-cookie.service';
import { AuthController } from './controllers/auth.controller';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [
    ConfigModule,
    JwtModule.register({}),
    UsersModule,
    RefreshSessionsModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    RefreshTokenCookieService,
    TokenService,
    JwtAuthGuard,
    RolesGuard,
  ],
  exports: [JwtAuthGuard, RolesGuard, TokenService],
})
export class AuthModule {}
