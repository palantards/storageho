import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/pg-core";

export const webhookStatusEnum = pgEnum("webhook_status", [
  "processed",
  "ignored",
  "failed",
]);

export const supportStatusEnum = pgEnum("support_status", ["open", "closed"]);

export const householdRoleEnum = pgEnum("household_role", [
  "owner",
  "admin",
  "member",
  "viewer",
]);

export const membershipStatusEnum = pgEnum("membership_status", [
  "invited",
  "active",
  "removed",
]);

export const containerStatusEnum = pgEnum("container_status", [
  "active",
  "archived",
]);

export const photoEntityTypeEnum = pgEnum("photo_entity_type", [
  "container",
  "item",
]);

export const activityEntityTypeEnum = pgEnum("activity_entity_type", [
  "household",
  "location",
  "room",
  "container",
  "item",
  "photo",
  "membership",
  "tag",
  "container_item",
]);

export const activityActionTypeEnum = pgEnum("activity_action_type", [
  "created",
  "updated",
  "archived",
  "moved",
  "quantity_changed",
  "photo_added",
  "photo_removed",
  "tag_added",
  "tag_removed",
  "invite_sent",
  "membership_updated",
  "imported",
  "exported",
]);

export const timestampColumns = () => ({
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => sql`now()`),
});

// Legacy users table from template. Kept for backwards compatibility.
export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    supabaseUserId: uuid("supabase_user_id").notNull(),
    email: text("email").notNull(),
    stripeCustomerId: text("stripe_customer_id"),
    isAdmin: boolean("is_admin").notNull().default(false),
    isFlagged: boolean("is_flagged").notNull().default(false),
    isBlocked: boolean("is_blocked").notNull().default(false),
    ...timestampColumns(),
  },
  (table) => ({
    supabaseUserIdIdx: uniqueIndex("users_supabase_user_id_idx").on(
      table.supabaseUserId,
    ),
    emailIdx: uniqueIndex("users_email_idx").on(table.email),
    stripeCustomerIdIdx: uniqueIndex("users_stripe_customer_id_idx").on(
      table.stripeCustomerId,
    ),
  }),
);

// Profiles are auth.users-linked via userId.
export const profiles = pgTable(
  "profiles",
  {
    userId: uuid("user_id").primaryKey(),
    displayName: text("display_name"),
    name: text("name"),
    company: text("company"),
    locale: text("locale"),
    ...timestampColumns(),
  },
  (table) => ({
    displayNameIdx: index("profiles_display_name_idx").on(table.displayName),
  }),
);

// ===== Inventory domain =====
export const households = pgTable(
  "households",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: uuid("created_by").notNull(),
  },
  (table) => ({
    createdByIdx: index("households_created_by_idx").on(table.createdBy),
  }),
);

export const householdMembers = pgTable(
  "household_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    userId: uuid("user_id"),
    invitedEmail: text("invited_email"),
    role: householdRoleEnum("role").notNull().default("member"),
    status: membershipStatusEnum("status").notNull().default("active"),
    invitedBy: uuid("invited_by"),
    ...timestampColumns(),
  },
  (table) => ({
    householdIdx: index("household_members_household_idx").on(table.householdId),
    userIdx: index("household_members_user_idx").on(table.userId),
    householdUserActiveIdx: uniqueIndex(
      "household_members_household_user_active_idx",
    )
      .on(table.householdId, table.userId)
      .where(sql`${table.userId} is not null`),
  }),
);

export const locations = pgTable(
  "locations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: uuid("created_by").notNull(),
  },
  (table) => ({
    householdIdx: index("locations_household_idx").on(table.householdId),
    householdNameIdx: uniqueIndex("locations_household_name_idx").on(
      table.householdId,
      table.name,
    ),
  }),
);

export const rooms = pgTable(
  "rooms",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: uuid("created_by").notNull(),
  },
  (table) => ({
    locationIdx: index("rooms_location_idx").on(table.locationId),
    householdIdx: index("rooms_household_idx").on(table.householdId),
    locationNameIdx: uniqueIndex("rooms_location_name_idx").on(
      table.locationId,
      table.name,
    ),
  }),
);

export const containers = pgTable(
  "containers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    parentContainerId: uuid("parent_container_id").references(() => containers.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    code: text("code"),
    description: text("description"),
    status: containerStatusEnum("status").notNull().default("active"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    qrDeepLink: text("qr_deep_link"),
    coverPhotoPath: text("cover_photo_path"),
    createdBy: uuid("created_by").notNull(),
    ...timestampColumns(),
  },
  (table) => ({
    householdIdx: index("containers_household_idx").on(table.householdId),
    roomIdx: index("containers_room_idx").on(table.roomId),
    parentIdx: index("containers_parent_idx").on(table.parentContainerId),
    householdCodeIdx: uniqueIndex("containers_household_code_unique_idx")
      .on(table.householdId, table.code)
      .where(sql`${table.code} is not null`),
  }),
);

export const items = pgTable(
  "items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    barcode: text("barcode"),
    serialNumber: text("serial_number"),
    createdBy: uuid("created_by").notNull(),
    ...timestampColumns(),
  },
  (table) => ({
    householdIdx: index("items_household_idx").on(table.householdId),
    nameIdx: index("items_name_idx").on(table.name),
  }),
);

export const itemAliases = pgTable(
  "item_aliases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    aliasText: text("alias_text").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    householdIdx: index("item_aliases_household_idx").on(table.householdId),
    itemIdx: index("item_aliases_item_idx").on(table.itemId),
    uniqueAliasIdx: uniqueIndex("item_aliases_item_alias_unique_idx").on(
      table.itemId,
      table.aliasText,
    ),
  }),
);

