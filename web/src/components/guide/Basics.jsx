// 기본 규칙 섹션 — 다른 페이지에서도 import 가능하게 default export.
import { Bullet, CodeBlock, Section } from "./atoms.jsx";

export default function Basics() {
  return (
    <>
      <Section title="딱 3가지만 챙기면 끝">
        <Bullet>
          <strong className="text-fg-2">Dockerfile</strong>을 repo 루트에 둡니다.
          다른 위치에 있으면 배포 폼의{" "}
          <span style={{ color: "#d0d6e0" }}>Dockerfile 경로</span>에 위치 입력.
        </Bullet>
        <Bullet>
          <strong className="text-fg-2">빌드는 KoDeploy가 자동으로</strong> 해요.
          로컬에서 미리 mvn / npm 빌드 안 해도 됩니다.
        </Bullet>
        <Bullet>
          <strong className="text-fg-2">앱이 열어둘 포트</strong>를 배포 폼에 입력.
          기본 80, Spring은 8080, FastAPI는 8000.
        </Bullet>
      </Section>

      <Section title="MySQL을 켜면 이런 환경변수가 자동으로 들어와요">
        <p className="text-[14px] text-fg-3 mb-3">
          앱 코드에서 그대로 가져다 쓰면 DB 접속이 됩니다.
        </p>
        <CodeBlock>
          {[
            "DB_HOST=mysql",
            "DB_PORT=3306",
            "DB_NAME=app",
            "DB_USER=app",
            "DB_PASSWORD=...",
          ].join("\n")}
        </CodeBlock>
      </Section>
    </>
  );
}
