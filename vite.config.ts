import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// base "./" keeps asset paths relative, so the build works on Vercel,
// Netlify, Cloudflare Pages and GitHub Pages sub-paths alike.
export default defineConfig({
    base: "./",
    plugins: [react(), tailwindcss()],
});
