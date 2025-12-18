import { User } from "../entity/user.entity";

export class ResponseUserDto {

  id: number;
  email: string;

  static from(entity: User): ResponseUserDto {
    
    return {
      id: entity.id,
      email: entity.email,
    };
  }
}
