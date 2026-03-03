import { revalidatePath } from "next/cache";

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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SectionHeader } from "@/components/inventory/SectionHeader";
import { EmptyState } from "@/components/inventory/EmptyState";

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
      role: parsed.role,
    });

    try {
      const supabase = createSupabaseAdminClient();
      await supabase.auth.admin.inviteUserByEmail(parsed.email, {
        redirectTo: `${APP_URL}/${locale}/login`,
      });
    } catch (error) {
      console.error("Invite email failed", error);
    }

    revalidatePath(`/${locale}/households/${householdId}/settings`);
  }

  async function updateMemberAction(formData: FormData) {
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
      role: parsed.role,
      status: parsed.status,
    });

    revalidatePath(`/${locale}/households/${householdId}/settings`);
  }

  const [members, usage] = await Promise.all([
    listHouseholdMembers({ userId: context.user.id, householdId }),
    getUsageHints({ userId: context.user.id, householdId }),
  ]);

  async function updateLanguageAction(formData: FormData) {
    "use server";
    const parsed = updateHouseholdLanguageSchema.parse({
      householdId,
      language: String(formData.get("language") || ""),
    });

    await updateHouseholdLanguage({
      userId: context.user.id,
      householdId: parsed.householdId,
      language: parsed.language,
    });

    revalidatePath(`/${locale}/households/${householdId}/settings`);
  }

  return (
    <div className="space-y-4">
      <Card className="border border-primary/15 bg-gradient-to-br from-primary/10 via-background to-background transition hover:shadow-lg hover:-translate-y-[1px]">
        <CardHeader>
          <SectionHeader title={`${household.name} · Settings`} />
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-md border p-3 text-sm">
            <div className="text-muted-foreground">Containers</div>
            <div className="text-lg font-semibold">{usage.containers}</div>
          </div>
          <div className="rounded-md border p-3 text-sm">
            <div className="text-muted-foreground">Items</div>
            <div className="text-lg font-semibold">{usage.items}</div>
          </div>
          <div className="rounded-md border p-3 text-sm">
            <div className="text-muted-foreground">Estimated storage</div>
            <div className="text-lg font-semibold">{usage.estimatedStorageMb} MB</div>
          </div>
          <form action={updateLanguageAction} className="rounded-md border p-3 text-sm grid gap-2 bg-muted/40 transition hover:shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-muted-foreground">Language</div>
                <div className="text-xs text-muted-foreground">
                  Affects AI suggestions + default labels
                </div>
              </div>
              <Select name="language" defaultValue={household.language || "en"}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="sv">Svenska</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end">
              <Button type="submit" size="sm">
                Save
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

        <Card className="transition hover:shadow-md">
        <CardHeader>
          <SectionHeader title="Invite member" />
        </CardHeader>
        <CardContent className="bg-muted/40 rounded-md border">
          <form action={inviteAction} className="grid gap-2 md:grid-cols-[1fr_160px_auto]">
            <Input type="email" name="email" placeholder="partner@example.com" required />
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
        </CardContent>
      </Card>

        <Card className="transition hover:shadow-md">
        <CardHeader>
          <SectionHeader title="Members" />
        </CardHeader>
        <CardContent className="space-y-2">
          {members.length === 0 ? (
            <EmptyState
              title="No members yet"
              description="Invite a partner or family member to collaborate."
            />
          ) : (
            members.map((row) => (
              <form
                key={row.membership.id}
                action={updateMemberAction}
                className="grid items-center gap-2 rounded-md border p-3 md:grid-cols-[1fr_130px_130px_auto]"
              >
                <input type="hidden" name="memberId" value={row.membership.id} />
                <div>
                  <div className="font-medium">
                    {row.profile?.displayName ||
                      row.profile?.name ||
                      row.membership.invitedEmail ||
                      row.membership.userId}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {row.membership.userId || row.membership.invitedEmail || "invited"}
                  </div>
                </div>
                <Select name="role" defaultValue={row.membership.role}>
                  <SelectTrigger>
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
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="invited">invited</SelectItem>
                    <SelectItem value="active">active</SelectItem>
                    <SelectItem value="removed">removed</SelectItem>
                  </SelectContent>
                </Select>
                <Button type="submit" size="sm" variant="outline">
                  Update
                </Button>
              </form>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
