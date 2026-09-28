import { Module } from '@nestjs/common';
import {
  ConfigModule,
  ConfigService,
} from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import type { EnvironmentVariables } from './config/environment.schema';
import { validateEnvironment } from './config/environment.schema';
import { createTypeOrmOptions } from './database/typeorm.config';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['../../.env', '.env'],
      validate: validateEnvironment,
    }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (
        configService: ConfigService<
          EnvironmentVariables,
          true
        >,
      ) => createTypeOrmOptions(configService),
    }),

    HealthModule,
  ],
})
export class AppModule {}