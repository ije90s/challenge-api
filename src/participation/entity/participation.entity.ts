import { User } from "../../user/entity/user.entity";
import { CommonEntity } from "../../common/entity/common.entity";
import { Column, DeleteDateColumn, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { Challenge } from "../../challenge/entity/challenge.entity";

@Entity({ name: "participation" })
@Index('idx_challenge_score_rank', ['challenge', 'score', 'created_at'])
@Index('idx_challenge_count_rank', ['challenge', 'challenge_count', 'created_at'])
export class Participation extends CommonEntity{

    @Column({type: 'int', nullable: false, default: 0})
    score: number;

    @Column({type: 'int', nullable: false, default: 0})
    challenge_count: number;

    @Column({type: 'tinyint', nullable: false, default: 0})
    status: number;

    @Column({type: 'timestamp', nullable: true, default: null })
    complete_date?: Date | null;

    @ManyToOne(() => User, { onDelete: 'SET NULL' })
    @JoinColumn({ name: 'user_id' })
    user: User;

    @ManyToOne(() => Challenge, { onDelete: 'SET NULL' })
    @JoinColumn({ name: "challenge_id" })
    challenge: Challenge;

    @DeleteDateColumn({ type: "timestamp", nullable: true, default: null })
    deleted_at?: Date | null;
}
