CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text AS $$
DECLARE
  _role text;
BEGIN
  SELECT system_role INTO _role 
  FROM public.profiles 
  WHERE id = auth.uid();
  
  RETURN COALESCE(_role, 'guest');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Checks if user is Admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND system_role = 'admin');
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- Checks if user is Manager or Admin
CREATE OR REPLACE FUNCTION is_manager_or_above()
RETURNS boolean AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND system_role IN ('admin', 'manager'));
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;


--------------------------------
-- RLS Policies for each roles  
--------------------------------

-- Allow every user to read their OWN profile (Crucial for login)
CREATE POLICY profiles_self_read ON profiles 
  FOR SELECT TO authenticated 
  USING (auth.uid() = id);

--*******ADMIN*******
-- Give Admins "God Mode" over all profiles (Create, Update, Delete users)
CREATE POLICY profiles_admin_all ON profiles 
  FOR ALL TO authenticated 
  USING (is_admin()) 
  WITH CHECK (is_admin()); 


-- Projects, Tasks, and Assignments
-- Projects: Admin full access
CREATE POLICY projects_admin_all ON projects 
  FOR ALL TO authenticated 
  USING (is_admin()) 
  WITH CHECK (is_admin());

-- Team Assignments: Admin full access
CREATE POLICY ta_admin_all ON team_assignments 
  FOR ALL TO authenticated 
  USING (is_admin()) 
  WITH CHECK (is_admin());

-- Tasks: Admin full access
CREATE POLICY tasks_admin_all ON tasks 
  FOR ALL TO authenticated 
  USING (is_admin()) 
  WITH CHECK (is_admin());

-- Logs, Geography States, and Chat
-- Geography States: Admin full access
CREATE POLICY pgs_admin_all ON project_geography_states 
  FOR ALL TO authenticated 
  USING (is_admin()) 
  WITH CHECK (is_admin());

-- Chat: Admin full access
CREATE POLICY chat_admin_all ON chat_messages 
  FOR ALL TO authenticated 
  USING (is_admin()) 
  WITH CHECK (is_admin());

-- Attrition: Admin full access
CREATE POLICY attrition_admin_all ON attrition 
  FOR ALL TO authenticated 
  USING (is_admin()) 
  WITH CHECK (is_admin());


-- *******MANAGER*******
-- This function (already created) is the heart of Manager RLS.
-- It checks if the logged-in Manager is active for a specific Project + Geo.
CREATE OR REPLACE FUNCTION i_manage_project_geo(_project_id uuid, _geo text)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_assignments 
    WHERE user_id = auth.uid() 
    AND project_id = _project_id 
    AND geography = _geo
    AND status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- Projects: Managers can see projects they are assigned to
CREATE POLICY projects_manager_read ON projects
  FOR SELECT TO authenticated
  USING (is_manager_or_above());

-- Geography States: Managers can update 'locked/open' status for their assigned geos
CREATE POLICY pgs_manager_all ON project_geography_states
  FOR ALL TO authenticated
  USING (is_admin() OR (get_my_role() = 'manager' AND i_manage_project_geo(project_id, geography)))
  WITH CHECK (is_admin() OR get_my_role() = 'manager');


  -- 1. View Team: Managers see assignments for the project+geos they manage
CREATE POLICY ta_manager_select ON team_assignments
  FOR SELECT TO authenticated
  USING (is_admin() OR (get_my_role() = 'manager' AND i_manage_project_geo(project_id, geography)));

-- 2. Add Team: Managers can create assignments for contributors/reviewers
CREATE POLICY ta_manager_insert ON team_assignments
  FOR INSERT TO authenticated
  WITH CHECK (get_my_role() = 'manager');

-- 3. Remove Team: Managers can delete assignments in their geos
CREATE POLICY ta_manager_delete ON team_assignments
  FOR DELETE TO authenticated
  USING (is_admin() OR (get_my_role() = 'manager' AND i_manage_project_geo(project_id, geography)));

  -- Attrition: Managers can record when a team member is removed
CREATE POLICY attrition_manager_insert ON attrition
  FOR INSERT TO authenticated
  WITH CHECK (is_manager_or_above());

