-- Remove unused client EXECUTE grants and make future public objects opt-in.
begin;

revoke execute on function
  public.handle_new_user(),
  public.audit_entity_update(),
  public.validate_entity_link(),
  public.validate_event_timezone(),
  public.validate_task_timezone()
from public, anon, authenticated;

-- PUBLIC's built-in function grant is global; a schema-only revoke cannot remove it.
-- Affects future functions created by postgres, not existing functions.
alter default privileges for role postgres
  revoke execute on functions from public;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;

-- Future client-facing objects need explicit grants in their own migration.
-- Existing service_role grants and current client RPC/table grants remain valid.
notify pgrst, 'reload schema';
commit;
