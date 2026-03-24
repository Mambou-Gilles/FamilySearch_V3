




-- ==========================================
-- 1. PROFILES (5 Indexes)
-- ==========================================
CREATE UNIQUE INDEX IF NOT EXISTS profiles_pkey ON public.profiles USING btree (id);
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_key ON public.profiles USING btree (email);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles USING btree (email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles USING btree (system_role);
CREATE INDEX IF NOT EXISTS idx_profiles_id_email ON public.profiles USING btree (id, email);

-- ==========================================
-- 2. TASKS (9 Indexes)
-- ==========================================
CREATE UNIQUE INDEX IF NOT EXISTS tasks_pkey ON public.tasks USING btree (id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks USING btree (status);
CREATE INDEX IF NOT EXISTS idx_tasks_project_geo ON public.tasks USING btree (project_id, geography);
CREATE INDEX IF NOT EXISTS idx_tasks_contributor_id ON public.tasks USING btree (contributor_id);
CREATE INDEX IF NOT EXISTS idx_tasks_contributor_email ON public.tasks USING btree (contributor_email);
CREATE INDEX IF NOT EXISTS idx_tasks_reviewer_id ON public.tasks USING btree (reviewer_id);
CREATE INDEX IF NOT EXISTS idx_tasks_reviewer_email ON public.tasks USING btree (reviewer_email);
CREATE INDEX IF NOT EXISTS idx_tasks_date_completed ON public.tasks USING btree (date_completed DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_review_date ON public.tasks USING btree (review_date DESC);

-- ==========================================
-- 3. TEAM ASSIGNMENTS (10 Indexes)
-- ==========================================
CREATE UNIQUE INDEX IF NOT EXISTS team_assignments_pkey ON public.team_assignments USING btree (id);
CREATE UNIQUE INDEX IF NOT EXISTS unique_user_project ON public.team_assignments USING btree (user_email, project_id);
CREATE INDEX IF NOT EXISTS idx_ta_user_id ON public.team_assignments USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_ta_user_email ON public.team_assignments USING btree (user_email);
CREATE INDEX IF NOT EXISTS idx_ta_project_geo ON public.team_assignments USING btree (project_id, geography);
CREATE INDEX IF NOT EXISTS idx_ta_role_status ON public.team_assignments USING btree (role, status);
CREATE INDEX IF NOT EXISTS idx_ta_reviewer_id ON public.team_assignments USING btree (reviewer_id);
CREATE INDEX IF NOT EXISTS idx_ta_reviewer_email ON public.team_assignments USING btree (reviewer_email);
CREATE INDEX IF NOT EXISTS idx_ta_team_lead_id ON public.team_assignments USING btree (team_lead_id);
CREATE INDEX IF NOT EXISTS idx_ta_team_lead_email ON public.team_assignments USING btree (team_lead_email);

-- ==========================================
-- 4. PROJECT GEOGRAPHY STATES (3 Indexes)
-- ==========================================
CREATE UNIQUE INDEX IF NOT EXISTS project_geography_states_pkey ON public.project_geography_states USING btree (id);
CREATE UNIQUE INDEX IF NOT EXISTS project_geography_states_project_id_geography_key ON public.project_geography_states USING btree (project_id, geography);
CREATE INDEX IF NOT EXISTS idx_pgs_project ON public.project_geography_states USING btree (project_id);

-- ==========================================
-- 5. CHAT MESSAGES (3 Indexes)
-- ==========================================
CREATE UNIQUE INDEX IF NOT EXISTS chat_messages_pkey ON public.chat_messages USING btree (id);
CREATE INDEX IF NOT EXISTS idx_chat_sender ON public.chat_messages USING btree (sender_email);
CREATE INDEX IF NOT EXISTS idx_chat_recipient ON public.chat_messages USING btree (recipient_email);

-- ==========================================
-- 6. ATTRITION (3 Indexes)
-- ==========================================
CREATE UNIQUE INDEX IF NOT EXISTS attrition_pkey ON public.attrition USING btree (id);
CREATE INDEX IF NOT EXISTS idx_attrition_email ON public.attrition USING btree (email);
CREATE INDEX IF NOT EXISTS idx_attrition_project ON public.attrition USING btree (project_id);

-- ==========================================
-- 7. PROJECTS & LOGS (Primary Keys)
-- ==========================================
CREATE UNIQUE INDEX IF NOT EXISTS projects_pkey ON public.projects USING btree (id);
CREATE UNIQUE INDEX IF NOT EXISTS app_logs_pkey ON public.app_logs USING btree (id);





--functions and triggers
-- ==========================================
-- 1. UTILITY & HELPER FUNCTIONS (The Checkers)
-- ==========================================

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND system_role = 'admin' LIMIT 1);
$$;

CREATE OR REPLACE FUNCTION is_client()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND system_role = 'client' LIMIT 1);
$$;

CREATE OR REPLACE FUNCTION is_manager_or_above()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND system_role IN ('admin','manager') LIMIT 1);
$$;

CREATE OR REPLACE FUNCTION is_team_lead_or_above()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND system_role IN ('admin','manager','team_lead') LIMIT 1);
$$;

-- CREATE OR REPLACE FUNCTION get_my_role()
-- RETURNS system_role_enum LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
--   SELECT COALESCE(
--     (SELECT system_role FROM profiles WHERE id = auth.uid() LIMIT 1),
--     'contributor'::system_role_enum 
--   );
-- $$;

