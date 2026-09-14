export class ResponseMyRankDto {
  readonly myRank: number;

  private constructor(myRank: number) {
    this.myRank = myRank;
  }

  static of(myRank: number): ResponseMyRankDto {
    return new ResponseMyRankDto(myRank);
  }
}
