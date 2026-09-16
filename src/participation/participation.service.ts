import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UpdateParticipationDto } from './dto/update-participation.dto';
import { ChallengeService } from '../challenge/challenge.service';
import { checkThePast } from '../common/util';
import { InjectRepository } from '@nestjs/typeorm';
import { Participation } from './entity/participation.entity';
import { QueryFailedError, Repository } from 'typeorm';
import { ResponseParticipationDto } from './dto/response-participation.dto';
import { ResponsePagingDto } from '../common/dto/response-paging.dto';

// 랭킹 조회는 상위 이 순위까지만 노출한다 — offset 페이지네이션의 스캔 비용이
// 순위가 깊어질수록 커지는 문제를 실측으로 확인(anything/load_test_plan.md §9)한 데 따른 결정.
const RANK_VISIBLE_LIMIT = 100;

const ALREADY_PARTICIPATING_MESSAGE = "이미 참가중입니다.";
const UNIQUE_USER_CHALLENGE_INDEX = 'idx_unique_user_challenge';

interface MysqlDriverError {
    code?: string;
    sqlMessage?: string;
}

@Injectable()
export class ParticipationService {

    constructor(
        private readonly challegneService: ChallengeService,
        @InjectRepository(Participation) private participationRepository: Repository<Participation>
    ){}

    async findOne(challengeId: number, userId: number): Promise<Participation | null>{
        return await this.participationRepository.findOne({
            where: {
                challenge: { id: challengeId },
                user: { id: userId },
            },
            relations: ['challenge', 'user'],
        });
    }

    async create(userId: number, challengeId: number): Promise<ResponseParticipationDto>{

        const challenge = await this.challegneService.findOne(challengeId);
        if(!challenge){
            throw new NotFoundException("챌린지가 존재하지 않습니다.");
        }

        if(!checkThePast(challenge.end_date)){
            throw new ConflictException("기간이 지났습니다.");
        }

        const participation = await this.findOne(challengeId, userId);
        if(participation){
            throw new ConflictException(ALREADY_PARTICIPATING_MESSAGE);
        }

        const newParticipation = this.participationRepository.create({
            challenge: { id: challengeId },
            user: { id: userId },
        });

        try {
            const savedParticipation = await this.participationRepository.save(newParticipation);
            return ResponseParticipationDto.from(savedParticipation);
        } catch (error) {
            // 위 findOne 사전 체크와 실제 insert 사이의 레이스로 동시 요청이 모두
            // 통과했을 경우, DB 유니크 인덱스(idx_unique_user_challenge)가 최종 방어선이 된다.
            // sqlMessage로 위반된 인덱스까지 확인해, 이 테이블에 다른 유니크 제약이 추가되더라도
            // 무관한 위반을 "이미 참가중입니다"로 잘못 뭉개지 않게 한다.
            const driverError = error instanceof QueryFailedError
                ? (error.driverError as MysqlDriverError)
                : undefined;
            if (driverError?.code === 'ER_DUP_ENTRY' && driverError.sqlMessage?.includes(UNIQUE_USER_CHALLENGE_INDEX)) {
                throw new ConflictException(ALREADY_PARTICIPATING_MESSAGE);
            }
            throw error;
        }
    }

    async update(userId: number, challengeId: number, dto: UpdateParticipationDto): Promise<ResponseParticipationDto>{

        const challenge = await this.challegneService.findOne(challengeId);
        if(!challenge){
            throw new NotFoundException("챌린지가 존재하지 않습니다.");
        }

        if(!checkThePast(challenge.end_date)){
            throw new ConflictException("기간이 지났습니다.");
        }

        const participation = await this.findOne(challengeId, userId);
        if(!participation){
            throw new ForbiddenException("참가하지 않았습니다.");
        }
        
        if(participation.status === 2){
            throw new ConflictException("챌린지 포기 상태입니다.");
        }

        const score = dto.score ?? 0;
        const count = dto.challenge_count ?? 0;

        // score/challenge_count는 SQL 원자 연산(UPDATE ... SET col = col + ?)으로 증분한다.
        // "읽어서 메모리에서 더한 뒤 save()로 통째로 덮어쓰는" 기존 방식은 동시 요청 시
        // lost update가 발생함을 부하 테스트로 실측 확인함(anything/load_test_plan.md §12).
        if (score !== 0) {
            await this.participationRepository.increment({ id: participation.id }, 'score', score);
        }
        if (count !== 0) {
            await this.participationRepository.increment({ id: participation.id }, 'challenge_count', count);
        }

        const updated = (score !== 0 || count !== 0)
            ? await this.participationRepository.findOneByOrFail({ id: participation.id })
            : participation;

        const total = challenge.type === 0 ? updated.score : updated.challenge_count;
        if (updated.status !== 1 && challenge.mininum_count <= total) {
            updated.status = 1;
            updated.complete_date = new Date();
            // status/complete_date만 갱신 — score/challenge_count 컬럼은 건드리지 않아
            // 이 사이 다른 요청이 넣은 원자적 증분을 덮어쓰지 않는다.
            await this.participationRepository.update(updated.id, {
                status: updated.status,
                complete_date: updated.complete_date,
            });
        }

        return ResponseParticipationDto.from(updated);
    }

