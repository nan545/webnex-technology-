import { serviceContent } from "@/data/service-content";
import { serviceFaqs } from "@/data/service-faqs";
import { cmsServiceContentSchema, type CmsServiceContent } from "@/lib/validation/cms-service";

const icons: Record<string, CmsServiceContent["icon"]> = {
  "web-development": "code",
  "custom-software-development": "layers",
  "mobile-application-development": "smartphone",
  "ai-and-business-automation": "bot",
  "cloud-and-infrastructure-solutions": "cloud",
  "ui-ux-design": "workflow",
  "technology-consulting": "lightbulb",
};

export const fallbackServices = serviceContent.map((service) => {
  const icon = icons[service.slug] ?? (
    service.division === "Digital Solutions" ? "code"
    : service.division === "Software and Applications" ? "layers"
    : service.division === "Cloud and Infrastructure" ? "cloud"
    : service.division === "AI and Business Automation" ? "bot"
    : "lightbulb"
  );
  return {
    id: service.slug,
    slug: service.slug,
    title: service.title,
    summary: service.shortDescription,
    seoTitle: null,
    seoDescription: null,
    content: cmsServiceContentSchema.parse({
      introduction: service.introduction,
      problems: service.problems,
      capabilities: service.capabilities,
      delivery: service.delivery,
      faqs: serviceFaqs[service.slug] ?? [],
      icon,
    }),
  };
});
