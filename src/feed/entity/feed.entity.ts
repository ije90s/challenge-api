import { Challenge } from "../../challenge/entity/challenge.entity";
import { CommonEntity } from "../../common/entity/common.entity";
import { User } from "../../user/entity/user.entity";
import { Column, DeleteDateColumn, Entity, Index, JoinColumn, ManyToOne } from "typeorm";

@Entity({name: "feed"})
@Index('idx_unique_feed_title', ['title'], { unique: true })
export class Feed extends CommonEntity {

    @Column({type: 'varchar', length: 30, nullable: false})
    title: string;

    @Column({type: 'text', nullable: false })
    content: string;

    @Column({type: 'json', nullable: true })
    images?: string[] | null;

    @ManyToOne(() => User, { onDelete: 'SET NULL' })
    @JoinColumn({ name: "user_id" })
    user: User | null;

    @ManyToOne(() => Challenge, { onDelete: 'SET NULL' })
    @JoinColumn({ name: "challenge_id" })
    challenge: Challenge | null;

    @DeleteDateColumn({type: 'timestamp', nullable: true, default: null })
    deleted_at?: Date | null;
}