import type { Metadata } from "next";
import { Mail, MapPin, MessageSquareText, Phone } from "lucide-react";
import { BusinessWhatsAppLink } from "@/components/contact/business-whatsapp-link";
import { EnquiryForm } from "@/components/contact/enquiry-form";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { pageMetadata } from "@/lib/seo";
import { readContactPhone } from "@/server/content/site-configuration";

export const metadata: Metadata = pageMetadata(
  "Contact",
  "Tell WEBNEX Technologies about your project using the enquiry form.",
  "/contact",
);

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ interest?: string }>;
}) {
  const phone = await readContactPhone();
  const { interest } = await searchParams;
  return (
    <>
      <PageHero
        description="Share what you are planning, what you need to solve, and where you are in the process. We will publish direct contact details once they are confirmed."
        eyebrow="Contact"
        title="Let’s talk about what you want to build."
        image={{ src: "/images/contact.webp", alt: "Professional conversation and project planning" }}
      />
      <section className="py-16 sm:py-20">
        <Container className="grid gap-12 lg:grid-cols-[0.7fr_1.3fr] lg:gap-20">
          <aside>
            <h2 className="text-xl font-semibold text-navy-950">
              Start with a conversation.
            </h2>
            <p className="mt-4 leading-7 text-muted">
              A useful first discussion begins with the business need, the
              people affected, and what a good outcome would look like.
            </p>
            <ul className="mt-8 space-y-5">
              <li className="flex gap-3">
                <MapPin aria-hidden="true" className="mt-0.5 shrink-0 text-blue-700" size={19} />
                <span className="text-sm leading-6 text-muted">
                  Ghana-first, with an international outlook.
                </span>
              </li>
              <li className="flex gap-3">
                <Mail aria-hidden="true" className="mt-0.5 shrink-0 text-blue-700" size={19} />
                <span className="text-sm leading-6 text-muted">
                  Direct email details will be added after they are confirmed.
                </span>
              </li>
              {phone ? (
                <li className="flex gap-3">
                  <Phone aria-hidden="true" className="mt-0.5 shrink-0 text-blue-700" size={19} />
                  <a className="text-sm leading-6 text-blue-700 hover:text-navy-950" href={`tel:${phone.replace(/[^\d+]/g, "")}`}>
                    {phone}
                  </a>
                </li>
              ) : null}
              <li className="flex gap-3">
                <MessageSquareText aria-hidden="true" className="mt-0.5 shrink-0 text-blue-700" size={19} />
                <span className="text-sm leading-6 text-muted">
                  Enquiries are saved when the service is available. A confirmation
                  appears after your submission has been saved.
                </span>
              </li>
            </ul>
            <BusinessWhatsAppLink />
          </aside>
          <div className="border border-border bg-white p-6 sm:p-8">
            <h2 className="text-xl font-semibold text-navy-950">
              Project enquiry
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Fields marked with an asterisk are required. Do not include
              passwords, payment information, or other sensitive data.
            </p>
            <div className="mt-7">
              <EnquiryForm initialInterest={interest} />
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}

export const dynamic = "force-dynamic";
