import { z } from 'zod';

const booleanFromEnvironment = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true');

export const environmentSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']),

    API_PORT: z.coerce.number().int().min(1).max(65535),

    SWAGGER_ENABLED: booleanFromEnvironment,

    JWT_ACCESS_SECRET: z.string().min(32),

    JWT_ACCESS_TTL_SECONDS: z.coerce //su dung coerce.number() de chuyen doi tu string sang number
      .number()
      .int()
      .min(60)
      .max(3600),

    REFRESH_TOKEN_PEPPER: z.string().min(32),

    REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().min(3600).max(2_592_000),

    AUTH_COOKIE_SECURE: booleanFromEnvironment,

    AUTH_COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']),

    POSTGRES_HOST: z.string().min(1),

    POSTGRES_PORT: z.coerce.number().int().min(1).max(65535),

    POSTGRES_DB: z.string().min(1),
    POSTGRES_USER: z.string().min(1),
    POSTGRES_PASSWORD: z.string().min(1),
  })
  .superRefine((environment, context) => {
    if (
      environment.AUTH_COOKIE_SAME_SITE == 'none' &&
      !environment.AUTH_COOKIE_SECURE
    ) {
      context.addIssue({
        code: 'custom',
        path: ['AUTH_COOKIE_SAME_SITE'],
        message: 'SameSite=None requires AUTH_COOKIE_SECURE=true',
      });
    }
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

  throw new Error(`Invalid environment variables: ${invalidFields.join(', ')}`);
}
