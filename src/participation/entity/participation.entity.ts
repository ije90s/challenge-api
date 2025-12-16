import { User } from "../../user/entity/user.entity";
import { CommonEntity } from "../../common/entity/common.entity";
import { Column, DeleteDateColumn, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { Challenge } from "../../challenge/entity/challenge.entity";

@Entity()
@Index('idx_challenge_score_rank', ['challenge', 'score', 'created_at'])
@Index('idx_challenge_count_rank', ['challenge', 'challenge_count', 'created_at'])
export class Participation extends CommonEntity{

    @Column({default: 0})
    score: number;

    @Column({default: 0})
    challenge_count: number;

    @Column({default: 0})
    status: number;

    @Column({default: null})
    complete_date?: Date;

    @ManyToOne(() => User, { nullable: false })
    @JoinColumn({ name: 'user_id' })
    user: User;

    @ManyToOne(() => Challenge, { nullable: false })
    @JoinColumn({ name: "challege_id" })
    challenge: Challenge;

    @DeleteDateColumn()
    deleted_at?: Date;
}
