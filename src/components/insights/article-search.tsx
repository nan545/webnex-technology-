"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { EmptyState } from "@/components/ui/empty-state";
import type { Article } from "@/data/articles";

export function ArticleSearch({ articles }: { articles: Article[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const categories = useMemo(
    () => [...new Set(articles.map((article) => article.category))],
    [articles],
  );
  const filtered = articles.filter((article) => {
    const matchesCategory = category === "all" || article.category === category;
    const haystack = `${article.title} ${article.excerpt} ${article.category}`;
    return matchesCategory && haystack.toLowerCase().includes(query.toLowerCase());
  });

  return (
    <>
      <div className="mb-8 grid gap-4 sm:grid-cols-[1fr_16rem]">
        <div>
          <label className="field-label" htmlFor="article-search">
            Search articles
          </label>
          <input
            className="field-control"
            id="article-search"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search insights"
            type="search"
            value={query}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="article-category">
            Category
          </label>
          <select
            className="field-control"
            id="article-category"
            onChange={(event) => setCategory(event.target.value)}
            value={category}
          >
            <option value="all">All categories</option>
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
      </div>
      {filtered.length === 0 ? (
        <EmptyState
          description={
            query
              ? "No published articles match that search. Try another term."
              : "No articles have been published yet. Insights will appear here after editorial content is approved."
          }
          title={query ? "No matching articles" : "Insights are coming soon"}
        />
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((article) => (
            <article className="border border-border p-6" key={article.slug}>
              {article.image ? <Image alt={article.image.alt} className="mb-5 aspect-video w-full object-cover" height={675} src={article.image.src} unoptimized width={1200} /> : null}
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                {article.category}
              </p>
              <h2 className="mt-3 text-xl font-semibold text-navy-950">
                <Link href={`/insights/${article.slug}`}>{article.title}</Link>
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted">{article.excerpt}</p>
              <p className="mt-5 text-xs text-muted">
                {new Date(article.publishedAt).toLocaleDateString("en-GH")} ·{" "}
                {article.readingMinutes} min read
              </p>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
