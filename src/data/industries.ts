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
    slug: "restaurants",
    title: "Restaurants",
    introduction: "Restaurants can use coordinated digital systems to improve customer information, ordering, inventory, and operational visibility.",
    challenges: [
      "Manual ordering or inventory processes.",
      "Unclear customer communication.",
      "Reporting that depends on separate records.",
    ],
    solutions: [
      "Website and ordering experiences",
      "Inventory and operational applications",
      "Reporting and business workflow support",
    ],
    icon: Hotel,
  },
  {
    slug: "smes-startups",
    title: "SMEs and startups",
    introduction: "Smaller organizations need practical technology that fits current resources while remaining ready for growth.",
    challenges: [
      "Limited time for repeated administration.",
      "Unclear priorities for technology investment.",
      "Systems that need to support change as the business grows.",
    ],
    solutions: [
      "Focused business websites",
      "Custom operational applications",
      "Cloud and automation planning",
    ],
    icon: BriefcaseBusiness,
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
  {
    slug: "professional-services",
    title: "Professional services",
    introduction: "Professional service organizations need clear digital experiences and controlled workflows for client and information management.",
    challenges: [
      "Complex services that are difficult to explain online.",
      "Repeated client intake and document workflows.",
      "Security and privacy requirements.",
    ],
    solutions: [
      "Corporate websites and service journeys",
      "Internal workflow applications",
      "Security-conscious planning",
    ],
    icon: BriefcaseBusiness,
  },
];

export function getIndustry(slug: string) {
  return industries.find((industry) => industry.slug === slug);
}
