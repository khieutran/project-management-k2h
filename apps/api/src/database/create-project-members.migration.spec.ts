import type { QueryRunner } from 'typeorm';

import { CreateProjectMembers1792108800000 } from './migrations/1792108800000-CreateProjectMembers';

describe('CreateProjectMembers1792108800000 migration', () => {
  function createQueryRunner(): QueryRunner {
    return {
      query: jest.fn().mockResolvedValue(undefined),
    } as unknown as QueryRunner;
  }

  function getStatements(queryRunner: QueryRunner): string[] {
    const query = queryRunner.query as jest.Mock;

    return query.mock.calls.map(([statement]) => statement as string);
  }

  it('creates the membership schema and constraints in dependency order', async () => {
    const queryRunner = createQueryRunner();
    const migration = new CreateProjectMembers1792108800000();

    await migration.up(queryRunner);

    const statements = getStatements(queryRunner);

    expect(statements).toHaveLength(6);
    expect(statements[0]).toBe(
      `CREATE TYPE "public"."project_member_role_enum" AS ENUM('MANAGER', 'MEMBER')`,
    );

    expect(statements[1]).toEqual(
      expect.stringContaining('CREATE TABLE "project_members"'),
    );
    expect(statements[1]).toEqual(
      expect.stringContaining('"project_id" uuid NOT NULL'),
    );
    expect(statements[1]).toEqual(
      expect.stringContaining('"user_id" uuid NOT NULL'),
    );
    expect(statements[1]).toEqual(
      expect.stringContaining(
        '"role" "public"."project_member_role_enum" NOT NULL',
      ),
    );
    expect(statements[1]).toEqual(
      expect.stringContaining(
        '"joined_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()',
      ),
    );
    expect(statements[1]).toEqual(
      expect.stringContaining(
        'CONSTRAINT "UQ_project_members_project_user" UNIQUE ("project_id", "user_id")',
      ),
    );
    expect(statements[1]).toEqual(
      expect.stringContaining(
        'CONSTRAINT "PK_project_members_id" PRIMARY KEY ("id")',
      ),
    );

    expect(statements[2]).toBe(
      'CREATE INDEX "IDX_project_members_project_id" ON "project_members" ("project_id")',
    );
    expect(statements[3]).toBe(
      'CREATE INDEX "IDX_project_members_user_id" ON "project_members" ("user_id")',
    );
    expect(statements[4]).toBe(
      'ALTER TABLE "project_members" ADD CONSTRAINT "FK_project_members_project_id" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    expect(statements[5]).toBe(
      'ALTER TABLE "project_members" ADD CONSTRAINT "FK_project_members_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
  });

  it('drops dependent objects before the membership table and enum', async () => {
    const queryRunner = createQueryRunner();
    const migration = new CreateProjectMembers1792108800000();

    await migration.down(queryRunner);

    expect(getStatements(queryRunner)).toEqual([
      'ALTER TABLE "project_members" DROP CONSTRAINT "FK_project_members_user_id"',
      'ALTER TABLE "project_members" DROP CONSTRAINT "FK_project_members_project_id"',
      'DROP INDEX "public"."IDX_project_members_user_id"',
      'DROP INDEX "public"."IDX_project_members_project_id"',
      'DROP TABLE "project_members"',
      'DROP TYPE "public"."project_member_role_enum"',
    ]);
  });
});
