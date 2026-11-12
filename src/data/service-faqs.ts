export const serviceFaqs: Record<string, { question: string; answer: string }[]> = {
  "web-development": [
    {
      question: "Can a website connect to an existing business system?",
      answer:
        "That depends on the system, its available interfaces, access requirements, and the intended workflow. Integration options should be assessed during discovery.",
    },
    {
      question: "Will the website work on mobile devices?",
      answer:
        "Responsive behavior and usability across screen sizes are included in the proposed web-development capability. Specific browser and device requirements are agreed during planning.",
    },
  ],
  "custom-software-development": [
    {
      question: "How do you decide what should be custom-built?",
      answer:
        "The decision starts with workflows, constraints, and available products. A custom build should be considered only when it addresses a real need that existing options do not fit.",
    },
    {
      question: "Can requirements change during development?",
      answer:
        "Changes can affect scope, time, and cost. They should be reviewed and agreed through a clear change process rather than silently added.",
    },
  ],
  "mobile-application-development": [
    {
      question: "Which mobile platforms can you support?",
      answer:
        "The supported platforms and implementation approach are decided after understanding the intended users, devices, distribution method, and maintenance requirements.",
    },
    {
      question: "Can the application work with an existing backend?",
      answer:
        "Potential integrations depend on the backend's interfaces, authentication approach, data contracts, and security requirements, all of which need technical review.",
    },
  ],
  "ai-and-business-automation": [
    {
      question: "Does every automation idea need AI?",
      answer:
        "No. A rule-based workflow may be simpler and easier to validate. The approach should fit the task and its risks.",
    },
    {
      question: "Will business data be sent to an AI provider?",
      answer:
        "No external AI service should receive data without an explicit provider, data-flow, privacy, and security review and the required configuration and approvals.",
    },
  ],
  "cloud-and-infrastructure-solutions": [
    {
      question: "Which cloud provider should a business choose?",
      answer:
        "There is no universal choice. Requirements, existing skills, regional availability, compliance, budget, performance, and operational ownership should guide the decision.",
    },
    {
      question: "Are backups part of an infrastructure plan?",
      answer:
        "Backup frequency, retention, recovery objectives, ownership, and restoration tests should be defined as explicit operational requirements.",
    },
  ],
  "ui-ux-design": [
    {
      question: "Does design include accessibility?",
      answer:
        "Accessibility should be considered in structure, interaction, visual contrast, keyboard use, and content. Testing scope should be agreed for each project.",
    },
    {
      question: "Can you work with an existing brand?",
      answer:
        "Yes. Available brand assets and guidelines can inform the interface. Any missing or conflicting guidance should be clarified before design decisions are finalized.",
    },
  ],
  "technology-consulting": [
    {
      question: "What should a technology review include?",
      answer:
        "The review is scoped around a specific decision, product, or architecture and may consider requirements, constraints, trade-offs, risks, and operational needs.",
    },
    {
      question: "Will a recommendation guarantee a project outcome?",
      answer:
        "No. A recommendation explains assumptions and trade-offs; implementation results depend on project scope, execution, external dependencies, and operational conditions.",
    },
  ],
};