-- Managers can see attrition logs for their projects
CREATE POLICY attrition_manager_read ON attrition
  FOR SELECT TO authenticated
  USING (is_manager_or_above());

  CREATE POLICY profiles_manager_update ON public.profiles
  FOR UPDATE 
  TO authenticated
  USING (
    -- Manager must be assigned to at least one project the user is also in
    get_my_role() = 'manager' AND EXISTS (
      SELECT 1 FROM team_assignments ta1
      JOIN team_assignments ta2 ON ta1.project_id = ta2.project_id AND ta1.geography = ta2.geography
      WHERE ta1.user_id = auth.uid() -- The Manager
      AND ta2.user_id = profiles.id  -- The Target User
    )
  )
  WITH CHECK (
    -- They can only demote/promote to these roles
    system_role IN ('contributor', 'reviewer')
  );

  -- Remove any old manager delete policies
DROP POLICY IF EXISTS ta_manager_delete ON team_assignments;

CREATE POLICY ta_manager_delete_restricted ON team_assignments
  FOR DELETE 
  TO authenticated
  USING (
    get_my_role() = 'manager' 
    AND i_manage_project_geo(project_id, geography)
    -- This ensures they can't delete another Manager or an Admin
    AND role IN ('contributor', 'reviewer')
  );

  -- Allow Managers to create new profiles
CREATE POLICY profiles_manager_insert ON public.profiles
  FOR INSERT 
  TO authenticated
  WITH CHECK (
    get_my_role() = 'manager' 
    AND system_role IN ('contributor', 'reviewer')
  );

-- 3. Allow Managers to UPDATE existing profiles
-- (Needed for the 'upsert' to work if the email already exists)
CREATE POLICY profiles_manager_update ON public.profiles
  FOR UPDATE 
  TO authenticated
  USING (get_my_role() = 'manager')
  WITH CHECK (
    get_my_role() = 'manager' 
    AND system_role IN ('contributor', 'reviewer')
  );



-- CONTRIBUTOR TASKS POLICIES
-- POLICY: SELECT
-- Allows contributors to see available tasks in their assigned projects/geos,
-- and always see tasks they have already claimed.
CREATE POLICY "contributor_select_all" 
ON tasks FOR SELECT 
TO authenticated 
USING (
  contributor_id = auth.uid() 
  OR (
    status = 'available' 
    AND i_am_member_of(tasks.project_id, tasks.geography)
  )
);

-- POLICY: UPDATE
-- This covers TWO scenarios in one policy:
-- 1. Claiming: Changing status from 'available' to 'assigned' (via i_am_member_of check).
-- 2. Submitting: Changing status from 'assigned' or 'needs_correction' to 'completed'.
CREATE POLICY "contributor_update_all" 
ON tasks FOR UPDATE 
TO authenticated 
USING (
  -- 'Before' the update: It must be available in their region OR already theirs
  (status = 'available' AND i_am_member_of(tasks.project_id, tasks.geography))
  OR (contributor_id = auth.uid())
) 
WITH CHECK (
  -- 'After' the update: It MUST be assigned to them
  contributor_id = auth.uid() 
  AND status IN ('assigned', 'completed', 'needs_correction')
);


-- This function now checks the user's actual role in their profile ***CLIENT***
CREATE OR REPLACE FUNCTION is_client()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role = 'client'
  );
$$;

CREATE POLICY "Client read-only access to projects" ON projects
  FOR SELECT TO authenticated
  USING ( is_client() );

CREATE POLICY "Client read-only access to geography states" ON project_geography_states
  FOR SELECT TO authenticated
  USING ( is_client() );


-- Allow Team Leads to update the status of their own team members (CHECK THIS TOMORROW)
CREATE POLICY "Team Leads can update their team member status"
ON public.team_assignments
FOR UPDATE
USING (
  -- The person logged in must be the team_lead_email assigned to this row
  auth.email() = team_lead_email
)
WITH CHECK (
  -- They can only change the 'status' column
  auth.email() = team_lead_email
);


-- 2. CREATE THE GLOBAL VIEW POLICY
-- This allows anyone with the role 'admin' OR 'client' to see all rows.
CREATE POLICY "Global view for Admins and Clients"
ON tasks
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.system_role IN ('admin', 'client')
  )
);

-- 3. THE WORKER POLICY (Optional but recommended)
-- Contributors/Reviewers still only see what they are assigned to
CREATE POLICY "Workers see assigned tasks only"
ON tasks
FOR SELECT 
TO authenticated
USING (
  contributor_id = auth.uid() OR 
  reviewer_id = auth.uid()
);


-- Allow Clients to see active projects
CREATE POLICY projects_client_read ON projects
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.system_role = 'client'
    )
  );

  -- Allow Clients to see geography states
