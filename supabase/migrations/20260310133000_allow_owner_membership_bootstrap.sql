begin;

drop policy if exists household_members_insert on public.household_members;

create policy household_members_insert
on public.household_members for insert
to authenticated
with check (
  public.can_manage_household(household_id)
  or (
    role = 'owner'
    and status = 'active'
    and user_id = auth.uid()
    and exists (
      select 1
      from public.households h
      where h.id = household_id
        and h.created_by = auth.uid()
    )
  )
);

commit;