-- CREATE OR REPLACE FUNCTION public.get_my_role()
-- RETURNS system_role_enum 
-- LANGUAGE sql 
-- STABLE 
-- SECURITY DEFINER 
-- SET search_path = public AS $$
--   SELECT system_role 
--   FROM profiles 
--   WHERE id = auth.uid()
--   LIMIT 1;
-- $$;

-- This function is safer because it is STABLE and SECURITY DEFINER, 
-- but we will use it carefully in the policies.
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS public.system_role_enum 
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT system_role FROM public.profiles WHERE id = auth.uid();
$$;

-- ==========================================
-- 2. BUBBLE LOGIC FUNCTIONS (The Access Controllers)
-- ==========================================

CREATE OR REPLACE FUNCTION i_am_member_of(p_project_id UUID, p_geography TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_assignments
    WHERE user_id = auth.uid() AND status = 'active'
      AND project_id = p_project_id AND geography = p_geography
    LIMIT 1
  );
$$;

CREATE OR REPLACE FUNCTION i_manage_project(p_project_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_assignments
    WHERE user_id = auth.uid() AND role = 'manager' AND status = 'active' AND project_id = p_project_id
    LIMIT 1
  );
$$;

CREATE OR REPLACE FUNCTION i_manage_project_geo(p_project_id UUID, p_geography TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_assignments
    WHERE user_id = auth.uid() AND role = 'manager' AND status = 'active'
      AND project_id = p_project_id AND geography = p_geography
    LIMIT 1
  );
$$;

CREATE OR REPLACE FUNCTION i_lead_project(p_project_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_assignments
    WHERE user_id = auth.uid() AND role = 'team_lead' AND status = 'active' AND project_id = p_project_id
    LIMIT 1
  );
$$;

CREATE OR REPLACE FUNCTION i_lead_project_geo(p_project_id UUID, p_geography TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_assignments
    WHERE user_id = auth.uid() AND role = 'team_lead' AND status = 'active'
      AND project_id = p_project_id AND geography = p_geography
    LIMIT 1
  );
$$;

CREATE OR REPLACE FUNCTION is_my_contributor(p_contributor_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_assignments
    WHERE reviewer_id = auth.uid() AND user_id = p_contributor_id AND status = 'active'
    LIMIT 1
  );
$$;

-- ==========================================
-- 3. ADMINISTRATIVE ACTION FUNCTIONS
-- ==========================================

-- CREATE OR REPLACE FUNCTION public.admin_add_user_to_team(
--     p_email TEXT, 
--     p_full_name TEXT, 
--     p_role TEXT, 
--     p_project_id UUID, 
--     p_geography TEXT,
--     p_project_type TEXT DEFAULT NULL -- Kept for compatibility, but we will auto-detect
-- ) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
-- DECLARE 
--     v_user_id UUID;
--     v_actual_project_type public.project_type_enum;
-- BEGIN
--     -- 1. INHERITANCE LOOKUP: Get the real project type from the projects table
--     SELECT project_type INTO v_actual_project_type 
--     FROM public.projects 
--     WHERE id = p_project_id;

--     -- Fallback: If project not found, try to cast the passed parameter
--     IF v_actual_project_type IS NULL AND p_project_type IS NOT NULL THEN
--         v_actual_project_type := p_project_type::public.project_type_enum;
--     END IF;

--     -- 2. PROFILE UPSERT
--     INSERT INTO public.profiles (email, full_name, system_role, status, synced)
--     VALUES (
--         p_email, 
--         p_full_name, 
--         p_role::public.system_role_enum, 
--         'active', 
--         false
--     )
--     ON CONFLICT (email) DO UPDATE 
--     SET 
--         full_name = EXCLUDED.full_name, 
--         system_role = EXCLUDED.system_role
--     RETURNING id INTO v_user_id;

--     -- 3. TEAM ASSIGNMENT UPSERT (With Inherited Data)
--     INSERT INTO public.team_assignments (
--         project_id, 
--         project_type, 
--         geography, 
--         user_id, 
--         user_email, 
--         user_name, 
--         role, 
--         status, 
--         work_percentage
--     )
--     VALUES (
--         p_project_id, 
--         v_actual_project_type, 
--         p_geography, 
--         v_user_id, 
--         p_email, 
--         p_full_name, 
--         p_role::public.assignment_role_enum, 
--         'active'::public.assignment_status_enum, 
--         100
--     )
--     ON CONFLICT (user_email, project_id) DO UPDATE
--     SET 
--         role = EXCLUDED.role, 
--         user_name = EXCLUDED.user_name, 
--         status = EXCLUDED.status,
--         project_type = EXCLUDED.project_type; -- Update type if project changed

--     RETURN v_user_id;
-- END;
-- $$;

