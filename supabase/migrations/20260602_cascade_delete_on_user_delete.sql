-- Cascade delete from auth.users to profiles and employees
-- When a user is permanently deleted from Supabase Auth, their profile and employees records are also removed

CREATE OR REPLACE FUNCTION public.handle_user_deleted()
RETURNS trigger AS $$
BEGIN
  DELETE FROM public.employees WHERE user_id = old.id;
  DELETE FROM public.profiles WHERE id = old.id;
  RETURN old;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;
CREATE TRIGGER on_auth_user_deleted
BEFORE DELETE ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_user_deleted();
