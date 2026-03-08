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
  inviteHouseholdMemberFormAction,
  updateHouseholdLanguageFormAction,
  updateHouseholdMemberFormAction,
} from "@/lib/actions/householdSettings";
import {
  getHouseholdById,
  getUsageHints,
  listHouseholdMembers,
} from "@/lib/inventory/service";
import { withRlsUserContext } from "@/server/db/tenant";

export default async function HouseholdSettingsPage({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}) {
  const { locale, id: householdId } = await params;
  const context = await getInventoryContext(locale);
  const userId = context.user.id;

  const household = await withRlsUserContext(userId, async () =>
    getHouseholdById({
      userId,
      householdId,
    }),
  );

  if (!household) {
    return <div className="text-sm text-muted-foreground">Household not found.</div>;
  }

  const [usage, members] = await withRlsUserContext(userId, async () =>
    Promise.all([
      getUsageHints({ userId, householdId }),
      listHouseholdMembers({ userId, householdId }),
    ]),
  );
  const updateLanguageAction = updateHouseholdLanguageFormAction.bind(null, {
    locale,
    householdId,
  }) as unknown as (formData: FormData) => Promise<void>;
  const inviteAction = inviteHouseholdMemberFormAction.bind(null, {
    locale,
    householdId,
  }) as unknown as (formData: FormData) => Promise<void>;
  const updateRoleAction = updateHouseholdMemberFormAction.bind(null, {
    locale,
    householdId,
  }) as unknown as (formData: FormData) => Promise<void>;

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
                  <div className="font-medium">
                    {row.membership.invitedEmail ||
                      row.profile?.displayName ||
                      row.profile?.name ||
                      row.membership.userId}
                  </div>
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
