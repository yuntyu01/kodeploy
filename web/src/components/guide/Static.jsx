// 정적 사이트 배포 가이드 - 빌드 커맨드/출력 디렉토리 개념 + SPA/캐싱/모노레포 안내.
import { Bullet, Code, CodeBlock, Section } from "./atoms.jsx";

export default function Static() {
  return (
    <>
      <Section title="정적 사이트 배포란">
        React·Vue 같은 프론트엔드나 순수 HTML을 호스팅하는 방식이에요.
        KoDeploy가 저장소를 빌드해 산출물을 nginx로 서빙합니다 - Dockerfile도, 포트 설정도
        필요 없어요. 배포 폼에서 <Code>정적 사이트</Code>를 켜면 되고, 서버 런타임과{" "}
        <Code>함께</Code> 쓸 수도(프론트 + API 백엔드), 단독으로 쓸 수도 있습니다(서버
        런타임을 <Code>사용 안 함</Code>으로).
      </Section>

      <Section title="도메인은 이렇게 나뉘어요">
        <Bullet>
          정적 사이트가 켜져 있으면: <Code>{"{앱}"}.kodeploy.com</Code> = 정적 사이트,{" "}
          <Code>{"{앱}"}-api.kodeploy.com</Code> = 서버. 커스텀 도메인도 정적 사이트에 연결됩니다.
        </Bullet>
        <Bullet>
          정적 사이트가 없으면: 서버가 <Code>{"{앱}"}.kodeploy.com</Code>과{" "}
          <Code>{"{앱}"}-api.kodeploy.com</Code> 둘 다로 응답해요 - 나중에 정적 사이트를
          켜도 <Code>-api</Code> 주소는 처음부터 유효했던 주소라 API 호출이 안 끊깁니다.
        </Bullet>
        <Bullet>프론트 코드의 API 주소는 <Code>{"{앱}"}-api.kodeploy.com</Code>을 쓰세요.</Bullet>
      </Section>

      <Section title="빌드 커맨드 · 출력 디렉토리">
        <div className="mb-2.5">
          빌드 커맨드가 만든 <Code>출력 디렉토리</Code>의 내용물만 서빙돼요. 프레임워크별 기본값:
        </div>
        <div className="my-3">
          <CodeBlock>{`Vite (React/Vue)   npm ci && npm run build   →   dist
CRA                npm ci && npm run build   →   build`}</CodeBlock>
        </div>
        <Bullet>
          빌드 커맨드를 <Code>비우면</Code> 빌드 없이 저장소 파일을 그대로 서빙해요 -
          루트에 <Code>index.html</Code>이 있는 순수 HTML 프로젝트용.
        </Bullet>
        <Bullet>
          빌드는 <Code>node 22</Code> 환경에서 실행됩니다. 실패하면 빌드 로그에서 원인을 확인하세요.
        </Bullet>
      </Section>

      <Section title="SPA 라우팅 · 캐싱은 자동이에요">
        <Bullet>
          없는 경로는 <Code>index.html</Code>로 fallback - React Router 같은 클라이언트 라우팅의
          딥링크 새로고침이 그대로 동작합니다.
        </Bullet>
        <Bullet>
          해시 번들(<Code>/assets/</Code>·<Code>/static/</Code>)은 CDN에 1년 캐시되고,{" "}
          <Code>index.html</Code>은 매번 재검증돼요 - 재배포하면 새 버전이 즉시 반영됩니다.
        </Bullet>
      </Section>

      <Section title="모노레포라면">
        <Bullet>
          <Code>앱 디렉토리</Code>에 프론트 폴더를 입력하세요(예: <Code>frontend</Code>).
          빌드 커맨드와 출력 디렉토리는 그 폴더 기준으로 실행/탐색됩니다.
        </Bullet>
      </Section>

      <Section title="제약">
        <Bullet>
          <Code>DB · Redis · 스토리지 · 환경변수</Code>는 서버 슬롯 옵션이에요 - 정적
          사이트(nginx)에는 적용되지 않습니다.
        </Bullet>
        <Bullet>
          <Code>VITE_*</Code> 같은 빌드 타임 변수는 정적 사이트 섹션의{" "}
          <Code>빌드 타임 변수</Code>에 입력하세요 - 빌드 중 번들에 박혀 브라우저에
          공개되는 값이라 <Code>시크릿은 금지</Code>입니다 (서버 환경변수와 별개).
        </Bullet>
        <Bullet>정적 사이트를 <Code>사용 안 함</Code>으로 돌리면 사이트가 내려가고 도메인이 서버로 돌아갑니다.</Bullet>
      </Section>
    </>
  );
}
