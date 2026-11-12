import {
  Bot,
  Cloud,
  Code2,
  Layers3,
  Lightbulb,
  Smartphone,
  Workflow,
  type LucideIcon,
} from "lucide-react";

export type Service = {
  slug: string;
  title: string;
  shortDescription: string;
  introduction: string;
  problems: string[];
  capabilities: string[];
  delivery: string;
  icon: LucideIcon;
};

export const services: Service[] = [
  {
    slug: "web-development",
    title: "Web Development",
    shortDescription:
      "Accessible, responsive websites and web applications built around real business needs.",
    introduction:
      "We plan and build web experiences that make information easier to find and important tasks easier to complete.",
    problems: [
      "A website that is difficult to use on mobile devices.",
      "Disconnected online workflows that create avoidable manual work.",
      "Digital experiences that do not clearly support business goals.",
    ],
    capabilities: [
      "Corporate websites and content-driven experiences",
      "Web application design and engineering",
      "Responsive implementation and accessibility",
      "Search, performance, and technical SEO foundations",
    ],
    delivery:
      "Work starts with understanding the audience and requirements, then moves through structure, design, implementation, testing, and a planned handover.",
    icon: Code2,
  },
  {
    slug: "custom-software-development",
    title: "Custom Software Development",
    shortDescription:
      "Purpose-built software for processes that off-the-shelf tools do not fit.",
    introduction:
      "We help define and develop software around a business's actual workflows, users, and constraints.",
    problems: [
      "Important processes spread across disconnected tools.",
      "Repeated manual tasks that are difficult to track.",
      "Generic software that cannot support a specific operating model.",
    ],
    capabilities: [
      "Requirements discovery and technical planning",
      "Business applications and internal tools",
      "API and system integration planning",
      "Maintainable architecture and quality assurance",
    ],
    delivery:
      "We validate the problem and scope before proposing an implementation. Work is divided into reviewable stages with testing and documentation.",
    icon: Layers3,
  },
  {
    slug: "mobile-application-development",
    title: "Mobile Application Development",
    shortDescription:
      "Mobile experiences designed for the needs and conditions of their users.",
    introduction:
      "We plan mobile products around practical user journeys, device requirements, and the systems they need to connect with.",
    problems: [
      "Services that are difficult to access away from a desktop.",
      "Mobile journeys that do not match user expectations.",
      "Unclear requirements for connecting apps to existing systems.",
    ],
    capabilities: [
      "Mobile product discovery and interface planning",
      "Application engineering for agreed target platforms",
      "API integration planning",
      "Device and usability testing",
    ],
    delivery:
      "Platform, connectivity, accessibility, and release requirements are clarified early, then verified throughout design and implementation.",
    icon: Smartphone,
  },
  {
    slug: "ai-and-business-automation",
    title: "AI and Business Automation",
    shortDescription:
      "Practical automation opportunities evaluated against business processes and risk.",
    introduction:
      "We help identify where automation may reduce repetitive effort, while keeping human review and data handling in view.",
    problems: [
      "Repetitive work with clear rules and avoidable hand-offs.",
      "Uncertainty about whether an AI use case is appropriate.",
      "Automation ideas without a defined validation or oversight plan.",
    ],
    capabilities: [
      "Process and use-case discovery",
      "Automation opportunity assessment",
      "Prototype and integration planning",
      "Human review, privacy, and quality considerations",
    ],
    delivery:
      "We start with a bounded use case and measurable acceptance criteria. Any external AI service, data access, or production automation requires explicit review and configuration.",
    icon: Bot,
  },
  {
    slug: "cloud-and-infrastructure-solutions",
    title: "Cloud and Infrastructure Solutions",
    shortDescription:
      "Infrastructure planning that considers reliability, security, and operational ownership.",
    introduction:
      "We help businesses plan application hosting and deployment around their technical and operational requirements.",
    problems: [
      "Unclear hosting requirements for a new application.",
      "Deployment processes that are difficult to repeat.",
      "Infrastructure decisions made without a recovery plan.",
    ],
    capabilities: [
      "Hosting and deployment architecture planning",
      "Environment and release workflow design",
      "Monitoring and operational readiness planning",
      "Backup and recovery requirements",
    ],
    delivery:
      "Recommendations account for traffic, availability, budget, data sensitivity, and who will maintain the infrastructure after launch.",
    icon: Cloud,
  },
  {
    slug: "ui-ux-design",
    title: "UI/UX Design",
    shortDescription:
      "Clear, accessible product interfaces shaped around user needs and business objectives.",
    introduction:
      "We structure and design digital experiences so people can understand what is available and complete key tasks with confidence.",
    problems: [
      "Interfaces that make important actions difficult to find.",
      "Inconsistent experiences across pages or devices.",
      "Design decisions that have not been tested with users.",
    ],
    capabilities: [
      "Information architecture and user journeys",
      "Wireframes and interface design",
      "Responsive and accessible design systems",
      "Usability review and design handoff",
    ],
    delivery:
      "Design work connects discovery, content structure, interaction states, accessibility, and engineering constraints before handoff.",
    icon: Workflow,
  },
  {
    slug: "technology-consulting",
    title: "Technology Consulting",
    shortDescription:
      "Independent technical planning to help teams make informed product and platform decisions.",
    introduction:
      "We help clarify technical options, risks, and delivery considerations before a business commits to a solution.",
    problems: [
      "Unclear technical requirements or competing solution options.",
      "A need to assess an existing digital product or architecture.",
      "Uncertainty about scope, dependencies, and delivery risks.",
    ],
    capabilities: [
      "Technical discovery and requirements clarification",
      "Architecture and technology option reviews",
      "Delivery planning and risk assessment",
      "Documentation for informed decision-making",
    ],
    delivery:
      "The engagement is scoped around a specific decision or outcome, with assumptions, constraints, and recommendations documented clearly.",
    icon: Lightbulb,
  },
];

export function getService(slug: string) {
  return services.find((service) => service.slug === slug);
}
