"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type MembershipOption = {
  householdId: string;
  householdName: string;
  role: string;
};

export function HouseholdSwitcher({
  activeHouseholdId,
  memberships,
}: {
  activeHouseholdId?: string;
  memberships: MembershipOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (!memberships.length) {
    return null;
  }

  return (
    <Select
      defaultValue={activeHouseholdId || memberships[0]?.householdId}
      onValueChange={(nextHouseholdId) => {
        startTransition(async () => {
          await fetch("/api/households/active", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ householdId: nextHouseholdId }),
          });
          router.refresh();
        });
      }}
      disabled={pending}
    >
      <SelectTrigger className="h-8 w-52 text-xs">
        <SelectValue placeholder="Select household" />
      </SelectTrigger>
      <SelectContent>
        {memberships.map((membership) => (
          <SelectItem key={membership.householdId} value={membership.householdId}>
            {membership.householdName} ({membership.role})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}