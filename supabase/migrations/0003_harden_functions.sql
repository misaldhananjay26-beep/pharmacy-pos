-- ============================================================================
-- 0003_harden_functions.sql
--
-- Supabase's default privileges grant EXECUTE on new functions to anon and
-- authenticated directly, so revoking from PUBLIC alone is not enough. This
-- migration closes the advisor findings:
--   * trigger-only functions must not be callable via /rest/v1/rpc at all
--   * identity helpers must be callable by signed-in users only (never anon)
--   * touch_updated_at must pin its search_path
-- ============================================================================

-- Trigger-only functions: nobody (not even a signed-in user) calls these over RPC.
revoke all on function public.audit_row_change() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.prevent_role_escalation() from public, anon, authenticated;

-- Identity helpers: signed-in only.
revoke all on function public.current_user_role() from public, anon;
revoke all on function public.has_role(public.user_role[]) from public, anon;
revoke all on function public.batch_cost_price(uuid) from public, anon;
grant execute on function public.current_user_role() to authenticated;
grant execute on function public.has_role(public.user_role[]) to authenticated;
grant execute on function public.batch_cost_price(uuid) to authenticated;

-- Pin the search_path on the updated_at helper (advisor: function_search_path_mutable).
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.touch_updated_at() from public, anon, authenticated;

notify pgrst, 'reload schema';
