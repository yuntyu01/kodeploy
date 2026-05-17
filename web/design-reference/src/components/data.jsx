var MOCK_LOGS_VISITOR = [
  { d: "2026.04.25", t: "23:58:11", lvl: "INFO",  msg: "데모 환경에서 generated-app 컨테이너를 시작합니다" },
  { d: "2026.04.25", t: "23:58:12", lvl: "INFO",  msg: "server listening on :8080" },
  { d: "2026.04.25", t: "23:58:13", lvl: "INFO",  msg: "Hibernate: select * from sample_user limit ?" },
  { d: "2026.04.26", t: "00:00:01", lvl: "INFO",  msg: "GET / 200 4ms — visited from demo session" },
  { d: "2026.04.26", t: "00:00:12", lvl: "DEBUG", msg: "GET /healthz 200 1ms" },
  { d: "2026.04.26", t: "00:00:18", lvl: "INFO",  msg: "POST /api/items 201 18ms" },
  { d: "2026.04.26", t: "00:00:24", lvl: "DEBUG", msg: "scheduler tick — no jobs" },
  { d: "2026.04.26", t: "00:00:35", lvl: "INFO",  msg: "GET /api/items 200 7ms" },
  { d: "2026.04.26", t: "00:00:41", lvl: "WARN",  msg: "데모 데이터는 10분마다 초기화됩니다" },
];

var MOCK_LOGS_USER = [
  { d: "2026.04.25", t: "23:59:42", lvl: "INFO",  msg: "server listening on :8080" },
  { d: "2026.04.25", t: "23:59:43", lvl: "INFO",  msg: "connected to postgres (15.3) — pool size=10" },
  { d: "2026.04.25", t: "23:59:43", lvl: "INFO",  msg: "Flyway: migrations up to date (V18__add_billing.sql)" },
  { d: "2026.04.25", t: "23:59:44", lvl: "INFO",  msg: "Started MyappApplication in 2.184 seconds (JVM running for 2.41)" },
  { d: "2026.04.26", t: "00:00:01", lvl: "DEBUG", msg: "GET /healthz 200 1ms" },
  { d: "2026.04.26", t: "00:00:02", lvl: "INFO",  msg: "GET /api/orders?status=open 200 14ms" },
  { d: "2026.04.26", t: "00:00:04", lvl: "INFO",  msg: "POST /api/orders 201 38ms — order_id=ord_8f2a" },
  { d: "2026.04.26", t: "00:00:07", lvl: "DEBUG", msg: "Hibernate: select o.* from orders o where o.tenant_id=?" },
  { d: "2026.04.26", t: "00:00:12", lvl: "WARN",  msg: "rate limit approaching for tenant=acme (84/100 rpm)" },
  { d: "2026.04.26", t: "00:00:18", lvl: "INFO",  msg: "GET /api/orders/ord_8f2a 200 6ms" },
  { d: "2026.04.26", t: "00:00:24", lvl: "INFO",  msg: "kafka-producer: published event order.created (offset=18241)" },
];

var KOREAN_ERRORS_VISITOR = [
  {
    when: "08:14:31",
    severity: "warn",
    title: "데모 데이터 초기화 안내",
    summary: "데모 환경의 데이터는 10분마다 자동으로 초기화돼요.",
    detail: "운영 환경에서는 PostgreSQL 볼륨이 영구적으로 유지됩니다. 로그인 후 본인 서비스에서 시도해보세요.",
    related: "WARN  scheduler.demo.reset → next reset in 04:21",
  },
];

