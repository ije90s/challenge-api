import { MigrationInterface, QueryRunner } from "typeorm";

export class AddParticipationUserChallengeUniqueIndex1789528428691 implements MigrationInterface {
    name = 'AddParticipationUserChallengeUniqueIndex1789528428691'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE UNIQUE INDEX \`idx_unique_user_challenge\` ON \`participation\` (\`user_id\`, \`challenge_id\`)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`idx_unique_user_challenge\` ON \`participation\``);
    }

}