CREATE POLICY pgs_client_read ON project_geography_states
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.system_role = 'client'
    )
  );

  DROP POLICY IF EXISTS "Global view for Admins and Clients" ON tasks;


-- Allow Clients to see active projects
CREATE POLICY projects_client_read ON projects
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.system_role = 'client'
    )
  );

  -- Allow Clients to see geography states
CREATE POLICY pgs_client_read ON project_geography_states
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.system_role = 'client'
    )
  );

  DROP POLICY IF EXISTS "Global view for Admins and Clients" ON tasks;


CREATE POLICY "projects_member_read"
ON public.projects
FOR SELECT
TO authenticated
USING (
  is_manager_or_above() 
  OR 
  EXISTS (
    SELECT 1
    FROM team_assignments ta
    WHERE ta.project_id = projects.id 
      AND ta.user_id = auth.uid() 
      AND ta.status = 'active'::assignment_status_enum
  )
);



-- 1. Explicit Insert Policy for Admins (Bypasses geography checks)
-- CREATE POLICY "admins_bulk_insert_tasks" 
-- ON tasks
-- FOR INSERT 
-- TO authenticated 
-- WITH CHECK (
--   EXISTS (
--     SELECT 1 FROM profiles 
--     WHERE profiles.id = auth.uid() 
--     AND profiles.system_role = 'admin'
--   )
-- );

-- 2. Update your Management Read to include Managers
-- (This ensures Admins, Clients, AND Managers can see the data)
-- DROP POLICY IF EXISTS "tasks_management_read" ON tasks;
-- CREATE POLICY "tasks_management_read_v2" 
-- ON tasks
-- FOR SELECT
-- TO authenticated
-- USING (
--   EXISTS (
--     SELECT 1 FROM profiles 
--     WHERE profiles.id = auth.uid() 
--     AND profiles.system_role IN ('admin', 'manager', 'client')
--   )
-- );

-- -- 1. Drop the restrictive manager-only policy
-- DROP POLICY IF EXISTS tasks_manager_all ON tasks;

-- -- 2. Create a new version that allows Admins full access 
-- -- and Managers restricted access
-- CREATE POLICY "tasks_admin_and_manager_access" 
-- ON tasks
-- FOR ALL 
-- TO authenticated
-- USING (
--   is_admin() OR (
--     is_manager_or_above() AND i_manage_project_geo(project_id, geography)
--   )
-- )
-- WITH CHECK (
--   is_admin() OR (
--     is_manager_or_above() AND i_manage_project_geo(project_id, geography)
--   )
-- );


-- First, clean up the old ones to avoid conflicts
DROP POLICY IF EXISTS tasks_manager_all ON tasks;

CREATE POLICY "tasks_main_access_policy" 
ON tasks
FOR ALL 
TO authenticated
USING (
  is_admin() OR (
    is_manager_or_above() AND i_manage_project_geo(project_id, geography)
  )
)
WITH CHECK (
  is_admin() OR (
    is_manager_or_above() AND i_manage_project_geo(project_id, geography)
  )
);

DROP POLICY IF EXISTS "tasks_management_read" ON tasks;
DROP POLICY IF EXISTS "tasks_management_read_v2" ON tasks;

CREATE POLICY "tasks_client_read_access" 
ON tasks
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.system_role = 'client'
  )
);


-- 1. Create a function that sets the updated_date to NOW()
CREATE OR REPLACE FUNCTION update_updated_date_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_date = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 2. Create a trigger on the profiles table
CREATE TRIGGER update_profiles_modtime
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_date_column();

-- Drop the restrictive policy
DROP POLICY IF EXISTS profiles_manager_update ON public.profiles;

-- Recreate it with the Attrition check included
CREATE POLICY profiles_manager_update ON public.profiles
  FOR UPDATE 
  TO authenticated
  USING (
    get_my_role() = 'manager' AND (
      -- Check active assignments
      EXISTS (
        SELECT 1 FROM team_assignments ta1
        JOIN team_assignments ta2 ON ta1.project_id = ta2.project_id
        WHERE ta1.user_id = auth.uid() 
        AND ta2.user_id = profiles.id
      )
      OR 
      -- Check attrition log (This allows reactivation!)
      EXISTS (
        SELECT 1 FROM team_assignments ta1
        JOIN attrition att ON ta1.project_id = att.project_id
        WHERE ta1.user_id = auth.uid() 
        AND att.email = profiles.email
      )
    )
  )
WITH CHECK (
    system_role IN ('contributor', 'reviewer')
);