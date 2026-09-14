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

def gen(challenge_id: int, is_score_type: bool, rows: int):
    batch = []
    for _ in range(rows):
        if is_score_type:
            score, cnt = random.randint(0, 10000), 0
        else:
            score, cnt = 0, random.randint(0, 500)
        batch.append(f"(NOW(6), NOW(6), {score}, {cnt}, 0, NULL, {challenge_id})")
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

    print("SET autocommit=0;")
    for challenge_id, is_score in [(score_challenge_id, True), (count_challenge_id, False)]:
        for batch in gen(challenge_id, is_score, rows_per_challenge):
            print("INSERT INTO participation (created_at, updated_at, score, challenge_count, status, user_id, challenge_id) VALUES")
            print(",\n".join(batch) + ";")
    print("COMMIT;")

if __name__ == "__main__":
    main()
