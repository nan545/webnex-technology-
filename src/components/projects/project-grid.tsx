"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { Project } from "@/data/projects";

export function ProjectGrid({ projects }: { projects: Project[] }) {
  const [industry, setIndustry] = useState("all");
  const industries = useMemo(
    () => [...new Set(projects.map((project) => project.industry))],
    [projects],
  );
  const visibleProjects =
    industry === "all"
      ? projects
      : projects.filter((project) => project.industry === industry);

  return (
    <>
      <div className="mb-8 max-w-sm">
        <label className="field-label" htmlFor="project-industry">
          Filter by industry
        </label>
        <select
          className="field-control"
          id="project-industry"
          onChange={(event) => setIndustry(event.target.value)}
          value={industry}
        >
          <option value="all">All industries</option>
          {industries.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {visibleProjects.map((project) => (
          <article className="border border-border bg-white p-6" key={project.slug}>
            {project.image ? (
              <Image
                alt={project.image.alt}
                className="mb-5 aspect-video w-full object-cover"
                height={675}
                sizes="(max-width: 768px) 100vw, 33vw"
                src={project.image.src}
                unoptimized
                width={1200}
              />
            ) : null}
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
              {project.industry}
            </p>
            <h2 className="mt-3 text-xl font-semibold text-navy-950">
              <Link href={`/projects/${project.slug}`}>{project.title}</Link>
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted">{project.summary}</p>
            <ul aria-label="Technologies" className="mt-5 flex flex-wrap gap-2">
              {project.technologies.map((technology) => (
                <li
                  className="bg-blue-100 px-2.5 py-1 text-xs text-navy-800"
                  key={technology}
                >
                  {technology}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </>
  );
}
