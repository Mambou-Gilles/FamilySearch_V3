CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS system_role_enum AS $$
BEGIN
  -- We query the table directly. 
  -- SECURITY DEFINER means this bypasses RLS for this specific internal query.
  RETURN (SELECT system_role FROM public.profiles WHERE id = auth.uid() LIMIT 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS system_role_enum AS $$
  SELECT system_role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;



















-- --- POLICIES ---


-- 1. Enable RLS (Crucial first step for profiles table)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;


-- [POLICY 1] ADMIN: Full Access
-- Using a subquery instead of a function for better reliability
CREATE POLICY "Admin full access" ON public.profiles
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND system_role = 'admin'
  )
);

-- [POLICY 2] SELF: Read & Update own profile
-- Consolidated into one policy for simplicity. 
-- Note: Use auth.uid() = id because emails can technically change.
CREATE POLICY "Users can manage own profile" ON public.profiles
FOR ALL TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- [POLICY 3] STAFF READ: Managers & Team Leads can see their team
-- This allows them to see profiles of people in their assigned projects/geos
CREATE POLICY "Staff can view assigned team" ON public.profiles
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM team_assignments ta1
    JOIN team_assignments ta2 ON ta1.project_id = ta2.project_id AND ta1.geography = ta2.geography
    WHERE ta1.user_id = auth.uid()  -- The current user (Manager/TL)
    AND ta2.user_id = public.profiles.id -- The profile being looked at
  )
);

-- [POLICY 4] MANAGER UPDATE: Promote/Demote logic
-- Managers can update roles of users in their projects to specific roles
CREATE POLICY "Managers can update team roles" ON public.profiles
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND system_role = 'manager'
  )
  AND EXISTS (
    SELECT 1 FROM team_assignments ta1
    JOIN team_assignments ta2 ON ta1.project_id = ta2.project_id AND ta1.geography = ta2.geography
    WHERE ta1.user_id = auth.uid()
    AND ta2.user_id = public.profiles.id
  )
)
WITH CHECK (
  system_role IN ('contributor', 'reviewer')
);




-- 2. Enable RLS for Team Assignments Table
ALTER TABLE public.team_assignments ENABLE ROW LEVEL SECURITY;

-- [POLICY 1] ADMIN: FULL ACCESS
CREATE POLICY "ta_admin_all" ON public.team_assignments
FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND system_role = 'admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND system_role = 'admin')
);

-- [POLICY 2] SELF: READ
-- Users can always see their own assignments
CREATE POLICY "ta_self_read" ON public.team_assignments
FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- [POLICY 3] MANAGER: SELECT
-- Managers can see assignments for projects/geos they are assigned to
CREATE POLICY "ta_manager_select" ON public.team_assignments
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = auth.uid() AND p.system_role = 'manager'
  ) AND EXISTS (
    -- Check if the manager themselves has an assignment in this project/geo
    SELECT 1 FROM public.team_assignments mgr_ta
    WHERE mgr_ta.user_id = auth.uid()
    AND mgr_ta.project_id = public.team_assignments.project_id
    AND mgr_ta.geography = public.team_assignments.geography
  )
);

-- [POLICY 4] MANAGER: INSERT/UPDATE/DELETE
-- Consolidated the manager "write" logic. 
-- Managers can manage users in their specific Project + Geo bubble.
CREATE POLICY "ta_manager_manage" ON public.team_assignments
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = auth.uid() AND p.system_role = 'manager'
  ) AND EXISTS (
    SELECT 1 FROM public.team_assignments mgr_ta
    WHERE mgr_ta.user_id = auth.uid()
    AND mgr_ta.project_id = public.team_assignments.project_id
    AND mgr_ta.geography = public.team_assignments.geography
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = auth.uid() AND p.system_role = 'manager'
  )
);

-- [POLICY 5] TEAM LEAD: READ
-- Team leads see people in their specific Project + Geo
CREATE POLICY "ta_teamlead_read" ON public.team_assignments
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = auth.uid() AND p.system_role = 'team_lead'
  ) AND EXISTS (
    SELECT 1 FROM public.team_assignments tl_ta
    WHERE tl_ta.user_id = auth.uid()
    AND tl_ta.project_id = public.team_assignments.project_id
    AND tl_ta.geography = public.team_assignments.geography
  )
);

-- [POLICY 6] REVIEWER: READ
-- Reviewers see their own work or assignments they are specifically reviewing
CREATE POLICY "ta_reviewer_read" ON public.team_assignments
FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND system_role = 'reviewer')
  AND (user_id = auth.uid() OR reviewer_id = auth.uid())
);


-- 3. Enable RLS for Projects Table
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- [POLICY 1] ADMIN: FULL ACCESS
-- Using a direct subquery to check the user's role in the profiles table.
CREATE POLICY "projects_admin_all" ON public.projects
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND system_role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND system_role = 'admin'
  )
);

-- [POLICY 2] CLIENT: READ
-- Allows clients to view project data (often for high-level reporting).
CREATE POLICY "projects_client_read" ON public.projects
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND system_role = 'client'
  )
);

