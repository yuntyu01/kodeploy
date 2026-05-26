import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";

const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");
const WS_URL = API_BASE.replace(/^http/, "ws") + "/deploy/app/db-terminal";

export default function DbTerminalPanel() {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      theme: {
        background: "#0a0a0b",
        foreground: "#dde0e4",
        cursor: "#818be0",
        selectionBackground: "rgba(129,139,224,0.3)",
      },
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());
    term.open(containerRef.current);
    fitAddon.fit();

    const ws = new WebSocket(WS_URL);

    ws.onopen = () => term.write("\x1b[1;34mDB 연결됨\x1b[0m\r\n");
    ws.onmessage = (e) => term.write(e.data);
    ws.onclose = (e) => term.write(`\r\n\x1b[1;31m연결 종료${e.reason ? `: ${e.reason}` : ""}\x1b[0m\r\n`);
    ws.onerror = () => term.write("\r\n\x1b[1;31m연결 실패\x1b[0m\r\n");
    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(data);
    });

    const ro = new ResizeObserver(() => fitAddon.fit());
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      ws.close();
      term.dispose();
    };
  }, []);

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div
        className="flex items-center gap-2 px-4 py-1.5 shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <span className="text-[11px] text-fg-3" style={{ fontWeight: 510 }}>
          DB 터미널
        </span>
        <span className="text-[10px] text-fg-4" style={{ fontWeight: 450 }}>
          mysql / psql 쉘
        </span>
      </div>
      <div ref={containerRef} className="flex-1 min-h-0 p-1" style={{ background: "#0a0a0b" }} />
    </div>
  );
}
