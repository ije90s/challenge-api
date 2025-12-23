import { MigrationInterface, QueryRunner } from "typeorm";

export class ModifyChallengeFK1766475886412 implements MigrationInterface {
    name = 'ModifyChallengeFK1766475886412'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`participation\` CHANGE \`challege_id\` \`challenge_id\` int NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`participation\` CHANGE \`challenge_id\` \`challege_id\` int NULL DEFAULT 'NULL'`);
    }

}
