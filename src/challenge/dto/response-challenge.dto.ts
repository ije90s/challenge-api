import { Challenge } from "../entity/challenge.entity";

export class ResponseChallengeDto {
  readonly id: number;
  readonly type: number;
  readonly mininum_count: number;
  readonly title: string;
  readonly content: string;
  readonly start_date: Date;
  readonly end_date: Date;
  readonly author_id: number;

  private constructor(entity: Challenge) {
    this.id = entity.id;
    this.type = entity.type;
    this.mininum_count = entity.mininum_count;
    this.title = entity.title;
    this.content = entity.content;
    this.start_date = entity.start_date;
    this.end_date = entity.end_date;
    this.author_id = entity.author.id;
  }

  static from(challenge: Challenge): ResponseChallengeDto {
    return new ResponseChallengeDto(challenge);
  }

  static fromEntity(challenges: Challenge[]): ResponseChallengeDto[]{
    return challenges.map(challenge => this.from(challenge));
  }
}
