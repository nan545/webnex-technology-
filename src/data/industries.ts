import {
  BriefcaseBusiness,
  GraduationCap,
  HeartPulse,
  Hotel,
  PackageCheck,
  ShoppingBag,
  type LucideIcon,
} from "lucide-react";

export type Industry = {
  slug: string;
  title: string;
  introduction: string;
  challenges: string[];
  solutions: string[];
  icon: LucideIcon;
};

export const industries: Industry[] = [
  {
    slug: "education",
    title: "Education",
    introduction:
      "Digital services can help education providers communicate, organize information, and support learning operations.",
    challenges: [
      "Information spread across separate channels.",
      "Manual administration and communication workflows.",
      "Digital services that are difficult to use on mobile.",
    ],
    solutions: [
      "Accessible websites and information portals",
      "Workflow and administration tools",
      "Mobile-friendly digital learning experiences",
    ],
    icon: GraduationCap,
  },
  {
    slug: "hospitality",
    title: "Hospitality",
    introduction:
      "Hospitality businesses can use clear digital experiences to present services and make customer journeys easier to navigate.",
    challenges: [
      "Important service details that are difficult to find.",
      "Disconnected customer enquiry and booking processes.",
      "Web experiences that do not support mobile visitors.",
    ],
    solutions: [
      "Responsive service and destination websites",
      "Customer enquiry and booking workflow planning",
      "Connected business applications",
    ],
    icon: Hotel,
  },
  {
    slug: "healthcare",
    title: "Healthcare",
    introduction:
      "Healthcare technology needs to prioritize privacy, clarity, accessibility, and appropriate operational safeguards.",
    challenges: [
      "Complex information that needs clear presentation.",
      "Administrative processes involving multiple hand-offs.",
      "Strict privacy and access considerations.",
    ],
    solutions: [
      "Accessible information websites",
      "Carefully scoped administrative software",
      "Security and privacy requirements planning",
    ],
    icon: HeartPulse,
  },
  {
    slug: "retail-and-ecommerce",
    title: "Retail and E-commerce",
    introduction:
      "Retailers can use digital platforms to present products, support customers, and improve business workflows.",
    challenges: [
      "Product information that is difficult to maintain.",
      "Disconnected customer and inventory processes.",
      "Unclear requirements for digital commerce.",
    ],
    solutions: [
      "Product and brand websites",
      "E-commerce discovery and implementation planning",
      "Operational workflow applications",
    ],
    icon: ShoppingBag,
  },
  {
    slug: "logistics",
    title: "Logistics",
    introduction:
      "Logistics operations rely on timely information and workflows that make status and responsibilities easier to follow.",
    challenges: [
      "Manual tracking across separate tools.",
      "Limited visibility into process hand-offs.",
      "Operational information that is difficult to access.",
    ],
    solutions: [
      "Workflow and operations software",
      "System integration planning",
      "Mobile-first operational interfaces",
    ],
    icon: PackageCheck,
  },
  {
    slug: "financial-and-professional-services",
    title: "Financial and Professional Services",
    introduction:
      "Professional service organizations need digital experiences that communicate clearly and respect sensitive information.",
    challenges: [
      "Complex services that are difficult to explain online.",
      "Repetitive client intake and document workflows.",
      "Elevated security and privacy expectations.",
    ],
    solutions: [
      "Clear corporate websites and service journeys",
      "Internal business workflow applications",
      "Security-conscious technical planning",
    ],
    icon: BriefcaseBusiness,
  },
];

export function getIndustry(slug: string) {
  return industries.find((industry) => industry.slug === slug);
}