-- [POLICY 3] MANAGER: INSERT
-- Allows Managers to create new project entries.
CREATE POLICY "projects_manager_insert" ON public.projects
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND system_role = 'manager'
  )
);

-- [POLICY 4] MANAGER: UPDATE
-- Managers can only update projects where they have an ACTIVE assignment.
CREATE POLICY "projects_manager_update" ON public.projects
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND system_role = 'manager'
  )
  AND EXISTS (
    SELECT 1 FROM public.team_assignments ta
    WHERE ta.project_id = public.projects.id
    AND ta.user_id = auth.uid()
    AND ta.status = 'active'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND system_role = 'manager'
  )
);

-- [POLICY 5] MEMBER: READ
-- Allows anyone (Contributor, Lead, Reviewer) to see projects they are assigned to.
CREATE POLICY "projects_member_read" ON public.projects
FOR SELECT TO authenticated
USING (
  -- Option A: User is a Manager (can see all projects to oversee operations)
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND system_role = 'manager'
  )
  OR 
  -- Option B: User is assigned to this specific project and is active
  EXISTS (
    SELECT 1 FROM public.team_assignments ta
    WHERE ta.project_id = public.projects.id
    AND ta.user_id = auth.uid()
    AND ta.status = 'active'
  )
);




-- 4. Enable RLS for Tasks Table
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- [POLICY 1] ADMIN & MANAGER: FULL ACCESS
-- Managers/Admins can manage tasks in the Project + Geo they are assigned to
CREATE POLICY "tasks_main_access_policy" ON public.tasks
FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND system_role = 'admin')
  OR (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND system_role = 'manager')
    AND EXISTS (
      SELECT 1 FROM public.team_assignments ta
      WHERE ta.user_id = auth.uid()
      AND ta.project_id = public.tasks.project_id
      AND ta.geography = public.tasks.geography
      AND ta.status = 'active'
    )
  )
);

-- [POLICY 2] CONTRIBUTOR: SELECT (Claiming & Viewing)
-- Contributors see tasks assigned to them OR 'available' tasks in their Project+Geo bubble
CREATE POLICY "contributor_select" ON public.tasks
FOR SELECT TO authenticated
USING (
  contributor_id = auth.uid()
  OR (
    status = 'available'
    AND EXISTS (
      SELECT 1 FROM public.team_assignments ta
      WHERE ta.user_id = auth.uid()
      AND ta.project_id = public.tasks.project_id
      AND ta.geography = public.tasks.geography
      AND ta.status = 'active'
    )
  )
);

-- [POLICY 3] CONTRIBUTOR: UPDATE (Working on Task)
-- Allows claiming available tasks or updating tasks they already own
CREATE POLICY "contributor_update" ON public.tasks
FOR UPDATE TO authenticated
USING (
  (status = 'available' AND EXISTS (
      SELECT 1 FROM public.team_assignments ta
      WHERE ta.user_id = auth.uid()
      AND ta.project_id = public.tasks.project_id
      AND ta.geography = public.tasks.geography
      AND ta.status = 'active'
  ))
  OR (contributor_id = auth.uid())
)
WITH CHECK (
  contributor_id = auth.uid()
  AND status IN ('assigned', 'completed', 'needs_correction')
);

-- [POLICY 4] REVIEWER: READ & UPDATE
-- Reviewers can see and review tasks assigned to them OR tasks from people they oversee
CREATE POLICY "tasks_reviewer_access" ON public.tasks
FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND system_role = 'reviewer')
  AND (
    reviewer_id = auth.uid() 
    OR contributor_id = auth.uid() -- Can see their own contributor work if they have any
    OR EXISTS (
        -- This mimics 'is_my_contributor': Checks if the task's contributor 
        -- reports to this reviewer in the team_assignments table
        SELECT 1 FROM public.team_assignments ta
        WHERE ta.user_id = public.tasks.contributor_id
        AND ta.reviewer_id = auth.uid()
    )
  )
);

-- [POLICY 5] TEAM LEAD: READ
-- Team leads see all tasks within their specific bubble
CREATE POLICY "tasks_teamlead_read" ON public.tasks
FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND system_role = 'team_lead')
  AND EXISTS (
    SELECT 1 FROM public.team_assignments ta
    WHERE ta.user_id = auth.uid()
    AND ta.project_id = public.tasks.project_id
    AND ta.geography = public.tasks.geography
    AND ta.status = 'active'
  )
);

-- [POLICY 6] CLIENT: READ
CREATE POLICY "tasks_client_read_access" ON public.tasks
FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND system_role = 'client')
);



-- 5. Enable RLS for Project Geography States Table
ALTER TABLE public.project_geography_states ENABLE ROW LEVEL SECURITY;

-- [POLICY 1] ADMIN: FULL ACCESS
CREATE POLICY "pgs_admin_all" ON public.project_geography_states
FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND system_role = 'admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND system_role = 'admin')
);

-- [POLICY 2] CLIENT: READ
CREATE POLICY "pgs_client_read" ON public.project_geography_states
FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND system_role = 'client')
);

