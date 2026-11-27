import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";
import { industries } from "@/data/industries";
import { caseStudies } from "@/data/projects";
import { readPublishedServicesForPage } from "@/server/content/services";
import { readPublishedTeamMembers } from "@/server/content/team";
import { readWebsiteInsights, readWebsiteProjects } from "@/server/content/website-publications";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [team, services, projectResults, insightResults] = await Promise.all([
    readPublishedTeamMembers(),
    readPublishedServicesForPage(),
    readWebsiteProjects(),
    readWebsiteInsights(),
  ]);
  const routes = [
    "",
    "/about",
    "/team",
    "/services",
    "/projects",
    "/case-studies",
    "/industries",
    "/insights",
    "/contact",
    "/products",
  ];

  return [
    ...routes.map((route) => ({
      url: new URL(route, siteConfig.url).toString(),
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
    })),
    ...services.items.map((service) => ({
      url: new URL(`/services/${service.slug}`, siteConfig.url).toString(),
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
    })),
    ...industries.map((industry) => ({
      url: new URL(`/industries/${industry.slug}`, siteConfig.url).toString(),
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
    })),
    ...projectResults.items.map((project) => ({
      url: new URL(`/projects/${project.slug}`, siteConfig.url).toString(),
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
    })),
    ...caseStudies.map((caseStudy) => ({
      url: new URL(`/case-studies/${caseStudy.slug}`, siteConfig.url).toString(),
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
    })),
    ...insightResults.items.map((article) => ({
      url: new URL(`/insights/${article.slug}`, siteConfig.url).toString(),
      lastModified: new Date(article.publishedAt),
      changeFrequency: "monthly" as const,
    })),
    ...team.items.map((member) => ({
      url: new URL(`/team/${member.slug}`, siteConfig.url).toString(),
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
    })),
  ];
}
