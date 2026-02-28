export const HOUSEHOLD_ROLES = ["owner", "admin", "member", "viewer"] as const;

export type HouseholdRole = (typeof HOUSEHOLD_ROLES)[number];

export const ROLE_ORDER: Record<HouseholdRole, number> = {
  owner: 3,
  admin: 2,
  member: 1,
  viewer: 0,
};

export function canWriteInventory(role: HouseholdRole | null | undefined) {
  return Boolean(role && ROLE_ORDER[role] >= ROLE_ORDER.member);
}

export function canManageMembers(role: HouseholdRole | null | undefined) {
  return Boolean(role && ROLE_ORDER[role] >= ROLE_ORDER.admin);
}

export function canManageHousehold(role: HouseholdRole | null | undefined) {
  return Boolean(role && ROLE_ORDER[role] >= ROLE_ORDER.admin);
}

export function isOwner(role: HouseholdRole | null | undefined) {
  return role === "owner";
}