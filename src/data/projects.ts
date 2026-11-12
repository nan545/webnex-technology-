export type Project = {
  slug: string;
  title: string;
  summary: string;
  industry: string;
  technologies: string[];
  description: string[];
  image?: {
    src: string;
    alt: string;
  };
};

export type CaseStudy = {
  slug: string;
  title: string;
  projectSlug: string;
  clientName?: string;
  challenge: string;
  objectives: string[];
  solution: string;
  approach: string[];
  technologies: string[];
  verifiedOutcome: string;
};

export const projects: Project[] = [];
export const caseStudies: CaseStudy[] = [];

export function getProject(slug: string) {
  return projects.find((project) => project.slug === slug);
}

export function getCaseStudy(slug: string) {
  return caseStudies.find((caseStudy) => caseStudy.slug === slug);
}
