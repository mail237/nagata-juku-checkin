import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /** Dev での Strict Mode 二重マウントが getUserMedia と相性悪いため */
  reactStrictMode: false,
};

export default nextConfig;
