-- Parent email sign-up should require clicking "Verify email".
-- Child login accounts are created by the parent and must stay usable with PIN / secret.
-- Enable Authentication → Providers → Email → Confirm email in the Supabase dashboard.

create or replace function public.tg_auto_confirm_child_users()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.raw_user_meta_data->>'role', '') = 'child' and new.email_confirmed_at is null then
    update auth.users
      set email_confirmed_at = now()
      where id = new.id
        and email_confirmed_at is null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_auto_confirm_child_users on auth.users;
create trigger trg_auto_confirm_child_users
  after insert on auth.users
  for each row
  execute function public.tg_auto_confirm_child_users();
