"use client";

import { useRef, useState, type FormEvent } from "react";
import { submitEnquiry } from "@/lib/api/enquiries";
import { enquirySchema } from "@/lib/validation/enquiries";

type FormValues = {
  fullName: string;
  email: string;
  phone: string;
  company: string;
  service: string;
  budget: string;
  description: string;
  preferredContact: string;
  website: string;
};
type FormStatus = "idle" | "submitting" | "unavailable" | "success";

const initialValues: FormValues = {
  fullName: "",
  email: "",
  phone: "",
  company: "",
  service: "",
  budget: "",
  description: "",
  preferredContact: "",
  website: "",
};

const fields = {
  web: [
    { value: "web-development", label: "Web Development" },
    { value: "custom-software-development", label: "Custom Software Development" },
    { value: "mobile-application-development", label: "Mobile Application Development" },
    { value: "ai-and-business-automation", label: "AI and Business Automation" },
    { value: "cloud-and-infrastructure-solutions", label: "Cloud and Infrastructure Solutions" },
    { value: "ui-ux-design", label: "UI/UX Design" },
    { value: "technology-consulting", label: "Technology Consulting" },
    { value: "other", label: "Other" },
  ],
  contacts: ["Email", "Phone", "Either"],
};

export function EnquiryForm() {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>>>({});
  const [status, setStatus] = useState<FormStatus>("idle");
  const [message, setMessage] = useState("");
  const [reference, setReference] = useState("");
  const [whatsappConsent, setWhatsappConsent] = useState(false);
  const idempotencyKey = useRef<string | null>(null);

  function updateField(name: keyof FormValues, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
    idempotencyKey.current = null;
    setReference("");
    setMessage("");
    if (status !== "idle") setStatus("idle");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = enquirySchema.safeParse({ ...values, whatsappConsent });

    if (!result.success) {
      const nextErrors: Partial<Record<keyof FormValues, string>> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string" && key in initialValues) {
          nextErrors[key as keyof FormValues] = issue.message;
        }
      }
      setErrors(nextErrors);
      setStatus("idle");
      document.getElementById(Object.keys(nextErrors)[0] ?? "fullName")?.focus();
      return;
    }

    setErrors({});
    setStatus("submitting");
    setMessage("");

    try {
      idempotencyKey.current ??= crypto.randomUUID();
      const saved = await submitEnquiry(result.data, idempotencyKey.current);
      setReference(saved.reference);
      setMessage(
        "Your enquiry is saved. Email notification delivery is pending provider configuration.",
      );
      idempotencyKey.current = null;
      setValues(initialValues);
      setWhatsappConsent(false);
      setStatus("success");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The enquiry service is unavailable. Your request was not confirmed.",
      );
      setStatus("unavailable");
    }
  }

  return (
    <form className="space-y-6" noValidate onSubmit={handleSubmit}>
      <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
        <label htmlFor="website">Leave this field empty</label>
        <input
          autoComplete="off"
          id="website"
          name="website"
          onChange={(event) => updateField("website", event.target.value)}
          tabIndex={-1}
          value={values.website}
        />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          autoComplete="name"
          errors={errors}
          label="Full name"
          name="fullName"
          onChange={updateField}
          required
          value={values.fullName}
        />
        <Field
          autoComplete="email"
          errors={errors}
          label="Email address"
          name="email"
          onChange={updateField}
          required
          type="email"
          value={values.email}
        />
        <Field
          autoComplete="tel"
          errors={errors}
          label="Phone number"
          name="phone"
          onChange={updateField}
          type="tel"
          value={values.phone}
        />
        <Field
          autoComplete="organization"
          errors={errors}
          label="Company name"
          name="company"
          onChange={updateField}
          value={values.company}
        />
        <SelectField
          errors={errors}
          label="Service required"
          name="service"
          onChange={updateField}
          options={fields.web.map(({ value, label }) => ({ value, label }))}
          required
          value={values.service}
        />
        <Field
          errors={errors}
          label="Estimated project budget (optional)"
          name="budget"
          onChange={updateField}
          placeholder="Share a range and currency if known"
          value={values.budget}
        />
      </div>

      <div>
        <label className="field-label" htmlFor="description">
          Project description <span className="text-blue-700">*</span>
        </label>
        <textarea
          aria-describedby={errors.description ? "description-error" : undefined}
          aria-invalid={Boolean(errors.description)}
          className="field-control min-h-36 resize-y"
          id="description"
          maxLength={5000}
          name="description"
          onChange={(event) => updateField("description", event.target.value)}
          required
          value={values.description}
        />
        {errors.description ? (
          <FieldError id="description-error">{errors.description}</FieldError>
        ) : null}
      </div>

      <SelectField
        errors={errors}
        label="Preferred contact method"
        name="preferredContact"
        onChange={updateField}
        options={fields.contacts.map((label) => ({ value: label, label }))}
        required
        value={values.preferredContact}
      />
      <label className="flex items-start gap-3 text-sm leading-6 text-muted">
        <input
          checked={whatsappConsent}
          className="mt-1 size-4 accent-blue-700"
          onChange={(event) => {
            setWhatsappConsent(event.target.checked);
            idempotencyKey.current = null;
            setReference("");
            setMessage("");
            if (status !== "idle") setStatus("idle");
          }}
          type="checkbox"
        />
        <span>
          I agree that WEBNEX Technologies may contact me about this enquiry using WhatsApp.
          This is optional and does not subscribe me to marketing messages.
        </span>
      </label>

      <div aria-live="polite" className="min-h-6">
        {status === "unavailable" ? (
          <p className="text-sm font-medium text-red-800" role="alert">
            {message || "Your request was not confirmed. Please try again later."}
          </p>
        ) : null}
        {status === "success" ? (
          <p className="text-sm font-medium text-green-800" role="status">
            {message} Reference: {reference}.
          </p>
        ) : null}
      </div>

      <button
        className="button-primary min-w-44 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={status === "submitting"}
        type="submit"
      >
        {status === "submitting" ? "Sending…" : "Send project enquiry"}
      </button>
      <p className="text-xs leading-5 text-muted">
        Your details are submitted securely for follow-up. Email notifications
        will be enabled after the company selects and configures a provider.
      </p>
    </form>
  );
}

