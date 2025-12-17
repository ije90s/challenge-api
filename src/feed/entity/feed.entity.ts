import { Challenge } from "../../challenge/entity/challenge.entity";
import { CommonEntity } from "../../common/entity/common.entity";
import { User } from "../../user/entity/user.entity";
import { Column, DeleteDateColumn, Entity, JoinColumn, ManyToOne } from "typeorm";

@Entity({name: "feed"})
export class Feed extends CommonEntity {

    @Column({type: 'varchar', unique: true, nullable: false})
    title: string;

    @Column({type: 'text', nullable: false })
    context: string;

    @Column({type: 'array', nullable: true })
    images?: string[] | null;

    @ManyToOne(() => User, {nullable: false})
    @JoinColumn({ name: "user_id" })
    user: User;

    @ManyToOne(() => Challenge, { nullable: false })
    @JoinColumn({ name: "challenge_id" })
    challenge: Challenge;

    @DeleteDateColumn({type: 'timestamp', nullable: true, default: null })
    deleted_at?: Date | null;
}