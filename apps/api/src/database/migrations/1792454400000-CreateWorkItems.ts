import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWorkItems1792454400000 implements MigrationInterface {
  name = 'CreateWorkItems1792454400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "public"."work_item_type_enum" AS ENUM('TASK', 'BUG', 'TEST')`);
    await queryRunner.query(`CREATE TYPE "public"."work_item_status_enum" AS ENUM('TODO', 'IN_PROGRESS', 'REVIEW', 'DONE')`);
    await queryRunner.query(`CREATE TYPE "public"."work_item_priority_enum" AS ENUM('LOW', 'MEDIUM', 'HIGH')`);
    await queryRunner.query(`CREATE TABLE "work_items" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "project_id" uuid NOT NULL,
      "type" "public"."work_item_type_enum" NOT NULL,
      "title" character varying(160) NOT NULL,
      "description" text,
      "status" "public"."work_item_status_enum" NOT NULL DEFAULT 'TODO',
      "priority" "public"."work_item_priority_enum" NOT NULL DEFAULT 'MEDIUM',
      "due_date" date,
      "assignee_id" uuid,
      "labels" text array NOT NULL DEFAULT '{}',
      "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      CONSTRAINT "PK_work_items_id" PRIMARY KEY ("id")
    )`);
    await queryRunner.query(`CREATE INDEX "IDX_work_items_project_created" ON "work_items" ("project_id", "created_at", "id")`);
    await queryRunner.query(`ALTER TABLE "work_items" ADD CONSTRAINT "FK_work_items_project_id" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "work_items" ADD CONSTRAINT "FK_work_items_assignee_id" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "work_items" DROP CONSTRAINT "FK_work_items_assignee_id"`);
    await queryRunner.query(`ALTER TABLE "work_items" DROP CONSTRAINT "FK_work_items_project_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_work_items_project_created"`);
    await queryRunner.query(`DROP TABLE "work_items"`);
    await queryRunner.query(`DROP TYPE "public"."work_item_priority_enum"`);
    await queryRunner.query(`DROP TYPE "public"."work_item_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."work_item_type_enum"`);
  }
}
