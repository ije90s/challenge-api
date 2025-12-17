import { CommonEntity } from "../../common/entity/common.entity";
import { Column, Entity, } from "typeorm";

@Entity({name: 'user'})
export class User extends CommonEntity {    
    @Column({type: 'varchar', nullable: false })
    email: string;

    @Column({type: 'varchar', nullable: false })
    password: string;
}