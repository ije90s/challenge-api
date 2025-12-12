import { CommonEntity } from "../../common/entity/common.entity";
import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class User extends CommonEntity {
    @PrimaryGeneratedColumn()
    user_id: number;
    
    @Column()
    email: string;

    @Column()
    password: string;
}