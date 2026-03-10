begin;

-- Hot-path FK indexes used by tag filters, item/container lookups, support vote counts,
-- and suggestion merge updates. Low-value created_by/invited_by FK warnings are left alone.
create index if not exists containers_room_idx
  on public.containers (room_id);

create index if not exists container_items_item_idx
  on public.container_items (item_id);

create index if not exists item_tags_tag_item_idx
  on public.item_tags (tag_id, item_id);

create index if not exists container_tags_tag_container_idx
  on public.container_tags (tag_id, container_id);

create index if not exists photo_suggestions_resolved_item_idx
  on public.photo_suggestions (resolved_item_id);

create index if not exists ticket_votes_ticket_id_idx
  on public.ticket_votes (ticket_id);

commit;
