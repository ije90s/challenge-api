import { PickType } from "@nestjs/mapped-types";
import { CreateFeedDto } from "./create-feed.dto";

export class UpdateFeedDto extends PickType(CreateFeedDto, ['title', 'content', 'images'] as const) {}