export const tags = pgTable(
  "tags",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    householdIdx: index("tags_household_idx").on(table.householdId),
    uniqueNameIdx: uniqueIndex("tags_household_name_unique_idx").on(
      table.householdId,
      table.name,
    ),
  }),
);

export const itemTags = pgTable(
  "item_tags",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    householdIdx: index("item_tags_household_idx").on(table.householdId),
    uniqueIdx: uniqueIndex("item_tags_unique_idx").on(table.itemId, table.tagId),
  }),
);

export const containerTags = pgTable(
  "container_tags",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    containerId: uuid("container_id")
      .notNull()
      .references(() => containers.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    householdIdx: index("container_tags_household_idx").on(table.householdId),
    uniqueIdx: uniqueIndex("container_tags_unique_idx").on(
      table.containerId,
      table.tagId,
    ),
  }),
);

export const containerItems = pgTable(
  "container_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    containerId: uuid("container_id")
      .notNull()
      .references(() => containers.id, { onDelete: "cascade" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull().default(1),
    note: text("note"),
    ...timestampColumns(),
  },
  (table) => ({
    householdIdx: index("container_items_household_idx").on(table.householdId),
    containerIdx: index("container_items_container_idx").on(table.containerId),
    itemIdx: index("container_items_item_idx").on(table.itemId),
    uniqueIdx: uniqueIndex("container_items_unique_idx").on(
      table.containerId,
      table.itemId,
    ),
  }),
);

export const photos = pgTable(
  "photos",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    entityType: photoEntityTypeEnum("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    storagePathOriginal: text("storage_path_original").notNull(),
    storagePathThumb: text("storage_path_thumb").notNull(),
    createdBy: uuid("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    householdIdx: index("photos_household_idx").on(table.householdId),
    entityIdx: index("photos_entity_idx").on(table.entityType, table.entityId),
  }),
);

export const activityLog = pgTable(
  "activity_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    actorUserId: uuid("actor_user_id"),
    actionType: activityActionTypeEnum("action_type").notNull(),
    entityType: activityEntityTypeEnum("entity_type").notNull(),
    entityId: uuid("entity_id"),
    metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    householdCreatedIdx: index("activity_log_household_created_idx").on(
      table.householdId,
      table.createdAt,
    ),
    entityCreatedIdx: index("activity_log_entity_created_idx").on(
      table.entityType,
      table.entityId,
      table.createdAt,
    ),
  }),
);

// ===== Legacy template tables =====
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    stripeSubscriptionId: text("stripe_subscription_id").notNull(),
    stripeCustomerId: text("stripe_customer_id").notNull(),
    status: text("status").notNull(),
    priceId: text("price_id"),
    productId: text("product_id"),
    currentPeriodStart: timestamp("current_period_start", {
      withTimezone: true,
    }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    canceledAt: timestamp("canceled_at", { withTimezone: true }),
    trialStart: timestamp("trial_start", { withTimezone: true }),
    trialEnd: timestamp("trial_end", { withTimezone: true }),
    ...timestampColumns(),
  },
  (table) => ({
    stripeSubscriptionIdIdx: uniqueIndex(
      "subscriptions_stripe_subscription_id_idx",
    ).on(table.stripeSubscriptionId),
    stripeCustomerIdIdx: index("subscriptions_stripe_customer_id_idx").on(
      table.stripeCustomerId,
    ),
    statusIdx: index("subscriptions_status_idx").on(table.status),
    currentPeriodEndIdx: index("subscriptions_current_period_end_idx").on(
      table.currentPeriodEnd,
    ),
    userIdIdx: index("subscriptions_user_id_idx").on(table.userId),
  }),
);

export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    stripeEventId: text("stripe_event_id").notNull(),
    type: text("type").notNull(),
    created: timestamp("created", { withTimezone: true }).notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    payloadHash: text("payload_hash"),
    status: webhookStatusEnum("status").notNull(),
    error: text("error"),
    ...timestampColumns(),
  },
  (table) => ({
    stripeEventIdIdx: uniqueIndex("webhook_events_stripe_event_id_idx").on(
      table.stripeEventId,
    ),
    statusIdx: index("webhook_events_status_idx").on(table.status),
    createdIdx: index("webhook_events_created_idx").on(table.created),
  }),
);

export const supportRequests = pgTable(
  "support_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    email: text("email").notNull(),
    subject: text("subject").notNull(),
    message: text("message").notNull(),
    status: supportStatusEnum("status").notNull().default("open"),
    ticketId: uuid("ticket_id").references(() => tickets.id, {
      onDelete: "set null",
    }),
    ...timestampColumns(),
  },
  (table) => ({
    userIdIdx: index("support_user_id_idx").on(table.userId),
    statusIdx: index("support_status_idx").on(table.status),
    ticketIdIdx: index("support_ticket_id_idx").on(table.ticketId),
  }),
);

export const tickets = pgTable("tickets", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id),
  email: text("email"),
  title: text("title").notNull(),
  content: text("content").notNull(),
  category: text("category").notNull().default("support"),
  status: text("status").notNull().default("new"),
  isPublic: boolean("is_public").notNull().default(false),
  ...timestampColumns(),
});

export const ticketVotes = pgTable(
  "ticket_votes",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => tickets.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    pk: primaryKey({
      columns: [table.userId, table.ticketId],
    }),
  }),
);