import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProjects1792022400000 implements MigrationInterface {
  name = 'CreateProjects1792022400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."project_status_enum" AS ENUM('PLANNING', 'ACTIVE', 'COMPLETED')`,
    );

    await queryRunner.query(
      `CREATE TABLE "projects" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "key" character varying(10) NOT NULL, "name" character varying(100) NOT NULL, "description" character varying(2000), "owner_id" uuid NOT NULL, "status" "public"."project_status_enum" NOT NULL DEFAULT 'PLANNING', "start_date" date, "end_date" date, "archived_at" TIMESTAMP WITH TIME ZONE, "deleted_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_projects_date_range" CHECK ("end_date" IS NULL OR "start_date" IS NULL OR "end_date" >= "start_date"), CONSTRAINT "UQ_projects_key" UNIQUE ("key"), CONSTRAINT "PK_projects_id" PRIMARY KEY ("id"))`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_projects_owner_visibility_updated" ON "projects" ("owner_id", "deleted_at", "archived_at", "updated_at")`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_projects_status" ON "projects" ("status")`,
    );

    await queryRunner.query(
      `ALTER TABLE "projects" ADD CONSTRAINT "FK_projects_owner_id" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "projects" DROP CONSTRAINT "FK_projects_owner_id"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_projects_status"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_projects_owner_visibility_updated"`,
    );
    await queryRunner.query(`DROP TABLE "projects"`);
    await queryRunner.query(`DROP TYPE "public"."project_status_enum"`);
  }
}