CREATE OR REPLACE FUNCTION public.admin_add_user_to_team(
    p_email TEXT, 
    p_full_name TEXT, 
    p_role TEXT, 
    p_project_id UUID, 
    p_geography TEXT,
    p_project_type TEXT DEFAULT NULL,
    p_cohort TEXT DEFAULT NULL,         -- ADDED
    p_byu_id TEXT DEFAULT NULL,         -- ADDED
    p_report_to UUID DEFAULT NULL       -- ADDED
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE 
    v_user_id UUID;
    v_actual_project_type public.project_type_enum;
BEGIN
    -- 1. Get real project type
    SELECT project_type INTO v_actual_project_type 
    FROM public.projects 
    WHERE id = p_project_id;

    IF v_actual_project_type IS NULL AND p_project_type IS NOT NULL THEN
        v_actual_project_type := p_project_type::public.project_type_enum;
    END IF;

    -- 2. PROFILE UPSERT (Now including metadata)
    INSERT INTO public.profiles (
        email, 
        full_name, 
        system_role, 
        status, 
        synced, 
        cohort, 
        byu_pathway_id, 
        report_to
    )
    VALUES (
        p_email, 
        p_full_name, 
        p_role::public.system_role_enum, 
        'active', 
        false, 
        p_cohort, 
        p_byu_id, 
        p_report_to
    )
    ON CONFLICT (email) DO UPDATE 
    SET 
        full_name = EXCLUDED.full_name, 
        system_role = EXCLUDED.system_role,
        cohort = COALESCE(EXCLUDED.cohort, profiles.cohort), -- Update if new value exists
        byu_pathway_id = COALESCE(EXCLUDED.byu_pathway_id, profiles.byu_pathway_id),
        report_to = COALESCE(EXCLUDED.report_to, profiles.report_to),
        updated_date = NOW()
    RETURNING id INTO v_user_id;

    -- 3. TEAM ASSIGNMENT UPSERT
    INSERT INTO public.team_assignments (
        project_id, project_type, geography, user_id, 
        user_email, user_name, role, status, work_percentage
    )
    VALUES (
        p_project_id, v_actual_project_type, p_geography, v_user_id, 
        p_email, p_full_name, p_role::public.assignment_role_enum, 'active', 100
    )
    ON CONFLICT (user_email, project_id) DO UPDATE
    SET 
        role = EXCLUDED.role, 
        user_name = EXCLUDED.user_name, 
        status = EXCLUDED.status;

    RETURN v_user_id;
END;
$$;



CREATE OR REPLACE FUNCTION public.admin_and_manager_update_user(
  p_user_id UUID, p_full_name TEXT, p_role TEXT, p_status TEXT, p_cohort TEXT, p_email TEXT
) RETURNS void AS $$
BEGIN
  UPDATE public.profiles SET 
    full_name = p_full_name,
    system_role = p_role::system_role_enum, 
    status = p_status::profile_status_enum, 
    cohort = p_cohort, email = p_email, updated_date = NOW()
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION admin_attrite_user(
  p_profile_id UUID, p_email TEXT, p_full_name TEXT, p_role TEXT, 
  p_byu_id TEXT, p_cohort TEXT, p_geography TEXT, p_project_id UUID, 
  p_project_type project_type_enum, p_deleted_by TEXT, p_notes TEXT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO attrition (
    email, full_name, role, byu_pathway_id, cohort, geography, 
    project_id, project_type, date_of_attrition, deleted_by, notes
  ) VALUES (
    p_email, p_full_name, p_role, p_byu_id, p_cohort, p_geography, 
    p_project_id, p_project_type, NOW(), p_deleted_by, p_notes
  );
  DELETE FROM team_assignments WHERE user_email = p_email;
  UPDATE profiles SET status = 'inactive', synced = false, updated_date = NOW() WHERE id = p_profile_id;
END;
$$;

CREATE OR REPLACE FUNCTION admin_reactivate_user(
  p_attrition_id UUID,
  p_email TEXT,
  p_full_name TEXT,
  p_role TEXT,
  p_project_id UUID,
  p_project_type project_type_enum,
  p_geography TEXT,
  p_created_by TEXT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- 1. Update the profile
  UPDATE profiles 
  SET 
    status = 'active', 
    synced = false, 
    updated_date = NOW() 
  WHERE email = p_email;

  -- 2. Restore the team assignment
  INSERT INTO team_assignments (
    user_email, 
    user_name, 
    project_id, 
    project_type, 
    geography, 
    role, 
    status, 
    created_by
  ) VALUES (
    p_email, 
    p_full_name, 
    p_project_id, 
    p_project_type, 
    p_geography, 
    LOWER(p_role), 
    'active', 
    p_created_by
  );

  -- 3. Delete from attrition log
  DELETE FROM attrition WHERE id = p_attrition_id;
END;
$$;

-- ==========================================
-- 4. PROJECT & TASK OPERATIONS
-- ==========================================

CREATE OR REPLACE FUNCTION get_project_stats(p_project_id UUID)
RETURNS JSON LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_result JSON;
BEGIN
  IF NOT is_manager_or_above() THEN RAISE EXCEPTION 'Insufficient privileges'; END IF;
  SELECT json_build_object(
    'total',     COUNT(*),
    'available', COUNT(*) FILTER (WHERE status = 'available'),
    'assigned',  COUNT(*) FILTER (WHERE status = 'assigned'),
    'completed', COUNT(*) FILTER (WHERE status IN ('completed','in_review','needs_correction','reviewed')),
    'reviewed',  COUNT(*) FILTER (WHERE status = 'reviewed')
  ) INTO v_result FROM tasks WHERE project_id = p_project_id;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION lock_geography(p_project_id UUID, p_geography TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT is_manager_or_above() THEN RAISE EXCEPTION 'Insufficient privileges'; END IF;
  UPDATE project_geography_states SET status = 'locked' WHERE project_id = p_project_id AND geography = p_geography;
END;
$$;

CREATE OR REPLACE FUNCTION open_geography(p_project_id UUID, p_geography TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT is_manager_or_above() THEN RAISE EXCEPTION 'Insufficient privileges'; END IF;
  INSERT INTO project_geography_states (project_id, geography, status, opened_by_email, opened_at)
  VALUES (p_project_id, p_geography, 'open', auth.email(), NOW())
  ON CONFLICT (project_id, geography) DO UPDATE SET status = 'open', opened_by_email = auth.email(), opened_at = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION request_batch(batch_size INT DEFAULT 20)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_project UUID; v_geo TEXT; v_batch_id TEXT; v_count INT;
BEGIN
  SELECT ta.project_id, ta.geography INTO v_project, v_geo FROM team_assignments ta
  WHERE ta.user_id = v_uid AND ta.status = 'active' AND ta.role = 'contributor' LIMIT 1;
  IF v_project IS NULL THEN RAISE EXCEPTION 'No active contributor assignment found'; END IF;
  IF NOT EXISTS (SELECT 1 FROM project_geography_states WHERE project_id = v_project AND geography = v_geo AND status = 'open') 
  THEN RAISE EXCEPTION 'Geography is currently locked'; END IF;
  v_batch_id := 'batch-' || extract(epoch FROM NOW())::BIGINT;
  WITH selected AS (SELECT id FROM tasks WHERE project_id = v_project AND geography = v_geo AND status = 'available' ORDER BY created_date LIMIT batch_size FOR UPDATE SKIP LOCKED)
  UPDATE tasks t SET status = 'assigned', contributor_id = v_uid, batch_id = v_batch_id FROM selected WHERE t.id = selected.id;
  GET DIAGNOSTICS v_count = ROW_COUNT; RETURN v_count;
END;
$$;

-- ==========================================
-- 5. TRIGGER FUNCTIONS
-- ==========================================

CREATE OR REPLACE FUNCTION auto_register_geography()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO project_geography_states (project_id, geography, status)
  VALUES (NEW.project_id, NEW.geography, 'locked') ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

-- CREATE OR REPLACE FUNCTION handle_new_user()
-- RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
-- BEGIN
--   BEGIN
--     INSERT INTO public.profiles (id, email, full_name, system_role)
--     VALUES (new.id, new.email, new.email, 'contributor') ON CONFLICT (id) DO NOTHING;
--   EXCEPTION WHEN OTHERS THEN NULL; END;
--   RETURN NEW;
-- END;
-- $$;

-- CREATE OR REPLACE FUNCTION on_auth_user_login()
-- RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
-- BEGIN
--   UPDATE profiles SET logged_in = TRUE, last_login = NOW() WHERE id = NEW.id;
--   RETURN NEW;
-- END;
-- $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, auth 
AS $$
DECLARE
    v_role_text TEXT;
    v_role_enum public.system_role_enum;
BEGIN
    v_role_text := LOWER(COALESCE(NEW.raw_user_meta_data->>'role', 'contributor'));

    CASE v_role_text
        WHEN 'admin'     THEN v_role_enum := 'admin'::public.system_role_enum;
        WHEN 'client'    THEN v_role_enum := 'client'::public.system_role_enum;
        WHEN 'manager'   THEN v_role_enum := 'manager'::public.system_role_enum;
        WHEN 'team_lead' THEN v_role_enum := 'team_lead'::public.system_role_enum;
        WHEN 'reviewer'  THEN v_role_enum := 'reviewer'::public.system_role_enum;
        ELSE                  v_role_enum := 'contributor'::public.system_role_enum;
    END CASE;

    INSERT INTO public.profiles (id, email, full_name, system_role, status, synced)
    VALUES (
        NEW.id, 
        NEW.email, 
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), 
        v_role_enum,
        'active',
        TRUE
    )
    ON CONFLICT (email) DO UPDATE SET 
        id = EXCLUDED.id,
        synced = TRUE,
        system_role = EXCLUDED.system_role;

    RETURN NEW;
END;
$$;

-- ATTACH
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 1. Create the function to handle logins
CREATE OR REPLACE FUNCTION public.handle_user_login()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles
  SET 
    last_login = NOW(),
    synced = TRUE
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Attach it to the auth.users table
-- This fires every time the 'last_sign_in_at' column is updated in Auth
DROP TRIGGER IF EXISTS on_auth_user_login ON auth.users;
CREATE TRIGGER on_auth_user_login
  AFTER UPDATE OF last_sign_in_at ON auth.users
  FOR EACH ROW
  WHEN (OLD.last_sign_in_at IS DISTINCT FROM NEW.last_sign_in_at)
  EXECUTE FUNCTION public.handle_user_login();


CREATE OR REPLACE FUNCTION sync_manager_updates()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.team_assignments SET role = NEW.system_role::TEXT::public.assignment_role_enum WHERE user_email = NEW.email;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION set_updated_date() RETURNS TRIGGER AS $$ BEGIN NEW.updated_date = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION update_updated_date_column() RETURNS TRIGGER AS $$ BEGIN NEW.updated_date = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION stamp_date_completed() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status <> 'completed' THEN 
    NEW.date_completed = NOW(); NEW.original_completion_date = COALESCE(NEW.original_completion_date, NOW()); 
  END IF; RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION stamp_review_date() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'reviewed' AND OLD.status <> 'reviewed' THEN NEW.review_date = NOW(); END IF; RETURN NEW;
END; $$ LANGUAGE plpgsql;

-- ==========================================
-- 6. TRIGGER ATTACHMENTS
-- ==========================================

DROP TRIGGER IF EXISTS trg_auto_register_geography ON team_assignments;
CREATE TRIGGER trg_auto_register_geography BEFORE INSERT ON team_assignments FOR EACH ROW EXECUTE FUNCTION auto_register_geography();

DROP TRIGGER IF EXISTS tr_sync_manager_updates ON profiles;
CREATE TRIGGER tr_sync_manager_updates AFTER UPDATE OF system_role ON profiles FOR EACH ROW EXECUTE FUNCTION sync_manager_updates();

DROP TRIGGER IF EXISTS trg_stamp_date_completed ON tasks;
CREATE TRIGGER trg_stamp_date_completed BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION stamp_date_completed();

DROP TRIGGER IF EXISTS trg_stamp_review_date ON tasks;
CREATE TRIGGER trg_stamp_review_date BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION stamp_review_date();

DROP TRIGGER IF EXISTS trg_updated_date_profiles ON profiles;
CREATE TRIGGER trg_updated_date_profiles BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION set_updated_date();

-- Run this if the trigger isn't active on Auth
-- CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 1. FIRST, ENSURE THE SHARED FUNCTION EXISTS
CREATE OR REPLACE FUNCTION set_updated_date()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN 
    NEW.updated_date = NOW(); 
    RETURN NEW; 
END;
$$;

-- 2. DYNAMICALLY APPLY "trg_updated_date" TO ALL TARGET TABLES
DO $$ 
DECLARE 
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'profiles',
        'projects',
        'team_assignments',
        'tasks',
        'chat_messages',
        'attrition',
        'project_geography_states'
    ] LOOP
        EXECUTE format(
            'DROP TRIGGER IF EXISTS trg_updated_date ON %I;
             CREATE TRIGGER trg_updated_date
               BEFORE UPDATE ON %I
               FOR EACH ROW EXECUTE FUNCTION set_updated_date();', t, t);
    END LOOP;
END $$;

-- 3. APPLY THE SPECIFIC "LOGIC" TRIGGERS (NON-REPETITIVE)

-- Role Sync: Profiles -> Team Assignments
DROP TRIGGER IF EXISTS tr_sync_manager_updates ON public.profiles;
CREATE TRIGGER tr_sync_manager_updates
  AFTER UPDATE OF system_role ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION sync_manager_updates();

-- Auto-Register: Assignments -> Geography States
DROP TRIGGER IF EXISTS trg_auto_register_geography ON public.team_assignments;
CREATE TRIGGER trg_auto_register_geography
  BEFORE INSERT ON public.team_assignments
  FOR EACH ROW EXECUTE FUNCTION auto_register_geography();

-- Task Automation: Completion Dates
DROP TRIGGER IF EXISTS trg_stamp_date_completed ON public.tasks;
CREATE TRIGGER trg_stamp_date_completed
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION stamp_date_completed();

-- Task Automation: Review Dates
DROP TRIGGER IF EXISTS trg_stamp_review_date ON public.tasks;
CREATE TRIGGER trg_stamp_review_date
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION stamp_review_date();

-- Profile Modification Time (Specific secondary tracker)
DROP TRIGGER IF EXISTS update_profiles_modtime ON public.profiles;
CREATE TRIGGER update_profiles_modtime
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_date_column();



-----------------------------------
----POLICIES (RLS)
-----------------------------------

-- 1. Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- [POLICY 1] ADMIN: Full Power
-- Admins can do anything to any profile.
DROP POLICY IF EXISTS profiles_admin_all ON public.profiles;
CREATE POLICY profiles_admin_all ON public.profiles 
  FOR ALL TO authenticated 
  USING (is_admin()) 
  WITH CHECK (is_admin());

-- [POLICY 2] SELF: Read
-- Crucial for the app to load the user's own data upon login.
DROP POLICY IF EXISTS profiles_self_read ON public.profiles;
CREATE POLICY profiles_self_read ON public.profiles 
  FOR SELECT TO authenticated 
  USING (auth.uid() = id);

-- [POLICY 3] SELF: Update
-- Users can update their own profile (e.g., changing their full_name), 
-- but they cannot change their own system_role (enforced by the 'WITH CHECK').
DROP POLICY IF EXISTS profiles_self_update ON public.profiles;
CREATE POLICY profiles_self_update ON public.profiles 
  FOR UPDATE TO authenticated 
  USING (auth.uid() = id) 
  WITH CHECK (
    auth.uid() = id 
    AND system_role = (SELECT system_role FROM public.profiles WHERE id = auth.uid())
  );

-- [POLICY 4] STAFF-READ: Visibility within the Bubble
-- Reviewers can see profiles they work with.
-- Managers can see profiles within their Project + Geo territory.
DROP POLICY IF EXISTS profiles_staff_read ON public.profiles;
CREATE POLICY profiles_staff_read ON public.profiles
  FOR SELECT TO authenticated
  USING (
    is_admin() 
    OR get_my_role() = 'reviewer'
    OR EXISTS (
      SELECT 1 FROM public.team_assignments ta
      WHERE ta.user_id = public.profiles.id
        AND i_manage_project_geo(ta.project_id, ta.geography)
    )
  );

-- [POLICY 5] MANAGER: Update (Bubble Management)
-- Managers can update profiles of people in their specific Project + Geo.
-- Restriction: Managers can only set roles to 'contributor' or 'reviewer'.
DROP POLICY IF EXISTS profiles_manager_update ON public.profiles;
CREATE POLICY profiles_manager_update ON public.profiles
  FOR UPDATE 
  TO authenticated
  USING (
    get_my_role() = 'manager' AND EXISTS (
      SELECT 1 FROM public.team_assignments mgr_ta
      JOIN public.team_assignments user_ta ON mgr_ta.project_id = user_ta.project_id 
        AND mgr_ta.geography = user_ta.geography
      WHERE mgr_ta.user_id = auth.uid() 
      AND user_ta.user_id = public.profiles.id
    )
  )
  WITH CHECK (
    system_role IN ('contributor', 'reviewer')
  );

CREATE POLICY "Managers_can_view_their_team_leads" 
ON public.profiles 
FOR SELECT 
TO authenticated 
USING (
  -- 1. Must be a manager
  (SELECT system_role FROM public.profiles WHERE id = auth.uid()) = 'manager'
  AND 
  -- 2. Target must be a team_lead
  system_role = 'team_lead'
  AND 
  -- 3. They must share at least one Project + Geography
  EXISTS (
    SELECT 1 FROM public.team_assignments mgr_ta
    JOIN public.team_assignments lead_ta ON 
      mgr_ta.project_id = lead_ta.project_id 
      AND mgr_ta.geography = lead_ta.geography
    WHERE mgr_ta.user_id = auth.uid() 
    AND lead_ta.user_id = public.profiles.id
  )
);



-- 1. Enable RLS
ALTER TABLE public.team_assignments ENABLE ROW LEVEL SECURITY;

-- [POLICY 1] ADMIN: Full Access
-- Admins can manage any assignment across any project or geography.
DROP POLICY IF EXISTS ta_admin_all ON public.team_assignments;
CREATE POLICY ta_admin_all ON public.team_assignments 
  FOR ALL TO authenticated 
  USING (is_admin()) 
  WITH CHECK (is_admin());

-- [POLICY 2] SELF: Read
-- Every user must be able to see their own assignment record to know their role/project.
DROP POLICY IF EXISTS ta_self_read ON public.team_assignments;
CREATE POLICY ta_self_read ON public.team_assignments
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR auth.email() = user_email);

-- [POLICY 3] MANAGER: Select (Bubble Visibility)
-- Managers can see all assignments within the Project + Geo they manage.
DROP POLICY IF EXISTS ta_manager_select ON public.team_assignments;
CREATE POLICY ta_manager_select ON public.team_assignments
  FOR SELECT TO authenticated
  USING (i_manage_project_geo(project_id, geography));

-- [POLICY 4] MANAGER: Insert (Building the Team)
-- Managers can add new members. 
-- Note: 'WITH CHECK' ensures they can only add members to their own managed Bubble.
DROP POLICY IF EXISTS ta_manager_insert ON public.team_assignments;
CREATE POLICY ta_manager_insert ON public.team_assignments
  FOR INSERT TO authenticated
  WITH CHECK (i_manage_project_geo(project_id, geography));

-- [POLICY 5] MANAGER: Update (Managing the Team)
-- Managers can change roles or status within their Bubble.
DROP POLICY IF EXISTS ta_manager_update ON public.team_assignments;
CREATE POLICY ta_manager_update ON public.team_assignments
  FOR UPDATE TO authenticated
  USING (i_manage_project_geo(project_id, geography))
  WITH CHECK (i_manage_project_geo(project_id, geography));

-- [POLICY 6] MANAGER: Delete (Removing from Team)
DROP POLICY IF EXISTS ta_manager_delete ON public.team_assignments;
CREATE POLICY ta_manager_delete ON public.team_assignments
  FOR DELETE TO authenticated
  USING (i_manage_project_geo(project_id, geography));

-- [POLICY 7] TEAM LEAD: Read
-- Team Leads can see the members assigned to their specific Project + Geo bubble.
DROP POLICY IF EXISTS ta_teamlead_read ON public.team_assignments;
CREATE POLICY ta_teamlead_read ON public.team_assignments
  FOR SELECT TO authenticated
  USING (i_lead_project_geo(project_id, geography));

-- [POLICY 8] REVIEWER: Read
-- Reviewers can see their own assignment and the assignments of people they are reviewing.
DROP POLICY IF EXISTS ta_reviewer_read ON public.team_assignments;
CREATE POLICY ta_reviewer_read ON public.team_assignments
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() 
    OR reviewer_id = auth.uid()
  );




-- 1. Enable RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- [POLICY 1] ADMIN & MANAGER: Full Bubble Access
-- Admins have global access; Managers have full control over tasks in their assigned Project + Geo.
-- DROP POLICY IF EXISTS tasks_main_access_policy ON public.tasks;
-- CREATE POLICY tasks_main_access_policy ON public.tasks
--   FOR ALL TO authenticated
--   USING (
--     is_admin() 
--     OR (is_manager_or_above() AND i_manage_project_geo(project_id, geography))
--   )
--   WITH CHECK (
--     is_admin() 
--     OR (is_manager_or_above() AND i_manage_project_geo(project_id, geography))
--   );

-- 1. INSERT: Be slightly broader (allow if manager)
CREATE POLICY tasks_manager_insert ON public.tasks
  FOR INSERT TO authenticated
  WITH CHECK (is_admin() OR is_manager_or_above());

-- 2. SELECT/UPDATE/DELETE: Be strict (must manage that geo)
CREATE POLICY tasks_manager_management ON public.tasks
  FOR ALL TO authenticated
  USING (
    is_admin() 
    OR (is_manager_or_above() AND i_manage_project_geo(project_id, geography))
  );

-- [POLICY 2] CONTRIBUTOR: Select
-- Can see tasks assigned to them OR 'available' tasks in their assigned Project + Geo.
DROP POLICY IF EXISTS contributor_select_all ON public.tasks;
CREATE POLICY contributor_select_all ON public.tasks 
  FOR SELECT TO authenticated 
  USING (
    contributor_id = auth.uid() 
    OR (
      status = 'available' 
      AND i_am_member_of(project_id, geography)
    )
  );

-- [POLICY 3] CONTRIBUTOR: Update (Claiming & Submitting)
-- Allows claiming an 'available' task or updating one they already own.
DROP POLICY IF EXISTS contributor_update_all ON public.tasks;
CREATE POLICY contributor_update_all ON public.tasks 
  FOR UPDATE TO authenticated 
  USING (
    (status = 'available' AND i_am_member_of(project_id, geography))
    OR (contributor_id = auth.uid())
  ) 
  WITH CHECK (
    contributor_id = auth.uid() 
    AND status IN ('assigned', 'completed', 'needs_correction')
  );

-- [POLICY 4] REVIEWER: Update
-- Reviewers can move tasks through the review pipeline for their assigned contributors.
DROP POLICY IF EXISTS tasks_reviewer_update ON public.tasks;
CREATE POLICY tasks_reviewer_update ON public.tasks
  FOR UPDATE TO authenticated
  USING (
    get_my_role() = 'reviewer'
    AND status IN ('completed', 'in_review', 'needs_correction', 'reviewed')
    AND (
      reviewer_id = auth.uid()
      OR is_my_contributor(contributor_id)
    )
  )
  WITH CHECK (get_my_role() = 'reviewer');

-- [POLICY 5] TEAM LEAD: Read
-- Team Leads can monitor all task progress within their specific Project + Geo bubble.
DROP POLICY IF EXISTS tasks_teamlead_read ON public.tasks;
CREATE POLICY tasks_teamlead_read ON public.tasks
  FOR SELECT TO authenticated
  USING (
    get_my_role() = 'team_lead'
    AND i_lead_project_geo(project_id, geography)
  );

-- [POLICY 6] CLIENT: Read
-- Clients can see tasks across the board (usually for high-level progress tracking).
DROP POLICY IF EXISTS tasks_client_read_access ON public.tasks;
CREATE POLICY tasks_client_read_access ON public.tasks
  FOR SELECT TO authenticated
  USING (is_client());

-- [POLICY 7] GENERAL REVIEWER: Read
-- Standard read access for reviewers to see their workload.
DROP POLICY IF EXISTS tasks_reviewer_read ON public.tasks;
CREATE POLICY tasks_reviewer_read ON public.tasks
  FOR SELECT TO authenticated
  USING (
    get_my_role() = 'reviewer' 
    AND (reviewer_id = auth.uid() OR is_my_contributor(contributor_id))
  );


  -- 1. Enable RLS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- [POLICY 1] ADMIN: Full Access
-- Global admins can create, view, edit, and delete any project.
DROP POLICY IF EXISTS projects_admin_all ON public.projects;
CREATE POLICY projects_admin_all ON public.projects 
  FOR ALL TO authenticated 
  USING (is_admin()) 
  WITH CHECK (is_admin());

-- [POLICY 2] CLIENT: Read
-- Clients can see projects they are associated with (via the is_client helper).
DROP POLICY IF EXISTS projects_client_read ON public.projects;
CREATE POLICY projects_client_read ON public.projects
  FOR SELECT TO authenticated
  USING (is_client());

-- [POLICY 3] MANAGER: Insert
-- Managers can create new projects.
DROP POLICY IF EXISTS projects_manager_insert ON public.projects;
CREATE POLICY projects_manager_insert ON public.projects
  FOR INSERT TO authenticated
  WITH CHECK (is_manager_or_above());

-- [POLICY 4] MANAGER: Update
-- Managers can only update projects they are actively managing.
DROP POLICY IF EXISTS projects_manager_update ON public.projects;
CREATE POLICY projects_manager_update ON public.projects
  FOR UPDATE TO authenticated
  USING (is_manager_or_above() AND i_manage_project(id))
  WITH CHECK (is_manager_or_above());

-- [POLICY 5] MEMBER: Read (The "Bubble" View)
-- Users (Contributors, Leads, Reviewers) can only see a project if they have 
-- an active assignment in team_assignments for that specific project.
DROP POLICY IF EXISTS projects_member_read ON public.projects;
CREATE POLICY projects_member_read ON public.projects
  FOR SELECT TO authenticated
  USING (
    is_manager_or_above()
    OR EXISTS (
      SELECT 1 FROM public.team_assignments ta
      WHERE ta.project_id = public.projects.id
        AND ta.user_id    = auth.uid()
        AND ta.status     = 'active'
    )
  );


  -- 1. Enable RLS
ALTER TABLE public.project_geography_states ENABLE ROW LEVEL SECURITY;

-- [POLICY 1] ADMIN: Full Access
-- Global admins can open/lock any geography in any project.
DROP POLICY IF EXISTS pgs_admin_all ON public.project_geography_states;
CREATE POLICY pgs_admin_all ON public.project_geography_states 
  FOR ALL TO authenticated 
  USING (is_admin()) 
  WITH CHECK (is_admin());

-- [POLICY 2] MANAGER: Full Bubble Control
-- Managers can view and update (Lock/Open) the state of their specific territory.
-- CREATE POLICY pgs_manager_all ON public.project_geography_states
--   FOR ALL 
--   TO authenticated
--   USING (
--     is_admin() 
--     OR (get_my_role() = 'manager' AND i_manage_project_geo(project_id, geography))
--   )
--   WITH CHECK (
--     is_admin() 
--     -- This ensures they can only INSERT/UPDATE rows within their own bubble
--     OR (get_my_role() = 'manager' AND i_manage_project_geo(project_id, geography))
--   );

CREATE POLICY pgs_manager_insert ON public.project_geography_states
  FOR INSERT TO authenticated
  -- Allow insertion if they are a manager/admin, regardless of existing assignment
  WITH CHECK (is_admin() OR is_manager_or_above());

CREATE POLICY pgs_manager_select_update ON public.project_geography_states
  FOR ALL TO authenticated
  USING (
    is_admin() 
    OR (is_manager_or_above() AND i_manage_project_geo(project_id, geography))
  );

-- [POLICY 3] CLIENT: Read
-- Clients can see the status of all geographies to monitor progress.
DROP POLICY IF EXISTS pgs_client_read ON public.project_geography_states;
CREATE POLICY pgs_client_read ON public.project_geography_states
  FOR SELECT TO authenticated
  USING (is_client());

-- [POLICY 4] TEAM: Read (Bubble Visibility)
-- Contributors, Team Leads, and Reviewers can only see the state 
-- of the Project + Geo they are actively assigned to.
DROP POLICY IF EXISTS pgs_team_read ON public.project_geography_states;
CREATE POLICY pgs_team_read ON public.project_geography_states
  FOR SELECT TO authenticated
  USING (i_am_member_of(project_id, geography));

CREATE POLICY chat_participant_read ON chat_messages
  FOR SELECT TO authenticated
  USING (
    sender_email    = (SELECT email FROM profiles WHERE id = auth.uid() LIMIT 1)
    OR recipient_email = (SELECT email FROM profiles WHERE id = auth.uid() LIMIT 1)
  );

CREATE POLICY chat_participant_insert ON chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_email = (SELECT email FROM profiles WHERE id = auth.uid() LIMIT 1)
  );

CREATE POLICY chat_recipient_update ON chat_messages
  FOR UPDATE TO authenticated
  USING (
    recipient_email = (SELECT email FROM profiles WHERE id = auth.uid() LIMIT 1)
  )
  WITH CHECK (
    recipient_email = (SELECT email FROM profiles WHERE id = auth.uid() LIMIT 1)
  );

CREATE POLICY chat_sender_delete ON chat_messages
  FOR DELETE TO authenticated
  USING (
    sender_email = (SELECT email FROM profiles WHERE id = auth.uid() LIMIT 1)
  );

ALTER TABLE public.attrition ENABLE ROW LEVEL SECURITY;

-- [POLICY 1] ADMIN: Full Access
DROP POLICY IF EXISTS attrition_admin_all ON public.attrition;
CREATE POLICY attrition_admin_all ON public.attrition 
  FOR ALL TO authenticated 
  USING (is_admin()) 
  WITH CHECK (is_admin());

-- [POLICY 2] MANAGER: Read (Bubble-Scoped)
-- Managers can see attrition logs for people who were in their specific territory.
DROP POLICY IF EXISTS attrition_manager_read ON public.attrition;
CREATE POLICY attrition_manager_read ON public.attrition
  FOR SELECT TO authenticated
  USING (
    is_admin() 
    OR (is_manager_or_above() AND i_manage_project_geo(project_id, geography))
  );

-- [POLICY 3] MANAGER: Insert
-- Managers can log an attrition event for someone in their territory.
DROP POLICY IF EXISTS attrition_manager_insert ON public.attrition;
CREATE POLICY attrition_manager_insert ON public.attrition
  FOR INSERT TO authenticated
  WITH CHECK (
    is_admin() 
    OR (is_manager_or_above() AND i_manage_project_geo(project_id, geography))
  );

-- [POLICY 4] MANAGER: Delete
-- Generally, attrition logs should be permanent, but this allows corrections within the bubble.
DROP POLICY IF EXISTS attrition_manager_delete ON public.attrition;
CREATE POLICY attrition_manager_delete ON public.attrition
  FOR DELETE TO authenticated
  USING (
    is_admin() 
    OR (is_manager_or_above() AND i_manage_project_geo(project_id, geography))
  );


-- 1. Enable RLS
ALTER TABLE public.app_logs ENABLE ROW LEVEL SECURITY;

-- [POLICY 1] ADMIN: Full Access
-- Admins can view, search, and purge logs.
DROP POLICY IF EXISTS app_logs_admin_all ON public.app_logs;
CREATE POLICY app_logs_admin_all ON public.app_logs 
  FOR ALL TO authenticated 
  USING (is_admin()) 
  WITH CHECK (is_admin());

-- [POLICY 2] AUTHENTICATED: Insert Only (The "Drop Box")
-- This allows the app to send logs to the database, but users cannot READ them back.
DROP POLICY IF EXISTS "Allow authenticated inserts only" ON public.app_logs;
CREATE POLICY "Allow authenticated inserts only" ON public.app_logs
  FOR INSERT 
  TO authenticated
  WITH CHECK (true);