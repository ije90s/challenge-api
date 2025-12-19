import { User } from "../entity/user.entity";

export class ResponseUserDto {
  readonly id: number;
  readonly email: string;

  private constructor(entity: User) {
    this.id = entity.id;
    this.email = entity.email;
  }

  static from(user: User): ResponseUserDto {
    return new ResponseUserDto(user);
  }
}
