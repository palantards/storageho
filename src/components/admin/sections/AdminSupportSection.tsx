import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AdminTicketsSection } from "./AdminTicketsSection";
import { AdminSupportInboxSection } from "./AdminSupportInboxSection";

export function AdminSupportAndTickets() {
  return (
    <Tabs defaultValue="inbox" className="w-full">
      <TabsList className="grid grid-cols-2 w-full bg-muted rounded-lg border border-border h-auto">
        <TabsTrigger className="py-4 text-base" value="inbox">
          Support inbox
        </TabsTrigger>
        <TabsTrigger className="py-4 text-base" value="tickets">
          Tickets
        </TabsTrigger>
      </TabsList>

      <TabsContent value="inbox" className="mt-6">
        <AdminSupportInboxSection />
      </TabsContent>

      <TabsContent value="tickets" className="mt-6">
        <AdminTicketsSection />
      </TabsContent>
    </Tabs>
  );
}

