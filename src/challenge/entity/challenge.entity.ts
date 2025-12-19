import { CommonEntity } from "../../common/entity/common.entity";
import { User } from "../../user/entity/user.entity";
import { Column, DeleteDateColumn, Entity, JoinColumn, ManyToOne } from "typeorm";

@Entity({name: "challenge"})
export class Challenge extends CommonEntity {
    @Column({type: 'tinyint', default: 0})
    type: number;

    @Column({type: 'tinyint', default: 1})
    mininum_count: number;

    @Column({type: 'varchar', length: 30, unique: true, nullable: false })
    title: string;

    @Column({type: 'text', nullable: false })
    content: string;

    @Column({type: 'timestamp', nullable: false })
    start_date: Date;

    @Column({type: 'timestamp', nullable: false })
    end_date: Date;

    @ManyToOne(() => User, { onDelete: 'SET NULL' })
    @JoinColumn({ name: "user_id" })
    author: User;

    @DeleteDateColumn({type: 'timestamp', nullable: true, default: null })
    deleted_at?: Date | null;
}