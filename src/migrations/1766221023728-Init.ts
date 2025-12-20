import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1766221023728 implements MigrationInterface {
    name = 'Init1766221023728'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`user\` (\`id\` int NOT NULL AUTO_INCREMENT, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`email\` varchar(50) NOT NULL, \`password\` varchar(100) NOT NULL, UNIQUE INDEX \`IDX_e12875dfb3b1d92d7d7c5377e2\` (\`email\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`challenge\` (\`id\` int NOT NULL AUTO_INCREMENT, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`type\` tinyint NOT NULL DEFAULT '0', \`mininum_count\` tinyint NOT NULL DEFAULT '1', \`title\` varchar(30) NOT NULL, \`content\` text NOT NULL, \`start_date\` timestamp NOT NULL, \`end_date\` timestamp NOT NULL, \`deleted_at\` timestamp(6) NULL, \`user_id\` int NULL, UNIQUE INDEX \`IDX_3f3cb1bb6f8b45fa67894badfd\` (\`title\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`participation\` (\`id\` int NOT NULL AUTO_INCREMENT, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`score\` int NOT NULL DEFAULT '0', \`challenge_count\` int NOT NULL DEFAULT '0', \`status\` tinyint NOT NULL DEFAULT '0', \`complete_date\` timestamp NULL, \`deleted_at\` timestamp(6) NULL, \`user_id\` int NULL, \`challege_id\` int NULL, INDEX \`idx_challenge_count_rank\` (\`challege_id\`, \`challenge_count\`, \`created_at\`), INDEX \`idx_challenge_score_rank\` (\`challege_id\`, \`score\`, \`created_at\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`feed\` (\`id\` int NOT NULL AUTO_INCREMENT, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`title\` varchar(30) NOT NULL, \`content\` text NOT NULL, \`images\` json NULL, \`deleted_at\` timestamp(6) NULL, \`user_id\` int NULL, \`challenge_id\` int NULL, UNIQUE INDEX \`IDX_7d93e66e624232af470d2f7bb3\` (\`title\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`challenge\` ADD CONSTRAINT \`FK_cf94dcb2ebe61a81283ecde0f51\` FOREIGN KEY (\`user_id\`) REFERENCES \`user\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`participation\` ADD CONSTRAINT \`FK_85ea245ff2001cf6ce914137fcf\` FOREIGN KEY (\`user_id\`) REFERENCES \`user\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`participation\` ADD CONSTRAINT \`FK_a117ab174e4f2a3be0b2ec419b2\` FOREIGN KEY (\`challege_id\`) REFERENCES \`challenge\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`feed\` ADD CONSTRAINT \`FK_e281738b065ef04b66c4f43d0ae\` FOREIGN KEY (\`user_id\`) REFERENCES \`user\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`feed\` ADD CONSTRAINT \`FK_a03ee99e5bc2cc333dddaecc4ca\` FOREIGN KEY (\`challenge_id\`) REFERENCES \`challenge\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`feed\` DROP FOREIGN KEY \`FK_a03ee99e5bc2cc333dddaecc4ca\``);
        await queryRunner.query(`ALTER TABLE \`feed\` DROP FOREIGN KEY \`FK_e281738b065ef04b66c4f43d0ae\``);
        await queryRunner.query(`ALTER TABLE \`participation\` DROP FOREIGN KEY \`FK_a117ab174e4f2a3be0b2ec419b2\``);
        await queryRunner.query(`ALTER TABLE \`participation\` DROP FOREIGN KEY \`FK_85ea245ff2001cf6ce914137fcf\``);
        await queryRunner.query(`ALTER TABLE \`challenge\` DROP FOREIGN KEY \`FK_cf94dcb2ebe61a81283ecde0f51\``);
        await queryRunner.query(`DROP INDEX \`IDX_7d93e66e624232af470d2f7bb3\` ON \`feed\``);
        await queryRunner.query(`DROP TABLE \`feed\``);
        await queryRunner.query(`DROP INDEX \`idx_challenge_score_rank\` ON \`participation\``);
        await queryRunner.query(`DROP INDEX \`idx_challenge_count_rank\` ON \`participation\``);
        await queryRunner.query(`DROP TABLE \`participation\``);
        await queryRunner.query(`DROP INDEX \`IDX_3f3cb1bb6f8b45fa67894badfd\` ON \`challenge\``);
        await queryRunner.query(`DROP TABLE \`challenge\``);
        await queryRunner.query(`DROP INDEX \`IDX_e12875dfb3b1d92d7d7c5377e2\` ON \`user\``);
        await queryRunner.query(`DROP TABLE \`user\``);
    }

}
