import { CommonEntity } from "../../common/entity/common.entity";
import { User } from "../../user/entity/user.entity";
import { Column, DeleteDateColumn, Entity, ManyToOne } from "typeorm";

@Entity()
export class Challenge extends CommonEntity {
    @Column({default: 0})
    type: number;

    @Column({default: 1})
    mininum_count: number;

    @Column()
    title: string;

    @Column()
    content: string;

    @Column()
    start_date: Date;

    @Column()
    end_date: Date;

    @ManyToOne(type => User, (user) => user.id)
    author: User;

    @DeleteDateColumn()
    deleted_at?: Date;
}