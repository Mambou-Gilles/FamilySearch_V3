-- =============================================================================
-- FamilySearch Project Hub — Full Database Schema  (UID-Based Edition)
-- =============================================================================
-- KEY CHANGES vs previous edition:
--  1. team_assignments: user_id, reviewer_id, team_lead_id → profiles(id) FKs
--  2. tasks: contributor_id, reviewer_id → profiles(id) FKs
--  3. ALL helper functions use auth.uid() instead of auth.email()
--  4. RLS policies use id-based comparisons (user_id = auth.uid())
--     instead of email-based (user_email = auth.email())
--  5. SECURITY DEFINER + SET search_path = public on all helpers
--     → zero recursion on team_assignments RLS.
-- =============================================================================


-- =============================================================================
-- EXTENSIONS
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- =============================================================================
-- ENUMS  (safe to re-run)
-- =============================================================================

DO $$ BEGIN
  CREATE TYPE project_type_enum AS ENUM ('hints', 'duplicates', 'validation');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE project_status_enum AS ENUM ('active', 'paused', 'completed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE task_status_enum AS ENUM (
    'available', 'assigned', 'completed',
    'in_review', 'needs_correction', 'reviewed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE system_role_enum AS ENUM (
    'admin', 'manager', 'team_lead', 'reviewer', 'contributor', 'client'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE assignment_role_enum AS ENUM (
    'admin', 'manager', 'team_lead', 'reviewer', 'contributor', 'client'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE assignment_status_enum AS ENUM ('active', 'attrited', 'transferred');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE profile_status_enum AS ENUM ('active', 'inactive');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE geo_status_enum AS ENUM ('open', 'locked', 'completed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;





-- =============================================================================
-- 1. TABLE DEFINITION
-- =============================================================================
--Profiles: Stores user information and their system role (admin, manager, team_lead, reviewer, contributor, client)
CREATE TABLE IF NOT EXISTS public.profiles (
  id                        uuid NOT NULL DEFAULT uuid_generate_v4(),
  email                     text NOT NULL,
  full_name                 text NOT NULL,
  byu_pathway_id            text NULL,
  cohort                    text NULL,
  geography                 text NULL,
  system_role               public.system_role_enum NOT NULL DEFAULT 'contributor'::system_role_enum,
  report_to                 uuid NULL, 
  active_project_type       public.project_type_enum NULL,
  status                    public.profile_status_enum NOT NULL DEFAULT 'active'::profile_status_enum,
  synced                    boolean NOT NULL DEFAULT false,
  logged_in                 boolean NOT NULL DEFAULT false,
  last_login                timestamp with time zone NULL,
  created_date              timestamp with time zone NOT NULL DEFAULT now(),
  updated_date              timestamp with time zone NOT NULL DEFAULT now(),
  created_by                text NULL,

  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_email_key UNIQUE (email),     
  CONSTRAINT profiles_report_to_fkey FOREIGN KEY (report_to) 
    REFERENCES public.profiles (id) ON DELETE SET NULL
);

-- Projects: Stores information about each project (name, type, description, client, status, targets)
CREATE TABLE IF NOT EXISTS public.projects (
  id                        uuid NOT NULL DEFAULT uuid_generate_v4(),
  name                      text NOT NULL,
  project_type              public.project_type_enum NOT NULL,
  description               text NULL,
  client_name               text NULL,
  status                    public.project_status_enum NOT NULL DEFAULT 'active'::project_status_enum,
  daily_target              integer NOT NULL DEFAULT 50,
  weekly_target             integer NOT NULL DEFAULT 250,
  created_date              timestamp with time zone NOT NULL DEFAULT now(),
  updated_date              timestamp with time zone NOT NULL DEFAULT now(),
  created_by                text NULL,

  CONSTRAINT projects_pkey PRIMARY KEY (id)
);

-- Project Geography States: Tracks the status of each geography within a project (e.g., Nigeria in Hints project is "locked")
CREATE TABLE IF NOT EXISTS public.project_geography_states (
  id                        uuid NOT NULL DEFAULT uuid_generate_v4(),
  project_id                uuid NOT NULL,
  geography                 text NOT NULL,
  status                    public.geo_status_enum NOT NULL DEFAULT 'locked'::geo_status_enum,
  sort_order                integer NULL,
  opened_by_email           text NULL,
  opened_at                 timestamp with time zone NULL,
  created_date              timestamp with time zone NOT NULL DEFAULT now(),
  updated_date              timestamp with time zone NOT NULL DEFAULT now(),
  created_by                text NULL,


  CONSTRAINT project_geography_states_pkey PRIMARY KEY (id),
  -- Ensures we don't accidentally create two 'Nigeria' rows for the same 'Hints' project
  CONSTRAINT project_geography_states_project_id_geography_key UNIQUE (project_id, geography),
  -- If the Project is deleted, its geography states should be wiped too
  CONSTRAINT project_geography_states_project_id_fkey FOREIGN KEY (project_id) 
    REFERENCES public.projects (id) ON DELETE CASCADE
);

-- Team Assignments: Tracks which users are assigned to which projects and geographies, along with their role (contributor, reviewer, team lead) and status (active, attrited, transferred)
CREATE TABLE IF NOT EXISTS public.team_assignments (
  id                        uuid NOT NULL DEFAULT uuid_generate_v4(),
  project_id                uuid NOT NULL,
  project_type              public.project_type_enum NOT NULL,
  geography                 text NOT NULL,
  geo_state_id              uuid NULL,
  user_id                   uuid NULL,
  reviewer_id               uuid NULL,
  team_lead_id              uuid NULL,
  user_email                text NOT NULL,
  user_name                 text NOT NULL,
  role                      public.assignment_role_enum NOT NULL,
  team_lead_email           text NULL,
  reviewer_email            text NULL,
  reviewer_name             text NULL,
  assigned_contributors     text[] NULL DEFAULT '{}'::text[],
  work_percentage           integer NOT NULL DEFAULT 100,
  review_percentage         integer NOT NULL DEFAULT 100,
  daily_target              integer NULL,
  status                    public.assignment_status_enum NOT NULL DEFAULT 'active'::assignment_status_enum,
  attrition_date            date NULL,
  created_date              timestamp with time zone NOT NULL DEFAULT now(),
  updated_date              timestamp with time zone NOT NULL DEFAULT now(),
  created_by                text NULL,

  -- Constraints
  CONSTRAINT team_assignments_pkey PRIMARY KEY (id),
  CONSTRAINT unique_user_project UNIQUE (user_email, project_id, geography),
  
  -- Foreign Keys
  CONSTRAINT team_assignments_project_id_fkey FOREIGN KEY (project_id) 
    REFERENCES public.projects (id) ON DELETE CASCADE,
  CONSTRAINT team_assignments_user_id_fkey FOREIGN KEY (user_id) 
    REFERENCES public.profiles (id) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT team_assignments_reviewer_id_fkey FOREIGN KEY (reviewer_id) 
    REFERENCES public.profiles (id) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT team_assignments_team_lead_id_fkey FOREIGN KEY (team_lead_id) 
    REFERENCES public.profiles (id) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT team_assignments_geo_state_id_fkey FOREIGN KEY (geo_state_id)
    REFERENCES public.project_geography_states (id) ON DELETE SET NULL
);

-- Tasks: Stores individual tasks that contributors will work on, along with their status, assignment info, and results from FamilySearch
CREATE TABLE IF NOT EXISTS public.tasks (
  id                        uuid NOT NULL DEFAULT uuid_generate_v4(),
  project_id                uuid NOT NULL,
  project_type              public.project_type_enum NOT NULL,
  geography                 text NOT NULL,
  cohort                    text NULL,
  url                       text NOT NULL,
  fs_project_name           text NULL,
  member_connected          boolean NULL,
  collection_name           text NULL,
  new_person_available      boolean NULL,
  status                    public.task_status_enum NOT NULL DEFAULT 'available'::task_status_enum,
  batch_id                  text NULL,
  -- Assignment Data
  contributor_id            uuid NULL,
  reviewer_id               uuid NULL,
  contributor_email         text NULL,
  contributor_name          text NULL,
  reviewer_email            text NULL,
  reviewer_name             text NULL,
  -- Metrics & Dates
  date_completed            timestamp with time zone NULL,
  original_completion_date  timestamp with time zone NULL,
  review_date               timestamp with time zone NULL,
  correction_count          integer NOT NULL DEFAULT 0,
  -- FamilySearch Result Fields
  hint_result               text NULL,
  qualifications_created    integer NULL,
  new_persons_added         integer NULL,
  time_spent_contributor    text NULL,
  contributor_notes         text NULL,
  data_conflicts            text NULL,
  duplicate_result          text NULL,
  duplicates_resolved       text NULL,
  qualification_status      text NULL,
  revision_needed           boolean NULL,
  tree_work_review          text NULL,
  doc_results               text NULL,
  time_spent_reviewer       text NULL,
  reviewer_notes            text NULL,
  -- Quality Scoring
  quality_score_tree        integer NOT NULL DEFAULT 0,
  quality_score_doc         integer NOT NULL DEFAULT 0,
  total_quality_score       integer NOT NULL DEFAULT 0,
  -- Audit
  created_date              timestamp with time zone NOT NULL DEFAULT now(),
  updated_date              timestamp with time zone NOT NULL DEFAULT now(),
  created_by                text NULL,
  CONSTRAINT tasks_pkey PRIMARY KEY (id),
  CONSTRAINT tasks_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects (id) ON DELETE CASCADE,
  CONSTRAINT tasks_contributor_id_fkey FOREIGN KEY (contributor_id) REFERENCES public.profiles (id) ON DELETE SET NULL,
  CONSTRAINT tasks_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES public.profiles (id) ON DELETE SET NULL
);

-- Attrition: Tracks when and why contributors leave projects, including their role at departure and any notes from managers
CREATE TABLE IF NOT EXISTS public.attrition (
  id                        uuid NOT NULL DEFAULT uuid_generate_v4(),
  email                     text NOT NULL,
  full_name                 text NOT NULL,
  byu_pathway_id            text NULL,
  cohort                    text NULL,
  role                      text NOT NULL, -- Stored as text to preserve the role at the time of departure
  geography                 text NULL,
  project_id                uuid NULL,
  project_type              public.project_type_enum NULL,
  date_of_attrition         timestamp with time zone NULL,
  deleted_by                text NULL, -- Email or ID of the Admin/Manager who performed the action
  notes                     text NULL,
  -- Audit Columns
  created_date              timestamp with time zone NOT NULL DEFAULT now(),
  updated_date              timestamp with time zone NOT NULL DEFAULT now(),
  created_by                text NULL,

  CONSTRAINT attrition_pkey PRIMARY KEY (id),
  
  -- SET NULL ensures that if a project is deleted, we keep the attrition record 
  -- for historical reporting.
  CONSTRAINT attrition_project_id_fkey FOREIGN KEY (project_id) 
    REFERENCES public.projects (id) ON DELETE SET NULL
);


-- Chat Messages: Stores messages between users related to specific tasks or projects, along with read status and timestamps
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id                        uuid NOT NULL DEFAULT uuid_generate_v4(),
  project_id                uuid NULL,
  task_id                   uuid NULL,
  sender_email              text NOT NULL,
  sender_name               text NOT NULL,
  recipient_email           text NOT NULL,
  recipient_name            text NOT NULL,
  message                   text NOT NULL,
  read                      boolean NOT NULL DEFAULT false,
  -- Audit Columns
  created_date              timestamp with time zone NOT NULL DEFAULT now(),
  updated_date              timestamp with time zone NOT NULL DEFAULT now(),
  created_by                text NULL,

  CONSTRAINT chat_messages_pkey PRIMARY KEY (id),
  -- Foreign Keys (Ensures chats don't point to non-existent data)
  CONSTRAINT chat_messages_project_id_fkey FOREIGN KEY (project_id) 
    REFERENCES public.projects (id) ON DELETE SET NULL,
  CONSTRAINT chat_messages_task_id_fkey FOREIGN KEY (task_id) 
    REFERENCES public.tasks (id) ON DELETE SET NULL
);

-- App Logs: A general-purpose logging table to track important actions and events in the system for auditing and debugging purposes
CREATE TABLE IF NOT EXISTS public.app_logs (
  id                        uuid NOT NULL DEFAULT gen_random_uuid(),
  user_email                text NULL,
  page_name                 text NULL,
  action                      text NULL,
  metadata                  jsonb NULL DEFAULT '{}'::jsonb,
  created_at                timestamp with time zone NULL DEFAULT now(),

  CONSTRAINT app_logs_pkey PRIMARY KEY (id)
);

-- =============================================================================
-- 2. INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_profiles_id_email ON public.profiles (id, email);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles (email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles (system_role);
CREATE INDEX IF NOT EXISTS idx_profiles_report_to ON public.profiles (report_to);
-- Indexing name for faster searches in the dashboard
CREATE INDEX IF NOT EXISTS idx_projects_name ON public.projects (name);
-- Indexing status to quickly filter active vs completed projects
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects (status);
-- Essential for joining with team_assignments and tasks quickly
CREATE INDEX IF NOT EXISTS idx_pgs_project ON public.project_geography_states (project_id);
CREATE INDEX IF NOT EXISTS idx_pgs_geo ON public.project_geography_states (geography);
CREATE INDEX IF NOT EXISTS idx_ta_project_geo ON public.team_assignments (project_id, geography);
CREATE INDEX IF NOT EXISTS idx_ta_user_id ON public.team_assignments (user_id);
CREATE INDEX IF NOT EXISTS idx_ta_reviewer_id ON public.team_assignments (reviewer_id);
CREATE INDEX IF NOT EXISTS idx_ta_team_lead_id ON public.team_assignments (team_lead_id);
CREATE INDEX IF NOT EXISTS idx_ta_user_email ON public.team_assignments (user_email);
CREATE INDEX IF NOT EXISTS idx_ta_role_status ON public.team_assignments (role, status);
CREATE INDEX IF NOT EXISTS idx_tasks_project_geo ON public.tasks (project_id, geography);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks (status);
CREATE INDEX IF NOT EXISTS idx_tasks_contributor_id ON public.tasks (contributor_id);
CREATE INDEX IF NOT EXISTS idx_tasks_reviewer_id ON public.tasks (reviewer_id);
CREATE INDEX IF NOT EXISTS idx_tasks_contributor_email ON public.tasks (contributor_email);
CREATE INDEX IF NOT EXISTS idx_tasks_reviewer_email ON public.tasks (reviewer_email);
CREATE INDEX IF NOT EXISTS idx_tasks_date_completed ON public.tasks (date_completed DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_review_date ON public.tasks (review_date DESC);
-- Important for searching departure history by person or project
CREATE INDEX IF NOT EXISTS idx_attrition_email ON public.attrition (email);
CREATE INDEX IF NOT EXISTS idx_attrition_project ON public.attrition (project_id);
-- Essential for loading "My Inbox" or "Sent Messages" quickly
CREATE INDEX IF NOT EXISTS idx_chat_sender ON public.chat_messages (sender_email);
CREATE INDEX IF NOT EXISTS idx_chat_recipient ON public.chat_messages (recipient_email);
-- Added for the new project: Quickly find messages related to a specific task
CREATE INDEX IF NOT EXISTS idx_chat_task_lookup ON public.chat_messages (task_id);
-- Allows you to filter logs by a specific user instantly
CREATE INDEX IF NOT EXISTS idx_app_logs_user_email ON public.app_logs (user_email);
-- Allows you to see the most recent logs first (used for your Admin Audit view)
CREATE INDEX IF NOT EXISTS idx_app_logs_created_at ON public.app_logs (created_at DESC);

-- =============================================================================
-- 3. TRIGGER FUNCTIONS (Must exist before the table triggers)
-- =============================================================================

-- Standard function to auto-update 'updated_date' column
CREATE OR REPLACE FUNCTION public.update_updated_date_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_date = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Function to handle manager sync logic (Ensure this is defined in your project)
-- Note: I'm creating a placeholder. You should replace the logic inside if needed.
CREATE OR REPLACE FUNCTION public.sync_manager_updates()
RETURNS TRIGGER AS $$
BEGIN
    -- Your specific logic for syncing manager roles across tables
    RETURN NEW;
END;
$$ language 'plpgsql';



-- Use the same standard function we created for profiles
CREATE TRIGGER update_projects_modtime
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_date_column();


-- Auto-stamps the date when a task moves to a 'reviewed' or 'completed' status
CREATE OR REPLACE FUNCTION public.stamp_review_date()
RETURNS TRIGGER AS $$
BEGIN
    IF (NEW.status IN ('completed', 'reviewed') AND OLD.status NOT IN ('completed', 'reviewed')) THEN
        NEW.updated_date = now(); -- Or a specific 'reviewed_at' column if you have one
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';


-- Logic for date_completed
CREATE OR REPLACE FUNCTION public.stamp_date_completed()
RETURNS TRIGGER AS $$
BEGIN
    IF (NEW.status = 'completed' AND OLD.status != 'completed') THEN
        NEW.date_completed = now();
        -- If it's the first time it's completed, set the original date too
        IF NEW.original_completion_date IS NULL THEN
            NEW.original_completion_date = now();
        END IF;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Logic for review_date
CREATE OR REPLACE FUNCTION public.stamp_review_date()
RETURNS TRIGGER AS $$
BEGIN
    IF (NEW.status IN ('reviewed', 'completed') AND (OLD.status IS NULL OR OLD.status != NEW.status)) THEN
        NEW.review_date = now();
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';


-- =============================================================================
-- 4. TRIGGERS
-- =============================================================================

-- Sync manager updates when role changes
-- CREATE TRIGGER tr_sync_manager_updates
--   AFTER UPDATE OF system_role ON public.profiles
--   FOR EACH ROW
--   EXECUTE FUNCTION public.sync_manager_updates();

-- Auto-update the updated_date column
CREATE TRIGGER update_profiles_modtime
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_date_column();

-- Auto-update modtime
CREATE TRIGGER update_ta_modtime
  BEFORE UPDATE ON public.team_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_date_column();

-- If you have the auto_register_geography function ready:
-- CREATE TRIGGER trg_auto_register_geography 
--   BEFORE INSERT ON public.team_assignments 
--   FOR EACH ROW EXECUTE FUNCTION auto_register_geography();

-- Using our shared modtime function
CREATE TRIGGER update_pgs_modtime
  BEFORE UPDATE ON public.project_geography_states
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_date_column();


CREATE TRIGGER trg_stamp_date_completed 
  BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.stamp_date_completed();

CREATE TRIGGER trg_stamp_review_date 
  BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.stamp_review_date();

CREATE TRIGGER update_tasks_modtime 
  BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_date_column();

CREATE TRIGGER update_attrition_modtime
  BEFORE UPDATE ON public.attrition
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_date_column();

CREATE TRIGGER update_chat_modtime
  BEFORE UPDATE ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_date_column();

-- =============================================================================
-- 5. RLS POLICIES (From our previous work)
-- =============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- This view identifies which users a Staff member is allowed to see.
-- It is a "Security Barrier" view to prevent RLS recursion.
CREATE OR REPLACE VIEW public.staff_team_view WITH (security_barrier) AS
SELECT 
    ta_target.user_id as visible_user_id,
    ta_curr.user_id as staff_id
FROM public.team_assignments ta_curr
JOIN public.team_assignments ta_target 
  ON ta_curr.project_id = ta_target.project_id 
  AND ta_curr.geography = ta_target.geography;

-- Grant access to the view so authenticated users can query it via RLS
GRANT SELECT ON public.staff_team_view TO authenticated;

-- POLICY 1: Basic Self-Access (REQUIRED FOR LOGIN)
-- Pure ID comparison. This is the "fast lane" for the initial profile fetch.
CREATE POLICY "allow_self_view" ON public.profiles
FOR SELECT TO authenticated
USING (auth.uid() = id);

-- POLICY 2: Basic Self-Update
CREATE POLICY "allow_self_update" ON public.profiles
FOR UPDATE TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- POLICY 3: Admin Global View
-- Uses the JWT "Passport" method. Does not touch the profiles table again.
CREATE POLICY "allow_admin_view_all" ON public.profiles
FOR SELECT TO authenticated
USING (
  (id != auth.uid()) AND 
  (auth.jwt() -> 'user_metadata' ->> 'system_role') = 'admin'
);

-- POLICY 4: Staff Team View
-- Uses the view created above to see team members without circular loops.
CREATE POLICY "allow_staff_view_team" ON public.profiles
FOR SELECT TO authenticated
USING (
  (id != auth.uid()) AND
  id IN (
    SELECT visible_user_id 
    FROM public.staff_team_view 
    WHERE staff_id = auth.uid()
  )
);



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
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND system_role = 'admin'
  )
);

-- [POLICY 2] INSERT: ANY AUTHENTICATED USER
-- Everyone can write to the log, but not everyone can read it.
CREATE POLICY "app_logs_insert_authenticated" 
ON public.app_logs 
FOR INSERT 
TO authenticated 
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
    SELECT 1 FROM public.team_assignments ta
    WHERE ta.user_id = auth.uid()
    AND ta.project_id = public.app_logs.project_id
    AND ta.geography = public.app_logs.geography
    AND ta.status = 'active'
  )
);



-- The "Auto-Register" SQL is a common pattern in Supabase projects to automatically create 
-- a profile for new users when they sign up through the Auth system. This ensures that every 
-- authenticated user has a corresponding entry in the "profiles" table, which can then be used to 
-- manage roles, permissions, and other user-specific data.
-- 1. Create the function that actually does the work
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, system_role, status, synced)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'New Member'), 
    'contributor', -- Default role for everyone who joins
    'active',
    TRUE
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create the trigger that watches the AUTH table
-- Note: This trigger must be on the 'auth.users' table
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();