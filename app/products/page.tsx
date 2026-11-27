import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { Boxes, Hotel } from "lucide-react";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { SectionHeading } from "@/components/ui/section-heading";
import { ButtonLink } from "@/components/ui/button-link";
import { CtaSection } from "@/components/ui/cta-section";
import { products } from "@/data/products";
import { pageMetadata } from "@/lib/seo";
import Image from "next/image";

export const metadata: Metadata = pageMetadata(
  "Products",
  "Explore StockFlow and STAYFLEX business software products from WEBNEX Technologies.",
  "/products",
);

export default function ProductsPage() {
  return (
    <>
      <PageHero
        eyebrow="Software products"
        title="Purpose-built software for everyday business operations."
        description="Explore our product portfolio for inventory, sales, and hospitality operations."
        image={{ src: "/images/software.webp", alt: "Business team reviewing software workflows" }}
      />
      <section className="py-16 sm:py-20">
        <Container>
          <div className="grid gap-6 lg:grid-cols-2">
            {products.map((product) => {
              const Icon = product.slug === "stockflow" ? Boxes : Hotel;
              return (
                <article className="overflow-hidden border border-border bg-white" key={product.slug}>
                  <div className="relative aspect-[16/8]">
                    <Image
                      alt={product.slug === "stockflow" ? "Inventory and point-of-sale workspace" : "Modern hotel operations and hospitality"}
                      className="object-cover"
                      fill
                      sizes="(max-width: 1024px) 100vw, 50vw"
                      src={product.slug === "stockflow" ? "/images/inventory.webp" : "/images/hotel.webp"}
                    />
                  </div>
                  <div className="p-7 sm:p-9">
                  <span className="grid size-12 place-items-center bg-blue-100 text-blue-700">
                    <Icon aria-hidden="true" size={24} />
                  </span>
                  <p className="mt-7 text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">{product.category}</p>
                  <h2 className="mt-3 text-3xl font-semibold text-navy-950">{product.name}</h2>
                  <p className="mt-4 max-w-xl leading-7 text-muted">{product.description}</p>
                  <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                    {product.capabilities.map((capability) => (
                      <li className="border-l-2 border-blue-700 pl-3 text-sm text-navy-800" key={capability}>{capability}</li>
                    ))}
                  </ul>
                  <ButtonLink className="mt-8" href={`/contact?interest=${product.slug}`}>
                    Enquire about {product.name} <ArrowRight aria-hidden="true" size={16} />
                  </ButtonLink>
                  </div>
                </article>
              );
            })}
          </div>
          <p className="mt-6 max-w-3xl text-sm leading-6 text-muted">
            Product descriptions provide a general overview. Specific features, integrations, hosting, implementation scope, and availability should be confirmed during a product discussion.
          </p>
        </Container>
      </section>
      <section className="bg-slate-50 py-16 sm:py-20">
        <Container className="grid gap-8 lg:grid-cols-[0.7fr_1.3fr] lg:items-end">
          <SectionHeading eyebrow="Product consultation" title="Explore the right fit for your operation." />
          <div>
            <p className="leading-7 text-muted">Tell us about your workflows, users, locations, integrations, and reporting needs. We will discuss whether an existing product or a tailored implementation is more suitable.</p>
            <ButtonLink className="mt-6" href="/contact" variant="secondary">Request a product consultation <ArrowRight aria-hidden="true" size={16} /></ButtonLink>
          </div>
        </Container>
      </section>
      <CtaSection />
    </>
  );
}
