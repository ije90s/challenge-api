import { Feed } from "../entity/feed.entity";

export class ResponseFeedDto {
  readonly id: number;
  readonly title: string;
  readonly content: string;
  readonly images?: string[] | null;
  readonly user_id: number;
  readonly challenge_id: number;

  private constructor(entity: Feed) {
    this.id = entity.id;
    this.title = entity.title;
    this.content = entity.content;
    this.images = entity.images;
    this.user_id = entity.user.id;
    this.challenge_id = entity.challenge.id;
  }

  static from(feed: Feed): ResponseFeedDto {
    return new ResponseFeedDto(feed);
  }
}
