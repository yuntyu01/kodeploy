// Java (Spring Boot + 선택적 MySQL) 가이드 — 단순 톤.
import { Code, CodeBlock, Section } from "./atoms.jsx";

export default function Java() {
  return (
    <>
      <Section title="Dockerfile 양식">
        <CodeBlock>
{`FROM eclipse-temurin:17-jdk AS build
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN apt-get update && apt-get install -y maven --no-install-recommends && \\
    mvn clean package -DskipTests

FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]`}
        </CodeBlock>
        <p className="text-[13px] text-fg-4 mt-2" style={{ fontWeight: 450 }}>
          repo에 <Code>mvnw</Code>가 있으면 Maven 설치 줄을 빼고{" "}
          <Code>./mvnw clean package -DskipTests</Code>로 바꿔도 됩니다.
        </p>
      </Section>

      <Section title="MySQL 쓸 때 — 의존성 1줄만 추가">
        <p className="text-[14px] text-fg-3 mb-3">
          <Code>pom.xml</Code>에 mysql 드라이버만 추가하면{" "}
          <strong className="text-fg-2">코드 변경 0</strong>으로 DB 연결 됩니다.
          Spring Boot가 환경변수를 자동 인식해요.
        </p>
        <CodeBlock>
{`<dependency>
    <groupId>com.mysql</groupId>
    <artifactId>mysql-connector-j</artifactId>
    <scope>runtime</scope>
</dependency>`}
        </CodeBlock>
      </Section>
    </>
  );
}
