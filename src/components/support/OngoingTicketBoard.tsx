"use client";

import type { Session } from "@/lib/auth";
import { TicketColumn } from "./TicketColumn";
import { TicketsPage } from "@/lib/support";
import { useI18n } from "../i18n/I18nProvider";

export default function OngoingTicketsBoard({
  initial,
  session,
}: {
  session: Session | null;
  initial: {
    suggestion: TicketsPage;
    bug: TicketsPage;
  };
}) {
  const { t } = useI18n();
  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          🗳️ {t("support.tickets")}
        </h1>
        <p className="text-muted-foreground">
          {t("support.roadmapDescription")}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border bg-muted/20 p-4">
          <TicketColumn
            title={t("support.suggestions")}
            category="suggestion"
            session={session}
            initialPage={initial.suggestion}
          />
        </div>

        <div className="rounded-xl border bg-muted/20 p-4">
          <TicketColumn
            title={t("support.bugs")}
            category="bug"
            session={session}
            initialPage={initial.bug}
          />
        </div>
      </div>
    </section>
  );
}
