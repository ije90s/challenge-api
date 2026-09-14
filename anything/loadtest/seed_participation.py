#!/usr/bin/env python3
"""
랭킹 조회 부하 테스트용 필러 Participation 데이터 생성.
anything/load_test_plan.md §3 참고 — 랭킹 endpoint는 user 관계를 select하지 않으므로
필러 로우는 user_id=NULL로 채워도 무방하다 (실제 호출 유저는 setup_users.sh가 별도 생성).

사용법:
    python3 seed_participation.py <score_challenge_id> <count_challenge_id> [rows_per_challenge] > seed_participation.sql
    docker exec -i mariadb mysql -uroot -p1234 challenge < seed_participation.sql
"""
import random
import sys
from datetime import datetime, timedelta

# NOW(6)을 그대로 쓰면 MySQL/MariaDB는 한 SQL문 안에서 NOW()를 한 번만 평가하므로
# 1000행 배치 전체가 동일한 created_at을 갖게 되어(동점 데이터 대량 생성) 랭킹 동점 처리를
# 실제보다 훨씬 불안정하게 재현한다. 행마다 마이크로초 단위로 다른 값을 직접 생성해서 피한다.
def gen(challenge_id: int, is_score_type: bool, rows: int, base_time: datetime):
    batch = []
    for i in range(rows):
        if is_score_type:
            score, cnt = random.randint(0, 10000), 0
        else:
            score, cnt = 0, random.randint(0, 500)
        ts = (base_time + timedelta(microseconds=i)).strftime("%Y-%m-%d %H:%M:%S.%f")
        batch.append(f"('{ts}', '{ts}', {score}, {cnt}, 0, NULL, {challenge_id})")
        if len(batch) == 1000:
            yield batch
            batch = []
    if batch:
        yield batch

def main():
    if len(sys.argv) < 3:
        print(__doc__, file=sys.stderr)
        sys.exit(1)

    score_challenge_id = int(sys.argv[1])
    count_challenge_id = int(sys.argv[2])
    rows_per_challenge = int(sys.argv[3]) if len(sys.argv) > 3 else 50000

    base_time = datetime.now()

    print("SET autocommit=0;")
    for challenge_id, is_score in [(score_challenge_id, True), (count_challenge_id, False)]:
        for batch in gen(challenge_id, is_score, rows_per_challenge, base_time):
            print("INSERT INTO participation (created_at, updated_at, score, challenge_count, status, user_id, challenge_id) VALUES")
            print(",\n".join(batch) + ";")
    print("COMMIT;")

if __name__ == "__main__":
    main()
