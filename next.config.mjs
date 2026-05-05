/** @type {import('next').NextConfig} */
const isGithubPages = process.env.GITHUB_PAGES === "true";
const repoName = process.env.GITHUB_PAGES_REPO ?? "lifeappdemo";
const basePath = isGithubPages ? `/${repoName}` : "";

const nextConfig = {
  assetPrefix: basePath || undefined,
  basePath: basePath || undefined,
  images: {
    unoptimized: true
  },
  output: isGithubPages ? "export" : undefined,
  reactStrictMode: true,
  trailingSlash: isGithubPages
};

export default nextConfig;
