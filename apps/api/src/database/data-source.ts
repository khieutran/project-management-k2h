import 'reflect-metadata';

import { ConfigService } from '@nestjs/config';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadEnvFile } from 'node:process';
import { DataSource } from 'typeorm';

import {
  type EnvironmentVariables,
  validateEnvironment,
} from '../config/environment.schema';
import { createDataSourceOptions } from './typeorm.config';

const environmentPaths = [
  join(__dirname, '..', '..', '..', '..', '.env'),
  join(__dirname, '..', '..', '.env'),
];

for (const environmentPath of environmentPaths) {
  if (existsSync(environmentPath)) {
    loadEnvFile(environmentPath);
  }
}

const environment = validateEnvironment(process.env);

const configService = new ConfigService<
  EnvironmentVariables,
  true
>(environment);

const dataSource = new DataSource(
  createDataSourceOptions(configService),
);

export default dataSource;