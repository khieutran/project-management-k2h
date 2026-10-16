import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProjectMembers1792108800000
  implements MigrationInterface
{
  name = 'CreateProjectMembers1792108800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."project_member_role_enum" AS ENUM('MANAGER', 'MEMBER')`,
    );

    await queryRunner.query(
      `CREATE TABLE "project_members" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "project_id" uuid NOT NULL, "user_id" uuid NOT NULL, "role" "public"."project_member_role_enum" NOT NULL, "joined_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_project_members_project_user" UNIQUE ("project_id", "user_id"), CONSTRAINT "PK_project_members_id" PRIMARY KEY ("id"))`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_project_members_project_id" ON "project_members" ("project_id")`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_project_members_user_id" ON "project_members" ("user_id")`,
    );

    await queryRunner.query(
      `ALTER TABLE "project_members" ADD CONSTRAINT "FK_project_members_project_id" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE "project_members" ADD CONSTRAINT "FK_project_members_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "project_members" DROP CONSTRAINT "FK_project_members_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_members" DROP CONSTRAINT "FK_project_members_project_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_project_members_user_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_project_members_project_id"`,
    );
    await queryRunner.query(`DROP TABLE "project_members"`);
    await queryRunner.query(
      `DROP TYPE "public"."project_member_role_enum"`,
    );
  }
}
