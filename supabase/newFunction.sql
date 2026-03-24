--Making it automatic for new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- 1. Create the Public Profile (for the UI to show names)
  INSERT INTO public.profiles (id, email, full_name, system_role, status)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'New Member'), 
    'contributor', -- Default role
    'active'
  );

  -- 2. Stamp the "Passport" (JWT Metadata)
  -- This ensures the very first token they get has their role in it.
  UPDATE auth.users 
  SET raw_user_meta_data = 
    COALESCE(raw_user_meta_data, '{}'::jsonb) || 
    jsonb_build_object('system_role', 'contributor')
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

--About role changes: When you promote someone to "manager" or "team lead," you would update their profile's system_role and also update their JWT metadata so that their new role is reflected in their token. This way, the RLS policies will automatically apply the correct filters based on their new role.
CREATE OR REPLACE FUNCTION public.sync_user_role_to_metadata()
RETURNS TRIGGER AS $$
BEGIN
  -- When the 'system_role' changes in the profiles table...
  -- ...instantly update the 'system_role' in the Auth Metadata.
  UPDATE auth.users
  SET raw_user_meta_data = 
    COALESCE(raw_user_meta_data, '{}'::jsonb) || 
    jsonb_build_object('system_role', NEW.system_role)
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply this to the profiles table
DROP TRIGGER IF EXISTS on_profile_role_update ON public.profiles;
CREATE TRIGGER on_profile_role_update
  AFTER UPDATE OF system_role ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_user_role_to_metadata();