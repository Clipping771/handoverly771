import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ['lucide-react', '@react-three/drei', '@react-three/fiber'],
  },
};

export default nextConfig;
