-- TEMPORARY — for testing sign-ups with @gmail.com addresses.
-- Only needed if you wired the "Before User Created" auth hook to
-- restrict_to_ximb_domain (Authentication > Hooks in the dashboard).
-- Run in Supabase SQL Editor.

create or replace function public.restrict_to_ximb_domain()
returns jsonb
language plpgsql
security definer
as $$
begin
  if (event->>'email') not ilike '%@gmail.com' then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 403,
        'message', 'Sign-up is restricted to approved email addresses.'
      )
    );
  end if;
  return jsonb_build_object();
end;
$$;

-- To revert back to the real XIMB domain later, run 003_revert_to_ximb_domain.sql
-- (or just re-run supabase/schema.sql's function block with the real domain).
