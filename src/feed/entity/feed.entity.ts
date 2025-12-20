import { Challenge } from "../../challenge/entity/challenge.entity";
import { CommonEntity } from "../../common/entity/common.entity";
import { User } from "../../user/entity/user.entity";
import { Column, DeleteDateColumn, Entity, JoinColumn, ManyToOne } from "typeorm";

@Entity({name: "feed"})
export class Feed extends CommonEntity {

    @Column({type: 'varchar', length: 30, unique: true, nullable: false})
    title: string;

    @Column({type: 'text', nullable: false })
    content: string;

    @Column({type: 'json', nullable: true })
    images?: string[] | null;

    @ManyToOne(() => User, { onDelete: 'SET NULL' })
    @JoinColumn({ name: "user_id" })
    user: User;

    @ManyToOne(() => Challenge, { onDelete: 'SET NULL' })
    @JoinColumn({ name: "challenge_id" })
    challenge: Challenge;

    @DeleteDateColumn({type: 'timestamp', nullable: true, default: null })
    deleted_at?: Date | null;
}