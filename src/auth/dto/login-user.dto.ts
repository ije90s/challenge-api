import { PickType } from "@nestjs/mapped-types";
import { CreateUserDto } from "src/user/dto/create-user.dto";

export class LoginUserDto extends PickType(CreateUserDto, ['email', 'password'] as const) {}
