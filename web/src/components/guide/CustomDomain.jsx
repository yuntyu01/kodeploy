// 커스텀 도메인 연결 가이드 - 내 도메인을 앱에 붙이는 법 + CNAME이 왜 필요한지.
import { Bullet, Code, CodeBlock, Section } from "./atoms.jsx";

export default function CustomDomain() {
  return (
    <>
      <Section title="커스텀 도메인이란">
        내가 가진 도메인(예: <Code>app.example.com</Code>)을 KoDeploy 앱 주소로 연결하는 기능이에요.
        연결하지 않으면 앱은 기본 주소 <Code>{"{app}"}.kodeploy.com</Code> 으로만 열립니다.
      </Section>

      <Section title="왜 CNAME을 직접 추가해야 하나요?">
        <div className="mb-2.5">
          내 도메인의 DNS는 <Code>도메인을 산 곳(가비아·Route53·Cloudflare 등)</Code>에서 관리합니다.
          KoDeploy는 남의 도메인을 마음대로 바꿀 권한이 없어요. 그래서 <Code>app.example.com</Code> 으로
          들어온 트래픽이 앱까지 오게 하려면, <Code>도메인 주인이 직접</Code> "이 도메인은 KoDeploy로 보내라"고
          DNS에 적어줘야 합니다 - 그게 CNAME 한 줄이에요.
        </div>
        <Bullet>Vercel·Netlify·Cloudflare Pages 등 어느 서비스를 써도 동일한, 피할 수 없는 단 하나의 수동 단계예요.</Bullet>
        <Bullet>그 뒤로 인증서 발급·갱신·라우팅은 전부 자동입니다 - 직접 관리할 게 없어요.</Bullet>
      </Section>

      <Section title="연결 방법">
        <Bullet>배포 폼 <Code>고급 옵션 → 커스텀 도메인</Code> 또는 <Code>활동 패널 → 부가기능</Code> 에서 도메인을 입력해요.</Bullet>
        <Bullet>표시되는 CNAME 한 줄을 도메인 DNS에 추가하세요:</Bullet>
        <div className="my-3">
          <CodeBlock>{`CNAME   app.example.com   →   origin.kodeploy.com`}</CodeBlock>
        </div>
        <Bullet>전파되면 수 분 내 인증서가 자동 발급되고 활성화됩니다 - 직접 관리할 게 없어요.</Bullet>
      </Section>

      <Section title="주의사항">
        <Bullet>
          <Code>서브도메인만</Code> 지원해요(예: app.example.com). 루트/apex 도메인(example.com)은 표준상
          CNAME이 안 돼서 미지원입니다 - 서브도메인을 쓰세요.
        </Bullet>
        <Bullet>본인이 DNS를 제어할 수 있는 <Code>소유 도메인</Code>이어야 합니다.</Bullet>
        <Bullet>한 앱당 커스텀 도메인은 1개입니다.</Bullet>
      </Section>
    </>
  );
}
