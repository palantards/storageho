ALTER TABLE "support_requests" ADD COLUMN "ticket_id" uuid;--> statement-breakpoint
ALTER TABLE "support_requests" ADD CONSTRAINT "support_requests_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "support_ticket_id_idx" ON "support_requests" USING btree ("ticket_id");