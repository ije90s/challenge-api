import { CommonEntity } from "../../common/entity/common.entity";
import { Column, Entity, Index } from "typeorm";

@Entity({name: 'user'})
@Index('idx_unique_email', ['email'], { unique: true })
export class User extends CommonEntity {
    @Column({type: 'varchar', length: 50, nullable: false })
    email: string;

    @Column({type: 'varchar', length: 100, nullable: false })
    password: string;
}