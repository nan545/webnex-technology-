"use client";

import { useState, type FormEvent } from "react";
import {
  navigationConfigurationSchema,
  publicNavigationPaths,
  type NavigationConfiguration,
} from "@/lib/validation/site-configuration";

type LinkItem = { label: string; href: string };
type EditableNavigation = { header: LinkItem[]; footer: LinkItem[] };

export function NavigationEditor({ initial }: { initial: NavigationConfiguration }) {
  const [navigation, setNavigation] = useState<EditableNavigation>(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function changeList(location: "header" | "footer", links: LinkItem[]) {
    setNavigation((current) => ({ ...current, [location]: links }));
    setMessage("");
    setError("");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    const parsed = navigationConfigurationSchema.safeParse(navigation);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Review the navigation links.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/admin/v1/navigation", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const result = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(result.error?.message ?? "Navigation could not be saved.");
      setNavigation(parsed.data);
      setMessage("Navigation saved. Refresh the public site to see the changes.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Navigation could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="space-y-6" onSubmit={save}>
      <p className="text-sm leading-6 text-muted">
        Changes are public when saved. Choose from existing site pages.
        The Services dropdown stays in the main navigation.
      </p>
      {(["header", "footer"] as const).map((location) => (
        <section className="space-y-4 border border-border bg-white p-5 sm:p-7" key={location}>
          <h2 className="font-semibold text-navy-950">
            {location === "header" ? "Main navigation" : "Footer navigation"}
          </h2>
          {navigation[location].map((item, index) => (
            <div className="grid gap-3 border border-border p-3 sm:grid-cols-[1fr_1fr_auto]" key={`${location}-${index}`}>
              <label className="text-sm font-medium">
                Label
                <input
                  className="field-control mt-1"
                  disabled={busy}
                  maxLength={40}
                  onChange={(event) => changeList(location, navigation[location].map((link, i) => i === index ? { ...link, label: event.target.value } : link))}
                  required
                  value={item.label}
                />
              </label>
              <label className="text-sm font-medium">
                Page
                <select
                  className="field-control mt-1"
                  disabled={busy}
                  onChange={(event) => changeList(location, navigation[location].map((link, i) => i === index ? { ...link, href: event.target.value } : link))}
                  required
                  value={item.href}
                >
                  <option value="">Select a page</option>
                  {publicNavigationPaths.filter((path) => location !== "header" || path !== "/services").map((path) => (
                    <option key={path} value={path}>{path === "/" ? "Home (/)" : path}</option>
                  ))}
                </select>
              </label>
              <div className="flex items-end gap-2">
                <button aria-label={`Move ${item.label || "link"} up`} className="min-h-11 border border-border px-3" disabled={busy || index === 0} onClick={() => {
                  const links = [...navigation[location]];
                  const previous = links[index - 1];
                  const current = links[index];
                  if (!previous || !current) return;
                  links[index - 1] = current;
                  links[index] = previous;
                  changeList(location, links);
                }} type="button">Up</button>
                <button aria-label={`Move ${item.label || "link"} down`} className="min-h-11 border border-border px-3" disabled={busy || index === navigation[location].length - 1} onClick={() => {
                  const links = [...navigation[location]];
                  const current = links[index];
                  const next = links[index + 1];
                  if (!current || !next) return;
                  links[index] = next;
                  links[index + 1] = current;
                  changeList(location, links);
                }} type="button">Down</button>
                <button aria-label={`Remove ${item.label || "link"}`} className="min-h-11 border border-red-200 px-3 text-red-800" disabled={busy || navigation[location].length <= 1} onClick={() => changeList(location, navigation[location].filter((_, i) => i !== index))} type="button">Remove</button>
              </div>
            </div>
          ))}
          <button className="button-secondary" disabled={busy || navigation[location].length >= 12} onClick={() => changeList(location, [...navigation[location], { label: "", href: "" }])} type="button">
            Add link
          </button>
        </section>
      ))}
      {error ? <p className="text-sm text-red-800" role="alert">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-800" role="status">{message}</p> : null}
      <button className="button-primary" disabled={busy} type="submit">{busy ? "Saving…" : "Save navigation"}</button>
    </form>
  );
}
