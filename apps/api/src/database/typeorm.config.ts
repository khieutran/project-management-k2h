import type { ConfigService } from '@nestjs/config';
import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { join } from 'node:path';
import type { DataSourceOptions } from 'typeorm';

import type { EnvironmentVariables } from '../config/environment.schema';

function createDatabaseOptions(
  configService: ConfigService<EnvironmentVariables, true>,
) {
  return {
    type: 'postgres' as const,

    host: configService.getOrThrow<string>('POSTGRES_HOST'),
    port: configService.getOrThrow<number>('POSTGRES_PORT'),
    database: configService.getOrThrow<string>('POSTGRES_DB'),
    username: configService.getOrThrow<string>('POSTGRES_USER'),
    password: configService.getOrThrow<string>('POSTGRES_PASSWORD'),

    synchronize: false,

    entities: [
      join(__dirname, '..', '**', '*.entity.{ts,js}'),
    ],

    migrations: [
      join(__dirname, 'migrations', '*.{ts,js}'),
    ],
  };
}

export function createTypeOrmOptions(
  configService: ConfigService<EnvironmentVariables, true>,
): TypeOrmModuleOptions {
  return {
    ...createDatabaseOptions(configService),
    autoLoadEntities: true,
  };
}

export function createDataSourceOptions(
  configService: ConfigService<EnvironmentVariables, true>,
): DataSourceOptions {
  return createDatabaseOptions(configService);
}