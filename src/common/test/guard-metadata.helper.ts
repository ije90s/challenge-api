import { GUARDS_METADATA } from '@nestjs/common/constants';

export function getGuards(target: object): Function[] {
  return Reflect.getMetadata(GUARDS_METADATA, target) ?? [];
}
