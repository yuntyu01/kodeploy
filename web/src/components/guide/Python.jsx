// Python (FastAPI/Flask + 선택적 MySQL) 가이드 — 단순 톤.
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

      <Section title="MySQL 쓸 때">
        <p className="text-[14px] text-fg-3 mb-3">
          <Code>requirements.txt</Code>에 <Code>pymysql</Code>을 추가한 다음,
          DB 초기화 파일을 새로 만들어서 (예:{" "}
          <span style={HL}>database.py</span>) 아래 코드를 넣어주세요.
          앱 코드에서 이 파일의 <Code>engine</Code>을 import해서 씁니다.
        </p>
        <CodeBlock>
{`# database.py
import os
from sqlalchemy import create_engine

engine = create_engine(
    f"mysql+pymysql://{os.environ['DB_USER']}:{os.environ['DB_PASSWORD']}"
    f"@{os.environ['DB_HOST']}:{os.environ['DB_PORT']}/{os.environ['DB_NAME']}"
)`}
        </CodeBlock>
        <p className="text-[13px] text-fg-4 mt-2" style={{ fontWeight: 450 }}>
          다른 파일에서 사용:{" "}
          <Code>from database import engine</Code>
        </p>
      </Section>
    </>
  );
}
