import { serviceContent } from "@/data/service-content";

export const divisionImages = {
  "Digital Solutions": {
    src: "/images/digital-solutions.webp",
    alt: "Developer working on a digital interface",
  },
  "Software and Applications": {
    src: "/images/software.webp",
    alt: "Business team reviewing software applications",
  },
  "Cloud and Infrastructure": {
    src: "/images/cloud.webp",
    alt: "Modern infrastructure and server environment",
  },
  "AI and Business Automation": {
    src: "/images/ai.webp",
    alt: "Artificial intelligence technology workspace",
  },
  "IT and Technology Consulting": {
    src: "/images/consulting.webp",
    alt: "Technology consultants discussing a business plan",
  },
} as const;

export function getServiceImage(slug: string) {
  const service = serviceContent.find((item) => item.slug === slug);
  return service ? divisionImages[service.division] : divisionImages["Digital Solutions"];
}
