import type { QueryRunner } from 'typeorm';

import { CreateProjects1792022400000 } from './migrations/1792022400000-CreateProjects';

describe('CreateProjects1792022400000 migration', () => {
  function createQueryRunner(): QueryRunner {
    return {
      query: jest.fn().mockResolvedValue(undefined),
    } as unknown as QueryRunner;
  }

  function getStatements(queryRunner: QueryRunner): string[] {
    const query = queryRunner.query as jest.Mock;

    return query.mock.calls.map(([statement]) => statement as string);
  }

  it('creates the projects schema and constraints in dependency order', async () => {
    const queryRunner = createQueryRunner();
    const migration = new CreateProjects1792022400000();

    await migration.up(queryRunner);

    const statements = getStatements(queryRunner);

    expect(statements).toHaveLength(5);
    expect(statements[0]).toBe(
      `CREATE TYPE "public"."project_status_enum" AS ENUM('PLANNING', 'ACTIVE', 'COMPLETED')`,
    );

    expect(statements[1]).toEqual(expect.stringContaining('CREATE TABLE "projects"'));
    expect(statements[1]).toEqual(
      expect.stringContaining('"key" character varying(10) NOT NULL'),
    );
    expect(statements[1]).toEqual(
      expect.stringContaining('"owner_id" uuid NOT NULL'),
    );
    expect(statements[1]).toEqual(
      expect.stringContaining(
        '"status" "public"."project_status_enum" NOT NULL DEFAULT \'PLANNING\'',
      ),
    );
    expect(statements[1]).toEqual(
      expect.stringContaining(
        'CONSTRAINT "CHK_projects_date_range" CHECK',
      ),
    );
    expect(statements[1]).toEqual(
      expect.stringContaining(
        'CONSTRAINT "UQ_projects_key" UNIQUE ("key")',
      ),
    );

    expect(statements[2]).toBe(
      'CREATE INDEX "IDX_projects_owner_visibility_updated" ON "projects" ("owner_id", "deleted_at", "archived_at", "updated_at")',
    );
    expect(statements[3]).toBe(
      'CREATE INDEX "IDX_projects_status" ON "projects" ("status")',
    );
    expect(statements[4]).toBe(
      'ALTER TABLE "projects" ADD CONSTRAINT "FK_projects_owner_id" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION',
    );
  });

  it('drops dependent objects before the projects table and enum', async () => {
    const queryRunner = createQueryRunner();
    const migration = new CreateProjects1792022400000();

    await migration.down(queryRunner);

    expect(getStatements(queryRunner)).toEqual([
      'ALTER TABLE "projects" DROP CONSTRAINT "FK_projects_owner_id"',
      'DROP INDEX "public"."IDX_projects_status"',
      'DROP INDEX "public"."IDX_projects_owner_visibility_updated"',
      'DROP TABLE "projects"',
      'DROP TYPE "public"."project_status_enum"',
    ]);
  });
});