var KOREAN_ERRORS_USER = [
  {
    when: "08:14:12",
    severity: "warn",
    title: "tenant=acme 의 요청량이 한도에 가까워요",
    summary: "분당 100건 중 84건이 사용됐어요. 5분 안에 한도를 넘을 가능성이 있어요.",
    detail: "RateLimitInterceptor 가 84/100 rpm 을 기록했어요. 일시적인 트래픽이라면 그대로 두셔도 되고, 지속된다면 limit 을 200 rpm 으로 올려보세요.",
    related: "WARN  c.k.security.RateLimitInterceptor — bucket=acme remaining=16/100",
    action: "한도 늘리기 (200 rpm)",
  },
  {
    when: "08:09:54",
    severity: "info",
    title: "Flyway 마이그레이션이 완료됐어요",
    summary: "V18__add_billing.sql 이 정상적으로 적용됐어요.",
    detail: "billing_invoice 테이블이 생성됐고, orders 에 invoice_id 컬럼이 추가됐어요.",
    related: "INFO  o.f.core.internal.command.DbMigrate — Successfully applied 1 migration",
  },
  {
    when: "07:42:18",
    severity: "error",
    title: "결제 콜백 처리 중 NullPointerException 이 발생했어요",
    summary: "PaymentService.handleCallback 에서 order.getCustomer() 가 null 인 상태로 호출됐어요.",
    detail: "주문 ord_7c1e 는 게스트 주문(customer_id=null)인데, 콜백 핸들러가 customer 를 항상 존재한다고 가정하고 있어요.",
    related: "ERROR c.k.payment.PaymentService — NullPointerException at PaymentService.java:184",
    action: "PR 자동 생성하기",
  },
];

var WAS_POOL = [
  { lvl: "INFO",  msg: "GET /api/orders 200 9ms" },
  { lvl: "INFO",  msg: "POST /api/orders 201 41ms — order_id=ord_" },
  { lvl: "DEBUG", msg: "GET /healthz 200 1ms" },
  { lvl: "INFO",  msg: "kafka-producer: published event order.updated" },
  { lvl: "DEBUG", msg: "Hibernate: update orders set status=? where id=?" },
  { lvl: "INFO",  msg: "GET /api/items 200 6ms" },
  { lvl: "WARN",  msg: "slow query 312ms: select * from invoice where ..." },
];
var DB_POOL = [
  { lvl: "LOG",   msg: "connection received: host=10.0.4.18 port=53412" },
  { lvl: "LOG",   msg: "statement: SELECT o.* FROM orders o WHERE o.tenant_id = $1" },
  { lvl: "LOG",   msg: "duration: 4.218 ms  bind: COMMIT" },
  { lvl: "LOG",   msg: "checkpoint starting: time" },
  { lvl: "LOG",   msg: "checkpoint complete: wrote 12 buffers (0.1%)" },
  { lvl: "WARN",  msg: "could not receive data from client: Connection reset" },
  { lvl: "LOG",   msg: "autovacuum: processing database \"app\"" },
];
var DB_BASE = [
  { d: "2026.04.25", t: "23:59:42", lvl: "LOG", msg: "database system is ready to accept connections" },
  { d: "2026.04.25", t: "23:59:43", lvl: "LOG", msg: "connection authorized: user=app database=app" },
  { d: "2026.04.25", t: "23:59:44", lvl: "LOG", msg: "statement: SET application_name = 'myapp-7d8c'" },
  { d: "2026.04.26", t: "00:00:01", lvl: "LOG", msg: "duration: 1.842 ms  statement: SELECT 1" },
];

var MOCK_COMMITS = [
  { hash: "a3f8c21", msg: "fix: 결제 콜백 NPE 수정 (guest order 처리)", author: "alice", time: "12분 전", files: 3, summary: "게스트 주문에서 customer가 null일 때 발생하던 NPE를 안전하게 처리하도록 수정했어요." },
  { hash: "e7b1d04", msg: "feat: 주문 상세 API 응답에 invoice 필드 추가", author: "alice", time: "48분 전", files: 5, summary: "주문 조회 시 청구서 정보를 함께 반환하도록 API 응답 스키마를 확장했어요." },
  { hash: "91c4e2a", msg: "chore: Flyway V18 billing 마이그레이션 추가", author: "alice", time: "1시간 전", files: 2, summary: "billing_invoice 테이블 생성과 orders 테이블에 invoice_id 컬럼을 추가하는 마이그레이션이에요." },
  { hash: "b5d09f3", msg: "refactor: RateLimitInterceptor 버킷 로직 개선", author: "bob", time: "3시간 전", files: 4, summary: "테넌트별 요청 제한 버킷의 리필 로직을 슬라이딩 윈도우 방식으로 개선했어요." },
];

var COMMIT_SUMMARY = "결제 콜백 버그를 수정하고, 주문 API에 청구서 필드를 추가했어요. Billing 테이블 마이그레이션과 속도 제한 로직도 개선됐어요.";
