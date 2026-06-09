import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pin the workspace root to this app (a stray lockfile sits in the parent folder).
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
