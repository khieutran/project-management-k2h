import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDemoExpiry1792195200000 implements MigrationInterface {
  name = 'AddDemoExpiry1792195200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "users" ADD "demo_expires_at" TIMESTAMP WITH TIME ZONE',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_users_demo_expires_at" ON "users" ("demo_expires_at") WHERE "demo_expires_at" IS NOT NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "public"."IDX_users_demo_expires_at"');
    await queryRunner.query(
      'ALTER TABLE "users" DROP COLUMN "demo_expires_at"',
    );
  }
}