function Field({
  name,
  label,
  value,
  onChange,
  errors,
  required = false,
  type = "text",
  autoComplete,
  placeholder,
}: {
  name: keyof FormValues;
  label: string;
  value: string;
  onChange: (name: keyof FormValues, value: string) => void;
  errors: Partial<Record<keyof FormValues, string>>;
  required?: boolean;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
}) {
  const errorId = `${name}-error`;
  const error = errors[name];
  return (
    <div>
      <label className="field-label" htmlFor={name}>
        {label} {required ? <span className="text-blue-700">*</span> : null}
      </label>
      <input
        aria-describedby={error ? errorId : undefined}
        aria-invalid={Boolean(error)}
        autoComplete={autoComplete}
        className="field-control"
        id={name}
        name={name}
        onChange={(event) => onChange(name, event.target.value)}
        placeholder={placeholder}
        required={required}
        type={type}
        value={value}
      />
      {error ? <FieldError id={errorId}>{error}</FieldError> : null}
    </div>
  );
}

function SelectField({
  name,
  label,
  value,
  onChange,
  errors,
  options,
  required = false,
}: {
  name: keyof FormValues;
  label: string;
  value: string;
  onChange: (name: keyof FormValues, value: string) => void;
  errors: Partial<Record<keyof FormValues, string>>;
  options: { value: string; label: string }[];
  required?: boolean;
}) {
  const errorId = `${name}-error`;
  const error = errors[name];
  return (
    <div>
      <label className="field-label" htmlFor={name}>
        {label} {required ? <span className="text-blue-700">*</span> : null}
      </label>
      <select
        aria-describedby={error ? errorId : undefined}
        aria-invalid={Boolean(error)}
        className="field-control"
        id={name}
        name={name}
        onChange={(event) => onChange(name, event.target.value)}
        required={required}
        value={value}
      >
        <option value="">Select an option</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? <FieldError id={errorId}>{error}</FieldError> : null}
    </div>
  );
}

function FieldError({ id, children }: { id: string; children: string }) {
  return (
    <p className="mt-1.5 text-sm text-red-800" id={id}>
      {children}
    </p>
  );
}
