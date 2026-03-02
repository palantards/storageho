"use client";

import { useI18n } from "../i18n/I18nProvider";
import SupportForm from "./SupportForm";

export default function Support() {
  const { t, m } = useI18n();
  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight">
        {t("support.contactSupport")}
      </h1>
      <p className="mt-2 text-muted-foreground">
        {t("support.contactSupportDescription")}
      </p>
      <div className="mt-10"></div>
      <SupportForm />
    </>
  );
}

