import { Type } from "class-transformer";

type PagingMeta = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class ResponsePagingDto<T> {
  
  @Type(() => Object) 
  readonly items: T[];

  readonly meta: PagingMeta;

  private constructor(p: {items: T[]; meta: PagingMeta}) {
    this.items = p.items;
    this.meta = p.meta;
  }
  
  static metaOf (total: number, page: number, limit: number): PagingMeta {
    return { total, page, limit, totalPages: Math.ceil(total / limit) }
  }

  // 엔티티 > DTO로 반환하는 거 아니기 때문에, 
  static of<T>(p: {items: T[]; meta: PagingMeta }): ResponsePagingDto<T> {
    return new ResponsePagingDto(p);
  }
}
