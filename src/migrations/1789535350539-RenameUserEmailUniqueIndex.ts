import { MigrationInterface, QueryRunner } from "typeorm";

export class RenameUserEmailUniqueIndex1789535350539 implements MigrationInterface {
    name = 'RenameUserEmailUniqueIndex1789535350539'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`user\` RENAME INDEX \`IDX_e12875dfb3b1d92d7d7c5377e2\` TO \`idx_unique_email\``);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`user\` RENAME INDEX \`idx_unique_email\` TO \`IDX_e12875dfb3b1d92d7d7c5377e2\``);
    }

}
