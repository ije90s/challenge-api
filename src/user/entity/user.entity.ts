import { CommonEntity } from "../../common/entity/common.entity";
import { Column, Entity, } from "typeorm";

@Entity()
export class User extends CommonEntity {    
    @Column()
    email: string;

    @Column()
    password: string;
}