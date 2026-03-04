import { canWriteInventory } from "./roles";
import { listMembershipsForUser } from "./service";

export async function requireHouseholdMembership(userId: string, householdId: string) {
  const memberships = await listMembershipsForUser(userId);
  const membership = memberships.find((m) => m.household.id === householdId)?.membership;
  if (!membership) {
    throw new Error("Forbidden");
  }
  return membership;
}

export async function requireHouseholdWriteAccess(userId: string, householdId: string) {
  const membership = await requireHouseholdMembership(userId, householdId);
  if (!canWriteInventory(membership.role)) {
    throw new Error("Forbidden");
  }
  return membership;
}
