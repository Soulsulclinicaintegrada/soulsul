import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
var configDir = decodeURIComponent(new URL(".", import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, "$1").replace(/\/$/, "");
var srcPath = "".concat(configDir, "/src");
var rootAllowPath = configDir;
export default defineConfig({
    plugins: [react()],
    root: configDir,
    resolve: {
        alias: {
            "@": srcPath
        }
    },
    server: {
        host: "0.0.0.0",
        allowedHosts: [
            "erp.soulsulclinicaintegrada.com.br",
            "api.soulsulclinicaintegrada.com.br",
            "agenda-api.soulsulclinicaintegrada.com.br"
        ],
        fs: {
            allow: [rootAllowPath]
        }
    },
    preview: {
        host: "0.0.0.0"
    }
});
