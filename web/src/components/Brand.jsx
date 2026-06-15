export default function Brand({ size = 22 }) {
  return (
    <span
      aria-label="KoDeploy"
      style={{
        fontFamily: '"Geist", Inter, sans-serif',
        fontWeight: 700,
        fontSize: size,
        lineHeight: 1,
        letterSpacing: "-0.045em",
        display: "inline-flex",
        alignItems: "baseline",
        userSelect: "none",
      }}
    >
      <span style={{ color: "var(--fg-1)" }}>Ko</span>
      <span style={{ color: "var(--accent)" }}>Deploy</span>
    </span>
  );
}
