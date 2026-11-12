import "server-only";
import { randomBytes } from "node:crypto";
import { ContactPreference, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db";
import type { EnquiryInput } from "@/lib/validation/enquiries";

function createReference() {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const suffix = randomBytes(6).toString("hex").toUpperCase();
  return `WNX-${date}-${suffix}`;
}

export async function createEnquiry(input: EnquiryInput, idempotencyKey: string) {
  const existing = await prisma.enquiry.findUnique({
    where: { idempotencyKey },
    select: { reference: true, createdAt: true },
  });
  if (existing) return { ...existing, duplicate: true };

  const contactMethod: Record<EnquiryInput["preferredContact"], ContactPreference> = {
    Email: ContactPreference.EMAIL,
    Phone: ContactPreference.PHONE,
    Either: ContactPreference.EITHER,
  };

  try {
    const enquiry = await prisma.$transaction(async (transaction) => {
      const created = await transaction.enquiry.create({
        data: {
          reference: createReference(),
          name: input.fullName,
          email: input.email,
          phone: input.phone || null,
          organization: input.company || null,
          service: input.service,
          budget: input.budget || null,
          preferredContact: contactMethod[input.preferredContact],
          message: input.description,
          sourcePath: "/contact",
          idempotencyKey,
          whatsappConsentAt: input.whatsappConsent ? new Date() : null,
        },
        select: { id: true, reference: true, createdAt: true },
      });

      await transaction.notificationOutbox.create({
        data: {
          enquiryId: created.id,
          event: "ENQUIRY_RECEIVED",
          payload: { reference: created.reference },
        },
      });
      await transaction.notificationOutbox.create({
        data: {
          enquiryId: created.id,
          event: "ENQUIRY_ACKNOWLEDGEMENT",
          payload: { reference: created.reference },
        },
      });
      await transaction.enquiryActivity.create({
        data: {
          enquiryId: created.id,
          type: "ENQUIRY_RECEIVED",
          description: "Enquiry submitted through the website.",
        },
      });

      return created;
    });

    return { ...enquiry, duplicate: false };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const duplicate = await prisma.enquiry.findUnique({
        where: { idempotencyKey },
        select: { reference: true, createdAt: true },
      });
      if (duplicate) return { ...duplicate, duplicate: true };
    }

    throw error;
  }
}