    async updateStatus(userId: number, challengeId: number): Promise<ResponseParticipationDto>{
        
        const participation = await this.findOne(challengeId, userId);
        if(!participation){
            throw new ForbiddenException("참가하지 않았습니다.");
        }

        if(participation.status === 1){
            throw new ConflictException("이미 챌린지 완료했습니다.");
        }

        const status = participation.status === 2 ? 0 : 2;
        // status만 갱신 — save()로 엔티티 전체를 덮어쓰면 이 사이 update()의 원자적
        // increment()가 만든 score/challenge_count 변경을 스테일 값으로 되돌릴 수 있다.
        await this.participationRepository.update(participation.id, { status });
        participation.status = status;

        return ResponseParticipationDto.from(participation);
    }

    async getChallengeRank(challengeId: number, userId: number, page: number, limit: number): Promise<ResponsePagingDto<ResponseParticipationDto>>{

        const challenge = await this.challegneService.findOne(challengeId);
        if(!challenge){
            throw new NotFoundException("챌린지가 존재하지 않습니다.");
        }

        const participation = await this.findOne(challengeId, userId);
        if(!participation){
            throw new ForbiddenException("참가하지 않았습니다.");
        }

        // 타입에 따라 정렬
        const orderField = challenge.type === 0 ? 'p.score' : 'p.challenge_count';
        const offset = (page - 1) * limit;

        let items: Participation[] = [];
        let total: number;

        if (offset >= RANK_VISIBLE_LIMIT) {
            // 상위 노출 범위를 벗어난 페이지 — offset 스캔 자체를 하지 않고 빈 배열 반환
            total = await this.participationRepository
                .createQueryBuilder('p')
                .where('p.challenge_id = :challengeId', { challengeId })
                .getCount();
        } else {
            const [foundItems, count] = await this.participationRepository
                .createQueryBuilder('p')
                .where('p.challenge_id = :challengeId', { challengeId })
                .orderBy(orderField, 'DESC')
                .addOrderBy('p.created_at', 'DESC')
                .skip(offset)
                .take(Math.min(limit, RANK_VISIBLE_LIMIT - offset))
                .getManyAndCount();

            items = foundItems;
            total = count;
        }

        const newItems = ResponseParticipationDto.fromEntity(items);
        const meta = ResponsePagingDto.metaOf(Math.min(total, RANK_VISIBLE_LIMIT), page, limit);

        return ResponsePagingDto.of<ResponseParticipationDto>({ items: newItems, meta });
    }

    async getMyRank(challengeId: number, userId: number): Promise<number> {
        const [challenge, participation] = await Promise.all([
            this.challegneService.findOne(challengeId),
            this.findOne(challengeId, userId),
        ]);

        if(!challenge){
            throw new NotFoundException("챌린지가 존재하지 않습니다.");
        }

        if(!participation){
            throw new ForbiddenException("참가하지 않았습니다.");
        }

        const orderField = challenge.type === 0 ? 'score' : 'challenge_count';
        const myValue = challenge.type === 0 ? participation.score : participation.challenge_count;

        const higherRankedCount = await this.participationRepository
            .createQueryBuilder('p')
            .where('p.challenge_id = :challengeId', { challengeId })
            .andWhere('p.id != :myId', { myId: participation.id })
            .andWhere(
                // created_at은 DB에 마이크로초 정밀도로 저장되지만 Entity(@CreateDateColumn)에는
                // 정밀도가 지정돼 있지 않아 JS Date 왕복 시 잘려나갈 수 있다 — 동점자 비교에는 써도
                // 되지만, 자기 자신을 구분하는 데는 위 p.id 조건에 맡기고 이 조건과는 독립시킨다.
                `((p.${orderField} > :myValue) OR (p.${orderField} = :myValue AND p.created_at > :myCreatedAt))`,
                { myValue, myCreatedAt: participation.created_at },
            )
            .getCount();

        return higherRankedCount + 1;
    }

    async getMyChallenge(userId: number, page: number, limit: number): Promise<ResponsePagingDto<ResponseParticipationDto>>{
        const [items, total] = await this.participationRepository.findAndCount({
            where: { user: { id: userId }, },
            skip: (page-1)*limit,
            take: limit,
            order: { created_at: 'DESC' },
        });

        const newItems = ResponseParticipationDto.fromEntity(items);
        const meta = ResponsePagingDto.metaOf(total, page, limit);
                
        return ResponsePagingDto.of<ResponseParticipationDto>({ items: newItems, meta });
    }
}
