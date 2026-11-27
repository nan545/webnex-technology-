import { Bot, Cloud, Code2, Layers3, Lightbulb, Smartphone, Workflow, type LucideIcon } from "lucide-react";
import { serviceContent, type ServiceContent } from "@/data/service-content";

export type Service = ServiceContent & { icon: LucideIcon };

const icons: Record<string, LucideIcon> = {
  "web-development": Code2,
  "custom-software-development": Layers3,
  "mobile-application-development": Smartphone,
  "ai-and-business-automation": Bot,
  "cloud-and-infrastructure-solutions": Cloud,
  "ui-ux-design": Workflow,
  "technology-consulting": Lightbulb,
};

export const services: Service[] = serviceContent.map((service) => {
  const icon = icons[service.slug] ?? (
    service.division === "Digital Solutions" ? Code2
    : service.division === "Software and Applications" ? Layers3
    : service.division === "Cloud and Infrastructure" ? Cloud
    : service.division === "AI and Business Automation" ? Bot
    : Lightbulb
  );
  return { ...service, icon };
});

export function getService(slug: string) {
  return services.find((service) => service.slug === slug);
}
