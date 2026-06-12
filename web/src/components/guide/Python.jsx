// Python (FastAPI/Flask + 선택적 DB) 가이드 - 단순 톤.
import { Code, CodeBlock, Section } from "./atoms.jsx";

// 강조용 inline 색 (브랜드 보라)
const HL = { color: "#818be0", fontWeight: 510 };

export default function Python() {
  return (
    <>
      <Section title="Dockerfile 양식">
        <CodeBlock>
          {`FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", `}
          <span style={HL}>"main:app"</span>
          {`, "--host", "0.0.0.0", "--port", "8000"]`}
        </CodeBlock>
        <p className="text-[13px] text-fg-4 mt-2" style={{ fontWeight: 450 }}>
          진입점이 <Code>main.py</Code>가 아니면 마지막 줄의{" "}
          <span style={HL}>"main:app"</span> 부분만 바꿔주세요{" "}
          (예: <Code>app/server.py</Code>이면{" "}
          <span style={HL}>"app.server:app"</span>).
        </p>
      </Section>

      <Section title="DB 쓸 때 - DATABASE_URL 한 줄이면 끝">
        <p className="text-[14px] text-fg-3 mb-3">
          MySQL이나 PostgreSQL을 켜면 완성된 접속 문자열{" "}
          <span style={HL}>DATABASE_URL</span>이 자동 주입돼요. 드라이버만{" "}
          <Code>requirements.txt</Code>에 추가하면 됩니다 - MySQL은{" "}
          <Code>pymysql</Code>, PostgreSQL은 <Code>psycopg2-binary</Code>.
        </p>
        <CodeBlock>
{`# database.py
import os
from sqlalchemy import create_engine

engine = create_engine(os.environ["DATABASE_URL"])`}
        </CodeBlock>
        <p className="text-[13px] text-fg-4 mt-2" style={{ fontWeight: 450 }}>
          다른 파일에서 사용: <Code>from database import engine</Code>.
          접속 정보를 직접 다루고 싶으면 <Code>DB_HOST</Code> · <Code>DB_PORT</Code> ·{" "}
          <Code>DB_NAME</Code> · <Code>DB_USER</Code> · <Code>DB_PASSWORD</Code>도
          같이 들어와 있어요.
        </p>
      </Section>
    </>
  );
}
