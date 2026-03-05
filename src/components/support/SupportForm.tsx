"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { FormFieldError, FormSubmitError } from "@/components/ui/form-feedback";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "../i18n/I18nProvider";
import { useBusyCursor } from "@/hooks/useBusyCursor";

export default function SupportForm() {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    subject?: string;
    message?: string;
  }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const { t } = useI18n();

  useBusyCursor(loading);

  useEffect(() => {
    if (!formError) return;
    toast.error(formError);
  }, [formError]);

  async function onSubmit(formData: FormData) {
    setLoading(true);
    setFormError(null);

    const payload = {
      email: String(formData.get("email") || "").trim(),
      subject: String(formData.get("subject") || "").trim(),
      message: String(formData.get("message") || "").trim(),
    };

    const nextFieldErrors: {
      email?: string;
      subject?: string;
      message?: string;
    } = {};
    if (!payload.email) nextFieldErrors.email = "Email is required.";
    if (!payload.subject) nextFieldErrors.subject = "Subject is required.";
    if (!payload.message) nextFieldErrors.message = "Message is required.";

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      setLoading(false);
      return;
    }
    setFieldErrors({});

    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error((await res.json()).error || "Request failed");
      }

      setDone(true);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      setFormError(message);
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Thank you</CardTitle>
          <CardDescription>{t("support.sent")}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("support.sendMessage")}</CardTitle>
        <CardDescription>{t("support.responseTime")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-1">
            <label className="text-sm font-medium">Email</label>
            <Input
              name="email"
              type="email"
              required
              placeholder="you@example.com"
              aria-invalid={fieldErrors.email ? true : undefined}
              onChange={() => {
                if (!fieldErrors.email) return;
                setFieldErrors((prev) => ({ ...prev, email: undefined }));
              }}
            />
            <FormFieldError error={fieldErrors.email} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">{t("support.subject")}</label>
            <Input
              name="subject"
              required
              placeholder={t("support.yourQuestion")}
              aria-invalid={fieldErrors.subject ? true : undefined}
              onChange={() => {
                if (!fieldErrors.subject) return;
                setFieldErrors((prev) => ({ ...prev, subject: undefined }));
              }}
            />
            <FormFieldError error={fieldErrors.subject} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">{t("support.message")}</label>
            <Textarea
              name="message"
              rows={6}
              required
              placeholder={t("support.describeIssue")}
              aria-invalid={fieldErrors.message ? true : undefined}
              onChange={() => {
                if (!fieldErrors.message) return;
                setFieldErrors((prev) => ({ ...prev, message: undefined }));
              }}
            />
            <FormFieldError error={fieldErrors.message} />
          </div>
          <FormSubmitError error={formError} title="Could not send support request" />
          <Button
            type="submit"
            className="mt-4 w-full"
            loading={loading}
            loadingText="Sending..."
          >
            Send
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
