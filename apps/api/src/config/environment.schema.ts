import { z } from 'zod';

const booleanFromEnvironment = z
    .enum(['true', 'false'])
    .transform((value) => value === 'true');

export const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),

  API_PORT: z.coerce
    .number()
    .int()
    .min(1)
    .max(65535),

  SWAGGER_ENABLED: booleanFromEnvironment,

  POSTGRES_HOST: z.string().min(1),

  POSTGRES_PORT: z.coerce
    .number()
    .int()
    .min(1)
    .max(65535),

  POSTGRES_DB: z.string().min(1),
  POSTGRES_USER: z.string().min(1),
  POSTGRES_PASSWORD: z.string().min(1),
});

export type EnvironmentVariables = z.infer<typeof environmentSchema>;

export function validateEnvironment(
  input: Record<string, unknown>,
): EnvironmentVariables {
  const result = environmentSchema.safeParse(input);

  if (result.success) {
    return result.data;
  }

  const invalidFields = [
    ...new Set(
      result.error.issues
        .map((issue) => issue.path.join('.'))
        .filter((path) => path.length > 0),
    ),
  ];

  throw new Error(
    `Invalid environment variables: ${invalidFields.join(', ')}`,
  );
}