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
      <span style={{ color: "#f7f8f8" }}>Ko</span>
      <span style={{ color: "#7170ff" }}>Deploy</span>
    </span>
  );
}
