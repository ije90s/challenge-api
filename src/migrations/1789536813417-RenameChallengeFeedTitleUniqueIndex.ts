import { MigrationInterface, QueryRunner } from "typeorm";

export class RenameChallengeFeedTitleUniqueIndex1789536813417 implements MigrationInterface {
    name = 'RenameChallengeFeedTitleUniqueIndex1789536813417'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`challenge\` RENAME INDEX \`IDX_3f3cb1bb6f8b45fa67894badfd\` TO \`idx_unique_challenge_title\``);
        await queryRunner.query(`ALTER TABLE \`feed\` RENAME INDEX \`IDX_7d93e66e624232af470d2f7bb3\` TO \`idx_unique_feed_title\``);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`feed\` RENAME INDEX \`idx_unique_feed_title\` TO \`IDX_7d93e66e624232af470d2f7bb3\``);
        await queryRunner.query(`ALTER TABLE \`challenge\` RENAME INDEX \`idx_unique_challenge_title\` TO \`IDX_3f3cb1bb6f8b45fa67894badfd\``);
    }

}
