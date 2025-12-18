import { CommonEntity } from "../../common/entity/common.entity";
import { Column, Entity, } from "typeorm";

@Entity({name: 'user'})
export class User extends CommonEntity {    
    @Column({type: 'varchar', length: 50, unique: true, nullable: false })
    email: string;

    @Column({type: 'varchar', length: 100, nullable: false })
    password: string;
}