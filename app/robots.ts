import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const publicIndexing = process.env.PUBLIC_INDEXING_ENABLED === "true";
  return {
    rules: publicIndexing
      ? { userAgent: "*", allow: "/" }
      : { userAgent: "*", disallow: "/" }
  };
}
