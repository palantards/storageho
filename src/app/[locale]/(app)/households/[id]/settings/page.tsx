import { revalidatePath } from "next/cache";

import { EmptyState } from "@/components/inventory/EmptyState";
import { PageFrame } from "@/components/inventory/PageFrame";
import { SectionDivider } from "@/components/inventory/SectionDivider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Locale } from "@/i18n/config";
import { getInventoryContext } from "@/lib/inventory/page-context";
import {
  getHouseholdById,
  getUsageHints,
  inviteMember,
  listHouseholdMembers,
  updateHouseholdLanguage,
  updateMemberRole,
} from "@/lib/inventory/service";
import {
  inviteMemberSchema,
  updateHouseholdLanguageSchema,
  updateMemberRoleSchema,
} from "@/lib/inventory/validation";
import { createSupabaseAdminClient } from "@/lib/supabaseServer";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  "http://localhost:3000";

export default async function HouseholdSettingsPage({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}) {
  const { locale, id: householdId } = await params;
  const context = await getInventoryContext(locale);

  const household = await getHouseholdById({
    userId: context.user.id,
    householdId,
  });

  if (!household) {
    return <div className="text-sm text-muted-foreground">Household not found.</div>;
  }

  const usage = await getUsageHints({ userId: context.user.id, householdId });
  const members = await listHouseholdMembers({ userId: context.user.id, householdId });

  async function updateLanguageAction(formData: FormData) {
    "use server";
    const parsed = updateHouseholdLanguageSchema.parse({
      householdId,
      language: String(formData.get("language") || "en"),
    });
    await updateHouseholdLanguage({
      userId: context.user.id,
      householdId: parsed.householdId,
      language: parsed.language,
    });
    revalidatePath(`/${locale}/households/${householdId}/settings`);
  }

  async function inviteAction(formData: FormData) {
    "use server";
    const parsed = inviteMemberSchema.parse({
      householdId,
      email: String(formData.get("email") || ""),
      role: String(formData.get("role") || "viewer"),
    });
    await inviteMember({
      userId: context.user.id,
      householdId: parsed.householdId,
      email: parsed.email,
      role: parsed.role as "viewer" | "member" | "admin" | "owner",
      appUrl: APP_URL,
      supabaseAdmin: createSupabaseAdminClient(),
    });
    revalidatePath(`/${locale}/households/${householdId}/settings`);
  }

  async function updateRoleAction(formData: FormData) {
    "use server";
    const parsed = updateMemberRoleSchema.parse({
      householdId,
      memberId: String(formData.get("memberId") || ""),
      role: String(formData.get("role") || "member"),
      status: String(formData.get("status") || "active"),
    });
    await updateMemberRole({
      userId: context.user.id,
      householdId: parsed.householdId,
      memberId: parsed.memberId,
      role: parsed.role as "viewer" | "member" | "admin" | "owner",
      status: parsed.status as "active" | "invited" | "removed",
    });
    revalidatePath(`/${locale}/households/${householdId}/settings`);
  }

  return (
    <PageFrame className="space-y-6">
      <div>
        <div className="text-2xl font-semibold">Household settings</div>
        <div className="text-sm text-muted-foreground">{household.name}</div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
        {[
          { label: "Containers", value: usage.containers },
          { label: "Items", value: usage.items },
          { label: "Photos", value: usage.photos },
          { label: "Members", value: members.length },
        ].map((metric) => (
          <div key={metric.label} className="rounded-md border bg-muted/40 p-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{metric.label}</div>
            <div className="text-xl font-semibold">{metric.value}</div>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <SectionDivider title="Language" />
        <form action={updateLanguageAction} className="flex flex-wrap items-center gap-3">
          <Select name="language" defaultValue={household.language || locale}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Language" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="sv">Svenska</SelectItem>
            </SelectContent>
          </Select>
          <Button type="submit">Save</Button>
        </form>
      </div>

      <div className="space-y-3">
        <SectionDivider title="Invite member" />
        <form action={inviteAction} className="grid gap-2 md:grid-cols-[2fr_1fr_auto]">
          <Input name="email" type="email" placeholder="partner@example.com" required />
          <Select name="role" defaultValue="viewer">
            <SelectTrigger>
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="viewer">viewer</SelectItem>
              <SelectItem value="member">member</SelectItem>
              <SelectItem value="admin">admin</SelectItem>
            </SelectContent>
          </Select>
          <Button type="submit">Send invite</Button>
        </form>
      </div>

      <div className="space-y-3">
        <SectionDivider title="Members" />
        {members.length === 0 ? (
          <EmptyState
            title="No members"
            description="Invite teammates or partners to collaborate on this household."
          />
        ) : (
          <div className="space-y-2">
            {members.map((row) => (
              <form
                key={row.membership.id}
                action={updateRoleAction}
                className="flex flex-wrap items-center gap-2 rounded-md border p-3"
              >
                <div className="min-w-[200px]">
                  <div className="font-medium">{row.user?.email || row.membership.invitedEmail}</div>
                  <div className="text-xs text-muted-foreground">{row.membership.status}</div>
                </div>
                <input type="hidden" name="memberId" value={row.membership.id} />
                <Select name="role" defaultValue={row.membership.role}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="viewer">viewer</SelectItem>
                    <SelectItem value="member">member</SelectItem>
                    <SelectItem value="admin">admin</SelectItem>
                    <SelectItem value="owner">owner</SelectItem>
                  </SelectContent>
                </Select>
                <Select name="status" defaultValue={row.membership.status}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="invited">invited</SelectItem>
                    <SelectItem value="active">active</SelectItem>
                    <SelectItem value="removed">removed</SelectItem>
                  </SelectContent>
                </Select>
                <Button type="submit" variant="outline" size="sm">
                  Update
                </Button>
              </form>
            ))}
          </div>
        )}
      </div>
    </PageFrame>
  );
}
