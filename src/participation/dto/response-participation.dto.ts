import { Participation } from "../entity/participation.entity";


export class ResponseParticipationDto {
  readonly id: number;
  readonly score: number;
  readonly challenge_count: number;
  readonly status: number;
  readonly complete_date?: Date | null;


  private constructor(entity: Participation) {
    this.id = entity.id;
    this.score = entity.score;
    this.challenge_count = entity.challenge_count;
    this.status = entity.status;
    this.complete_date = entity.complete_date;
  }

  static from(participation: Participation): ResponseParticipationDto {
    return new ResponseParticipationDto(participation);
  }
}
