import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  index,
  integer,
  jsonb,
  real,
  pgEnum,
  pgTable,
  vector,
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
  "room_layout",
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
  "suggestion",
  "placement",
  "room_layout",
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

export const aiJobTypeEnum = pgEnum("ai_job_type", [
  "photo_analyze",
  "embedding_upsert",
]);

export const aiJobStatusEnum = pgEnum("ai_job_status", [
  "queued",
  "running",
  "succeeded",
  "failed",
]);

export const photoSuggestionStatusEnum = pgEnum("photo_suggestion_status", [
  "pending",
  "accepted",
  "rejected",
]);

export const searchEntityTypeEnum = pgEnum("search_entity_type", [
  "item",
  "container",
  "room",
  "location",
  "tag",
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
    language: text("language").notNull().default("en"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: uuid("created_by").notNull(),
  },
  (table) => ({
    createdByIdx: index("households_created_by_idx").on(table.createdBy),
  }),
);

export const userPreferences = pgTable(
  "user_preferences",
  {
    userId: uuid("user_id").primaryKey(),
    activeHouseholdId: uuid("active_household_id").references(() => households.id, {
      onDelete: "set null",
    }),
    activeLocationId: uuid("active_location_id").references(
      () => householdFloors.id,
      {
        onDelete: "set null",
      },
    ),
    activeRoomId: uuid("active_room_id").references(() => rooms.id, {
      onDelete: "set null",
    }),
    ...timestampColumns(),
  },
  (table) => ({
    householdIdx: index("user_preferences_active_household_idx").on(
      table.activeHouseholdId,
    ),
    locationIdx: index("user_preferences_active_location_idx").on(
      table.activeLocationId,
    ),
    roomIdx: index("user_preferences_active_room_idx").on(table.activeRoomId),
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

export const rooms = pgTable(
  "rooms",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => householdFloors.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    isSystem: boolean("is_system").notNull().default(false),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: uuid("created_by").notNull(),
  },
  (table) => ({
    locationIdx: index("rooms_location_idx").on(table.locationId),
    householdIdx: index("rooms_household_idx").on(table.householdId),
    householdLocationSystemIdx: index("rooms_household_location_is_system_idx").on(
      table.householdId,
      table.locationId,
      table.isSystem,
    ),
    locationSystemUniqueIdx: uniqueIndex("rooms_location_system_unique_idx")
      .on(table.locationId)
      .where(sql`${table.isSystem} = true`),
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
    parentContainerId: uuid("parent_container_id").references(
      (): AnyPgColumn => containers.id,
      {
        onDelete: "set null",
      },
    ),
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

export const householdFloors = pgTable(
  "household_floors",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    locationId: uuid("location_id").notNull(),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdBy: uuid("created_by").notNull(),
    ...timestampColumns(),
  },
  (table) => ({
    householdSortIdx: index("household_floors_household_sort_idx").on(
      table.householdId,
      table.sortOrder,
      table.createdAt,
    ),
    locationIdx: index("household_floors_location_idx").on(table.locationId),
    householdNameIdx: uniqueIndex("household_floors_household_name_idx").on(
      table.householdId,
      table.name,
    ),
    householdLocationIdx: uniqueIndex("household_floors_household_location_unique_idx").on(
      table.householdId,
      table.locationId,
    ),
  }),
);

export const aiJobs = pgTable(
  "ai_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    jobType: aiJobTypeEnum("job_type").notNull(),
    status: aiJobStatusEnum("status").notNull().default("queued"),
    payload: jsonb("payload").notNull().default(sql`'{}'::jsonb`),
    error: text("error"),
    attemptCount: integer("attempt_count").notNull().default(0),
    runAfter: timestamp("run_after", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    lockedBy: text("locked_by"),
    ...timestampColumns(),
  },
  (table) => ({
    householdIdx: index("ai_jobs_household_idx").on(table.householdId),
    queueIdx: index("ai_jobs_queue_idx").on(
      table.status,
      table.runAfter,
      table.createdAt,
    ),
  }),
);

export const photoSuggestions = pgTable(
  "photo_suggestions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    photoId: uuid("photo_id")
      .notNull()
      .references(() => photos.id, { onDelete: "cascade" }),
    containerId: uuid("container_id")
      .notNull()
      .references(() => containers.id, { onDelete: "cascade" }),
    suggestedName: text("suggested_name").notNull(),
    suggestedQty: integer("suggested_qty"),
    suggestedTags: text("suggested_tags").array(),
    confidence: real("confidence").notNull().default(0),
    status: photoSuggestionStatusEnum("status").notNull().default("pending"),
    resolvedItemId: uuid("resolved_item_id").references(() => items.id, {
      onDelete: "set null",
    }),
    createdBy: uuid("created_by"),
    ...timestampColumns(),
  },
  (table) => ({
    householdIdx: index("photo_suggestions_household_idx").on(table.householdId),
    photoIdx: index("photo_suggestions_photo_idx").on(table.photoId),
    containerIdx: index("photo_suggestions_container_idx").on(table.containerId),
    statusIdx: index("photo_suggestions_status_idx").on(
      table.householdId,
      table.status,
      table.createdAt,
    ),
  }),
);

export const searchDocuments = pgTable(
  "search_documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    entityType: searchEntityTypeEnum("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    content: text("content").notNull(),
    embedding: vector("embedding", { dimensions: 1536 }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => sql`now()`),
  },
  (table) => ({
    householdIdx: index("search_documents_household_idx").on(table.householdId),
    householdEntityIdx: index("search_documents_household_entity_idx").on(
      table.householdId,
      table.entityType,
    ),
    uniqueEntityIdx: uniqueIndex("search_documents_entity_unique_idx").on(
      table.entityType,
      table.entityId,
    ),
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

export const requestRateLimits = pgTable(
  "request_rate_limits",
  {
    scope: text("scope").notNull(),
    identifier: text("identifier").notNull(),
    bucketStart: timestamp("bucket_start", { withTimezone: true }).notNull(),
    count: integer("count").notNull().default(1),
    ...timestampColumns(),
  },
  (table) => ({
    pk: primaryKey({
      columns: [table.scope, table.identifier, table.bucketStart],
    }),
    bucketStartIdx: index("request_rate_limits_bucket_start_idx").on(
      table.bucketStart,
    ),
    scopeBucketIdx: index("request_rate_limits_scope_bucket_idx").on(
      table.scope,
      table.bucketStart,
    ),
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

