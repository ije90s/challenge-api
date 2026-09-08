import { DataSource, EntityMetadata, EntityTarget, ObjectLiteral, QueryRunner, Repository } from 'typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';
import { TestingModuleBuilder } from '@nestjs/testing';

/**
 * e2e 테스트 격리용 헬퍼.
 *
 * NestJS는 `TypeOrmModule.forFeature()`가 만드는 Repository provider를 앱 부트스트랩 시점에
 * 딱 한 번만 생성해서 싱글턴으로 재사용한다 (Repository 생성자가 manager/queryRunner를 그 순간 값으로
 * 캡처해버림). 그래서 매 테스트마다 "새 트랜잭션 → 롤백"을 하려면, 이미 만들어진 Repository 인스턴스들의
 * manager/queryRunner를 직접 교체(rebind)해야 한다.
 *
 * 사용법: `getDataSourceToken()` provider를 이 클래스의 핸들로 오버라이드해서 앱을 한 번만 빌드하고,
 * 테스트마다 `beginTransaction()`/`rollbackTransaction()`을 호출한다.
 */
export class TransactionalTestDataSource {
  readonly dataSource: DataSource;
  private queryRunner: QueryRunner | null = null;
  private readonly repositories = new Map<EntityTarget<ObjectLiteral>, Repository<ObjectLiteral>>();

  constructor() {
    this.dataSource = new DataSource({
      type: 'mysql',
      host: process.env.DB_HOST!,
      port: parseInt(process.env.DB_PORT!, 10),
      username: process.env.DB_USER!,
      password: process.env.DB_PASS!,
      database: process.env.DB_NAME!,
      entities: [__dirname + '/../../src/**/entity/*.entity.{ts,js}'],
    });
  }

  async initialize(): Promise<void> {
    await this.dataSource.initialize();
  }

  async destroy(): Promise<void> {
    await this.dataSource.destroy();
  }

  /** 새 트랜잭션을 열고, 지금까지 생성된 Repository들을 전부 이 트랜잭션에 rebind한다. */
  async beginTransaction(): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    try {
      await queryRunner.connect();
      await queryRunner.startTransaction();
    } catch (error) {
      // connect/startTransaction 실패 시 커넥션을 풀에 반납하지 않으면 반복 실행할수록 풀이 고갈된다.
      await queryRunner.release();
      throw error;
    }

    this.queryRunner = queryRunner;

    for (const repository of this.repositories.values()) {
      // Repository.manager/queryRunner는 타입 선언상 readonly지만 런타임엔 평범한 프로퍼티라
      // 트랜잭션 전환마다 rebind할 수 있다 (타입 선언과의 불일치를 의도적으로 우회).
      Object.assign(repository, { manager: queryRunner.manager, queryRunner });
      if (repository.manager !== queryRunner.manager) {
        // TypeORM이 내부적으로 manager를 생성 시점에 캡처해버리도록 바뀌면 이 트릭 자체가 조용히 무효화된다 —
        // 그 경우 테스트들이 다시 같은 트랜잭션/커넥션을 공유하게 되므로 조용히 넘어가지 않고 바로 실패시킨다.
        throw new Error('Repository rebind가 반영되지 않았습니다 — TypeORM 내부 구현이 바뀐 것 같습니다.');
      }
    }
  }

  async rollbackTransaction(): Promise<void> {
    const queryRunner = this.queryRunner;
    if (!queryRunner) {
      return;
    }
    this.queryRunner = null;
    try {
      await queryRunner.rollbackTransaction();
    } finally {
      await queryRunner.release();
    }
  }

  private getRepository(entity: EntityTarget<ObjectLiteral>): Repository<ObjectLiteral> {
    if (!this.queryRunner) {
      throw new Error('트랜잭션이 시작되지 않았습니다 — beginTransaction()을 먼저 호출하세요.');
    }

    const cached = this.repositories.get(entity);
    if (cached) {
      return cached;
    }

    const repository = this.queryRunner.manager.getRepository(entity);
    this.repositories.set(entity, repository);
    return repository;
  }

  /**
   * `getDataSourceToken()` provider를 이 인스턴스로 오버라이드한다.
   * `@nestjs/typeorm`의 Repository provider factory가 실제로 호출하는 것과 동일한 표면
   * (`entityMetadatas`, `options`, `getRepository`/`getTreeRepository`/`getMongoRepository`)만 구현한다.
   */
  overrideIn(builder: TestingModuleBuilder): TestingModuleBuilder {
    const self = this;
    const handle = {
      get entityMetadatas(): EntityMetadata[] {
        return self.dataSource.entityMetadatas;
      },
      get options() {
        return self.dataSource.options;
      },
      getRepository: (entity: EntityTarget<ObjectLiteral>) => self.getRepository(entity),
      getTreeRepository: (entity: EntityTarget<ObjectLiteral>) => self.getRepository(entity),
      getMongoRepository: (entity: EntityTarget<ObjectLiteral>) => self.getRepository(entity),
    };

    return builder.overrideProvider(getDataSourceToken()).useFactory({
      factory: () => handle,
    });
  }
}
