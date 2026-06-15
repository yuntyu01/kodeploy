import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // WSL2/원격(devcontainer)에서 Windows 브라우저가 붙으려면 0.0.0.0 바인딩 필요.
    // host:true → localhost + WSL IP(예: http://<wsl-ip>:5173) 양쪽으로 노출.
    host: true,
    port: 5173,
    // 5173이 이미 점유돼 있으면 조용히 5174로 옮기지 말고 에러로 알림(주소 혼란 방지).
    strictPort: true,
  },
});
