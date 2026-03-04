import { HOUSEHOLD_ROLES } from "@/lib/inventory/roles";
import { z } from "zod";

export const householdRoleSchema = z.enum(HOUSEHOLD_ROLES);

export const createHouseholdSchema = z.object({
  name: z.string().trim().min(2).max(120),
});

export const createLocationSchema = z.object({
  householdId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional(),
});

export const createRoomSchema = z.object({
  householdId: z.string().uuid(),
  locationId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional(),
});

export const createContainerSchema = z.object({
  householdId: z.string().uuid(),
  roomId: z.string().uuid(),
  parentContainerId: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(1).max(150),
  code: z.string().trim().max(80).optional(),
  description: z.string().trim().max(2000).optional(),
});

export const createContainerPathSchema = z.object({
  householdId: z.string().uuid(),
  roomId: z.string().uuid(),
  rootParentContainerId: z.string().uuid().nullable().optional(),
  path: z.string().trim().min(1).max(500),
});

export const quickCreateLocationPathSchema = z.object({
  householdId: z.string().uuid(),
  locationId: z.string().uuid(),
  path: z.string().trim().min(3).max(500),
  code: z.string().trim().max(80).optional(),
  description: z.string().trim().max(2000).optional(),
});

export const archiveContainerSchema = z.object({
  householdId: z.string().uuid(),
  containerId: z.string().uuid(),
  archived: z.boolean(),
});

export const deleteEntitySchema = z.object({
  householdId: z.string().uuid(),
  id: z.string().uuid(),
});

export const householdFloorSchema = z.object({
  householdId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  sortOrder: z.number().int().min(0).max(10000).optional(),
});

export const householdFloorUpdateSchema = z.object({
  householdId: z.string().uuid(),
  floorId: z.string().uuid(),
  name: z.string().trim().min(1).max(120).optional(),
  sortOrder: z.number().int().min(0).max(10000).optional(),
});

export const createRoomFromSetupSchema = z.object({
  householdId: z.string().uuid(),
  floorId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional(),
});

export const createContainerFromSetupSchema = z.object({
  householdId: z.string().uuid(),
  floorId: z.string().uuid(),
  roomId: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(1).max(150),
  code: z.string().trim().max(80).optional(),
  description: z.string().trim().max(2000).optional(),
});

export const listRoomsSchema = z.object({
  householdId: z.string().uuid(),
  locationId: z.string().uuid().optional(),
  includeSystem: z.boolean().optional(),
  limit: z.number().int().min(1).max(2000).optional(),
});

export const createItemSchema = z.object({
  householdId: z.string().uuid(),
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).optional(),
  barcode: z.string().trim().max(120).optional(),
  serialNumber: z.string().trim().max(120).optional(),
  aliases: z.array(z.string().trim().min(1).max(120)).default([]),
  tagIds: z.array(z.string().uuid()).default([]),
});

export const setContainerItemSchema = z.object({
  householdId: z.string().uuid(),
  containerId: z.string().uuid(),
  itemId: z.string().uuid(),
  quantity: z.number().int().min(1).max(100000),
  note: z.string().trim().max(2000).optional(),
});

export const moveContainerItemSchema = z.object({
  householdId: z.string().uuid(),
  itemId: z.string().uuid(),
  fromContainerId: z.string().uuid(),
  toContainerId: z.string().uuid(),
  quantity: z.number().int().min(1).max(100000),
  note: z.string().trim().max(2000).optional(),
});

export const tagSchema = z.object({
  householdId: z.string().uuid(),
  name: z.string().trim().min(1).max(40),
  color: z.string().trim().regex(/^#?[0-9A-Fa-f]{3,8}$/).optional(),
});

export const inviteMemberSchema = z.object({
  householdId: z.string().uuid(),
  email: z.string().trim().email().max(254),
  role: householdRoleSchema,
});

export const updateHouseholdLanguageSchema = z.object({
  householdId: z.string().uuid(),
  language: z.string().trim().min(2).max(10),
});

export const updateMemberRoleSchema = z.object({
  householdId: z.string().uuid(),
  memberId: z.string().uuid(),
  role: householdRoleSchema,
  status: z.enum(["invited", "active", "removed"]).optional(),
});

export const searchSchema = z.object({
  householdId: z.string().uuid(),
  query: z.string().trim().min(1).max(120),
  limit: z.number().int().min(1).max(100).default(30),
  offset: z.number().int().min(0).default(0),
});