-- [POLICY 3] MANAGER: ALL
-- Managers can manage states only for their assigned Project + Geography
CREATE POLICY "pgs_manager_all" ON public.project_geography_states
FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND system_role = 'manager')
  AND EXISTS (
    SELECT 1 FROM public.team_assignments ta
    WHERE ta.user_id = auth.uid()
    AND ta.project_id = public.project_geography_states.project_id
    AND ta.geography = public.project_geography_states.geography
    AND ta.status = 'active'
  )
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND system_role = 'manager')
);

-- [POLICY 4] TEAM: READ
-- Contributors, Team Leads, and Reviewers can see the state of their own "bubbles"
CREATE POLICY "pgs_team_read" ON public.project_geography_states
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.team_assignments ta
    WHERE ta.user_id = auth.uid()
    AND ta.project_id = public.project_geography_states.project_id
    AND ta.geography = public.project_geography_states.geography
    AND ta.status = 'active'
  )
);


-- 6. Enable RLS for Attrition Table
ALTER TABLE public.attrition ENABLE ROW LEVEL SECURITY;

-- [POLICY 1] ADMIN: FULL ACCESS
CREATE POLICY "attrition_admin_all" ON public.attrition
FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND system_role = 'admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND system_role = 'admin')
);

-- [POLICY 2] MANAGER: SELECT (READ)
-- Managers can see the history of departures
CREATE POLICY "attrition_manager_read" ON public.attrition
FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND system_role = 'manager')
);

-- [POLICY 3] MANAGER: INSERT
-- Allows Managers to log a departure when they remove someone from a project
CREATE POLICY "attrition_manager_insert" ON public.attrition
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND system_role = 'manager')
);

-- [POLICY 4] MANAGER: DELETE
-- Note: You might want to restrict this to Admin only in the future, 
-- but this matches your current setup.
CREATE POLICY "attrition_manager_delete" ON public.attrition
FOR DELETE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND system_role = 'manager')
);


-- 7. Enable RLS for Chat Messages Table
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- [POLICY 1] ADMIN: FULL ACCESS
CREATE POLICY "chat_admin_all" ON public.chat_messages
FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND system_role = 'admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND system_role = 'admin')
);

-- [POLICY 2] PARTICIPANT: INSERT (Sending a Message)
-- Ensures the sender_email matches the logged-in user's actual email
CREATE POLICY "chat_participant_insert" ON public.chat_messages
FOR INSERT TO authenticated
WITH CHECK (
  sender_email = (SELECT email FROM public.profiles WHERE id = auth.uid())
);

-- [POLICY 3] PARTICIPANT: SELECT (Reading Chat History)
-- Allows users to see messages where they are either the sender OR the recipient
CREATE POLICY "chat_participant_read" ON public.chat_messages
FOR SELECT TO authenticated
USING (
  sender_email = (SELECT email FROM public.profiles WHERE id = auth.uid())
  OR 
  recipient_email = (SELECT email FROM public.profiles WHERE id = auth.uid())
);

-- [POLICY 4] RECIPIENT: UPDATE (Marking as Read)
-- Typically used to update a 'is_read' or 'read_at' flag
CREATE POLICY "chat_recipient_update" ON public.chat_messages
FOR UPDATE TO authenticated
USING (
  recipient_email = (SELECT email FROM public.profiles WHERE id = auth.uid())
)
WITH CHECK (
  recipient_email = (SELECT email FROM public.profiles WHERE id = auth.uid())
);

-- [POLICY 5] SENDER: DELETE (Unsending a Message)
-- Allows the person who sent the message to remove it
CREATE POLICY "chat_sender_delete" ON public.chat_messages
FOR DELETE TO authenticated
USING (
  sender_email = (SELECT email FROM public.profiles WHERE id = auth.uid())
);


-- 8. Enable RLS for App Logs Table
ALTER TABLE public.app_logs ENABLE ROW LEVEL SECURITY;

-- [POLICY 1] ADMIN: FULL ACCESS
CREATE POLICY "app_logs_admin_all" ON public.app_logs
FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND system_role = 'admin')
);

-- [POLICY 2] INSERT: ANY AUTHENTICATED USER
-- Everyone can write to the log, but not everyone can read it.
CREATE POLICY "app_logs_insert_only" ON public.app_logs
FOR INSERT TO authenticated
WITH CHECK (true);

-- [POLICY 3] MANAGER & TEAM LEAD: SELECT (READ)
-- Allows them to see logs ONLY for the projects/geos they are assigned to.
CREATE POLICY "app_logs_staff_read" ON public.app_logs
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND system_role IN ('manager', 'team_lead')
  )
  AND EXISTS (
    -- Verify the staff member is assigned to the project the log belongs to
    SELECT 1 FROM public.team_assignments ta
    WHERE ta.user_id = auth.uid()
    AND ta.project_id = public.app_logs.project_id
    AND ta.geography = public.app_logs.geography
    AND ta.status = 'active'
  )
);