import SupportForm from "@/components/support/SupportForm";
import { getMessages } from "@/i18n/getMessages";
import { t as tt } from "@/i18n/translate";
import { getSession } from "@/lib/auth";
import { Locale } from "@/i18n/config";
import { getPublicTicketsPage } from "@/lib/support";
import OngoingTicketsBoard from "@/components/support/OngoingTicketBoard";
import Support from "@/components/support/Support";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@radix-ui/react-tabs";

const PRELOAD = 10;

export default async function SupportPage({
  params,
}: {
  params: { locale: Locale };
}) {
  const { locale } = params;
  const messages = await getMessages(locale);
  const t = (key: string, vars?: Record<string, string | number>) =>
    tt(messages, key, vars);

  const session = await getSession();
  const viewerUserId = session?.user?.id;

  const [suggestions, bugs] = await Promise.all([
    getPublicTicketsPage({
      category: "suggestion",
      limit: PRELOAD,
      viewerUserId,
    }),
    getPublicTicketsPage({ category: "bug", limit: PRELOAD, viewerUserId }),
  ]);

  return (
    <Tabs
      defaultValue="submit"
      className="w-full mx-auto max-w-7xl px-4 py-8 md:py-16"
    >
      <TabsList className="grid grid-cols-2 w-full bg-muted rounded-lg border border-border h-auto">
        <TabsTrigger
          value="submit"
          className="w-full px-6  text-md font-medium leading-none min-h-[3.25rem] text-center transition-colors duration-200 data-[state=active]:bg-background data-[state=active]:text-primary focus:outline-none"
        >
          ✉ {t("support.contactSupport")}
        </TabsTrigger>
        <TabsTrigger
          value="feedback"
          className="w-full px-6 text-md font-medium leading-none min-h-[3.25rem] text-center transition-colors duration-200 data-[state=active]:bg-background data-[state=active]:text-primary focus:outline-none"
        >
          🗳️ {t("support.tickets")}
        </TabsTrigger>
      </TabsList>

      <div className="mt-6">
        <TabsContent value="submit">
          <Support />
        </TabsContent>
        <TabsContent value="feedback">
          <OngoingTicketsBoard
            session={session}
            initial={{
              suggestion: suggestions,
              bug: bugs,
            }}
          />
        </TabsContent>
      </div>
    </Tabs>
  );
}
