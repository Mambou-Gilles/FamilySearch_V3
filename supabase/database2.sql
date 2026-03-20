-- =============================================================================
-- FamilySearch Project Hub — Full Database Schema  (Recursion-Safe Edition)
-- =============================================================================
-- KEY FIX: All helper functions use SECURITY DEFINER + SET search_path = public.
-- RLS policies on team_assignments NO LONGER self-join team_assignments.
-- Instead they call SECURITY DEFINER lookup functions that bypass RLS,
-- eliminating all infinite-recursion errors.
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
  CREATE TYPE project_type_enum AS ENUM ('hints', 'duplicates');
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
-- TABLES
-- =============================================================================

CREATE TABLE IF NOT EXISTS profiles (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email               TEXT NOT NULL UNIQUE,
  full_name           TEXT NOT NULL,
  byu_pathway_id      TEXT,
  cohort              TEXT,
  geography           TEXT,
  system_role         system_role_enum NOT NULL DEFAULT 'contributor',
  report_to           TEXT,
  active_project_type project_type_enum,
  status              profile_status_enum NOT NULL DEFAULT 'active',
  synced              BOOLEAN NOT NULL DEFAULT FALSE,
  logged_in           BOOLEAN NOT NULL DEFAULT FALSE,
  last_login          TIMESTAMPTZ,
  created_date        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_date        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by          TEXT
);

CREATE TABLE IF NOT EXISTS projects (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name           TEXT NOT NULL,
  project_type   project_type_enum NOT NULL,
  description    TEXT,
  client_name    TEXT,
  status         project_status_enum NOT NULL DEFAULT 'active',
  geographies    TEXT[] DEFAULT '{}',
  daily_target   INTEGER NOT NULL DEFAULT 50,
  weekly_target  INTEGER NOT NULL DEFAULT 250,
  created_date   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_date   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by     TEXT
);

CREATE TABLE IF NOT EXISTS team_assignments (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id            UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  project_type          project_type_enum NOT NULL,
  geography             TEXT NOT NULL,
  user_id               UUID,
  user_email            TEXT NOT NULL,
  user_name             TEXT NOT NULL,
  role                  assignment_role_enum NOT NULL,
  team_lead_email       TEXT,
  reviewer_email        TEXT,
  reviewer_name         TEXT,
  assigned_contributors TEXT[] DEFAULT '{}',
  work_percentage       INTEGER NOT NULL DEFAULT 100,
  review_percentage     INTEGER NOT NULL DEFAULT 100,
  daily_target          INTEGER,
  status                assignment_status_enum NOT NULL DEFAULT 'active',
  attrition_date        DATE,
  created_date          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_date          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by            TEXT
);

CREATE TABLE IF NOT EXISTS tasks (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id               UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  project_type             project_type_enum NOT NULL,
  geography                TEXT NOT NULL,
  cohort                   TEXT,
  url                      TEXT NOT NULL,
  fs_project_name          TEXT,
  member_connected         BOOLEAN,
  collection_name          TEXT,
  new_person_available     BOOLEAN,
  status                   task_status_enum NOT NULL DEFAULT 'available',
  batch_id                 TEXT,
  contributor_email        TEXT,
  contributor_name         TEXT,
  date_completed           TIMESTAMPTZ,
  original_completion_date TIMESTAMPTZ,
  correction_count         INTEGER NOT NULL DEFAULT 0,
  hint_result              TEXT,
  qualifications_created   INTEGER,
  new_persons_added        INTEGER,
  time_spent_contributor   TEXT,
  contributor_notes        TEXT,
  data_conflicts           TEXT,
  duplicate_result         TEXT,
  duplicates_resolved      TEXT,
  qualification_status     TEXT,
  revision_needed          BOOLEAN,
  reviewer_email           TEXT,
  reviewer_name            TEXT,
  review_date              TIMESTAMPTZ,
  tree_work_review         TEXT,
  doc_results              TEXT,
  time_spent_reviewer      TEXT,
  reviewer_notes           TEXT,
  quality_score_tree       INTEGER NOT NULL DEFAULT 0,
  quality_score_doc        INTEGER NOT NULL DEFAULT 0,
  total_quality_score      INTEGER NOT NULL DEFAULT 0,
  created_date             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_date             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by               TEXT
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id      UUID REFERENCES projects(id) ON DELETE SET NULL,
  task_id         UUID REFERENCES tasks(id) ON DELETE SET NULL,
  sender_email    TEXT NOT NULL,
  sender_name     TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  recipient_name  TEXT NOT NULL,
  message         TEXT NOT NULL,
  read            BOOLEAN NOT NULL DEFAULT FALSE,
  created_date    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_date    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      TEXT
);

CREATE TABLE IF NOT EXISTS attrition (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email             TEXT NOT NULL,
  full_name         TEXT NOT NULL,
  byu_pathway_id    TEXT,
  cohort            TEXT,
  role              TEXT NOT NULL,
  geography         TEXT,
  project_id        UUID REFERENCES projects(id) ON DELETE SET NULL,
  date_of_attrition TIMESTAMPTZ,
  deleted_by        TEXT,
  notes             TEXT,
  created_date      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_date      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by        TEXT
);

CREATE TABLE IF NOT EXISTS project_geography_states (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  geography       TEXT NOT NULL,
  status          geo_status_enum NOT NULL DEFAULT 'locked',
  sort_order      INTEGER,
  opened_by_email TEXT,
  opened_at       TIMESTAMPTZ,
  created_date    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_date    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      TEXT,
  UNIQUE (project_id, geography)
);

CREATE TABLE IF NOT EXISTS app_logs (
  id           BIGSERIAL PRIMARY KEY,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  user_email   TEXT,
  page_name    TEXT,
  action       TEXT,
  metadata     JSONB
);

-- Enable RLS but allow authenticated users to INSERT
ALTER TABLE app_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert their own logs" ON app_logs
  FOR INSERT TO authenticated WITH CHECK (user_email = auth.email());


-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_tasks_project_geo       ON tasks (project_id, geography);
CREATE INDEX IF NOT EXISTS idx_tasks_status            ON tasks (status);
CREATE INDEX IF NOT EXISTS idx_tasks_contributor_email ON tasks (contributor_email);
CREATE INDEX IF NOT EXISTS idx_tasks_reviewer_email    ON tasks (reviewer_email);
CREATE INDEX IF NOT EXISTS idx_tasks_date_completed    ON tasks (date_completed DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_review_date       ON tasks (review_date DESC);
CREATE INDEX IF NOT EXISTS idx_ta_project_geo          ON team_assignments (project_id, geography);
CREATE INDEX IF NOT EXISTS idx_ta_user_email           ON team_assignments (user_email);
CREATE INDEX IF NOT EXISTS idx_ta_reviewer_email       ON team_assignments (reviewer_email);
CREATE INDEX IF NOT EXISTS idx_ta_team_lead_email      ON team_assignments (team_lead_email);
CREATE INDEX IF NOT EXISTS idx_ta_role_status          ON team_assignments (role, status);
CREATE INDEX IF NOT EXISTS idx_chat_sender             ON chat_messages (sender_email);
CREATE INDEX IF NOT EXISTS idx_chat_recipient          ON chat_messages (recipient_email);
CREATE INDEX IF NOT EXISTS idx_profiles_email          ON profiles (email);
CREATE INDEX IF NOT EXISTS idx_profiles_role           ON profiles (system_role);
CREATE INDEX IF NOT EXISTS idx_attrition_email         ON attrition (email);
CREATE INDEX IF NOT EXISTS idx_attrition_project       ON attrition (project_id);
CREATE INDEX IF NOT EXISTS idx_pgs_project             ON project_geography_states (project_id);


-- =============================================================================
-- HELPER FUNCTIONS
-- ALL use SECURITY DEFINER + SET search_path = public.
-- Running as the DB owner means they bypass RLS on every table they read,
-- so calling them FROM an RLS policy never triggers another policy = no loops.
-- =============================================================================

-- Reads profiles directly (no RLS applied because SECURITY DEFINER).
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS system_role_enum
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT system_role FROM profiles WHERE email = auth.email() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE email = auth.email() AND system_role = 'admin' LIMIT 1
  );
$$;

CREATE OR REPLACE FUNCTION is_manager_or_above()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE email = auth.email() AND system_role IN ('admin','manager') LIMIT 1
  );
$$;

CREATE OR REPLACE FUNCTION is_team_lead_or_above()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE email = auth.email()
      AND system_role IN ('admin','manager','team_lead') LIMIT 1
  );
$$;

-- ── Anti-recursion lookup functions ──────────────────────────────────────────
-- Each reads team_assignments with SECURITY DEFINER so the read is NOT
-- intercepted by RLS on team_assignments — preventing any recursive loop.

-- TRUE if caller is an active manager for the given project + geography.
CREATE OR REPLACE FUNCTION i_manage_project_geo(p_project_id UUID, p_geography TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_assignments
    WHERE user_email = auth.email()
      AND role       = 'manager'
      AND status     = 'active'
      AND project_id = p_project_id
      AND geography  = p_geography
    LIMIT 1
  );
$$;

-- TRUE if caller is an active manager for the given project (any geo).
CREATE OR REPLACE FUNCTION i_manage_project(p_project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_assignments
    WHERE user_email = auth.email()
      AND role       = 'manager'
      AND status     = 'active'
      AND project_id = p_project_id
    LIMIT 1
  );
$$;

-- TRUE if caller is an active team_lead for the given project + geography.
CREATE OR REPLACE FUNCTION i_lead_project_geo(p_project_id UUID, p_geography TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_assignments
    WHERE user_email = auth.email()
      AND role       = 'team_lead'
      AND status     = 'active'
      AND project_id = p_project_id
      AND geography  = p_geography
    LIMIT 1
  );
$$;

-- TRUE if caller is an active team_lead for the given project (any geo).
CREATE OR REPLACE FUNCTION i_lead_project(p_project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_assignments
    WHERE user_email = auth.email()
      AND role       = 'team_lead'
      AND status     = 'active'
      AND project_id = p_project_id
    LIMIT 1
  );
$$;

-- TRUE if caller is an active team member for the given project + geography.
CREATE OR REPLACE FUNCTION i_am_member_of(p_project_id UUID, p_geography TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_assignments
    WHERE user_email = auth.email()
      AND status     = 'active'
      AND project_id = p_project_id
      AND geography  = p_geography
    LIMIT 1
  );
$$;

-- TRUE if the given contributor is assigned to the calling reviewer.
CREATE OR REPLACE FUNCTION is_my_contributor(p_contributor_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_assignments
    WHERE reviewer_email = auth.email()
      AND user_email     = p_contributor_email
      AND status         = 'active'
    LIMIT 1
  );
$$;

-- TRUE if caller has an active client assignment for the given project.
CREATE OR REPLACE FUNCTION i_am_client_of(p_project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_assignments
    WHERE user_email = auth.email()
      AND role       = 'client'
      AND status     = 'active'
      AND project_id = p_project_id
    LIMIT 1
  );
$$;


-- =============================================================================
-- TRIGGERS — auto-stamp updated_date
-- =============================================================================

CREATE OR REPLACE FUNCTION set_updated_date()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_date = NOW(); RETURN NEW; END;
$$;

DO $$ DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles','projects','team_assignments','tasks',
    'chat_messages','attrition','project_geography_states'
  ] LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_updated_date ON %I;
       CREATE TRIGGER trg_updated_date
         BEFORE UPDATE ON %I
         FOR EACH ROW EXECUTE FUNCTION set_updated_date();', t, t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION stamp_review_date()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'reviewed' AND OLD.status <> 'reviewed' AND NEW.review_date IS NULL THEN
    NEW.review_date = NOW();
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_stamp_review_date ON tasks;
CREATE TRIGGER trg_stamp_review_date
  BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION stamp_review_date();

CREATE OR REPLACE FUNCTION stamp_date_completed()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status <> 'completed' AND NEW.date_completed IS NULL THEN
    NEW.date_completed = NOW();
    IF NEW.original_completion_date IS NULL THEN
      NEW.original_completion_date = NOW();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_stamp_date_completed ON tasks;
CREATE TRIGGER trg_stamp_date_completed
  BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION stamp_date_completed();


-- =============================================================================
-- RPC FUNCTIONS
-- =============================================================================

CREATE OR REPLACE FUNCTION request_batch(batch_size INT DEFAULT 20)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_email    TEXT := auth.email();
  v_project  UUID;
  v_geo      TEXT;
  v_batch_id TEXT;
  v_count    INT;
BEGIN
  SELECT ta.project_id, ta.geography INTO v_project, v_geo
  FROM   team_assignments ta
  WHERE  ta.user_email = v_email AND ta.status = 'active' AND ta.role = 'contributor'
  LIMIT 1;

  IF v_project IS NULL THEN
    RAISE EXCEPTION 'No active contributor assignment found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM project_geography_states
    WHERE project_id = v_project AND geography = v_geo AND status = 'open'
  ) THEN
    RAISE EXCEPTION 'Geography is currently locked';
  END IF;

  v_batch_id := 'batch-' || extract(epoch FROM NOW())::BIGINT;

  WITH selected AS (
    SELECT id FROM tasks
    WHERE  project_id = v_project AND geography = v_geo AND status = 'available'
    ORDER  BY created_date
    LIMIT  batch_size
    FOR UPDATE SKIP LOCKED
  )
  UPDATE tasks t
  SET    status            = 'assigned',
         contributor_email = v_email,
         contributor_name  = (SELECT full_name FROM profiles WHERE email = v_email LIMIT 1),
         batch_id          = v_batch_id
  FROM   selected WHERE t.id = selected.id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION get_project_stats(p_project_id UUID)
RETURNS JSON LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public AS $$
DECLARE v_result JSON;
BEGIN
  IF NOT is_manager_or_above() THEN RAISE EXCEPTION 'Insufficient privileges'; END IF;
  SELECT json_build_object(
    'total',     COUNT(*),
    'available', COUNT(*) FILTER (WHERE status = 'available'),
    'assigned',  COUNT(*) FILTER (WHERE status = 'assigned'),
    'completed', COUNT(*) FILTER (WHERE status IN ('completed','in_review','needs_correction','reviewed')),
    'reviewed',  COUNT(*) FILTER (WHERE status = 'reviewed'),
    'avg_score', ROUND(AVG(total_quality_score) FILTER (WHERE status = 'reviewed'))
  ) INTO v_result FROM tasks WHERE project_id = p_project_id;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION open_geography(p_project_id UUID, p_geography TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF NOT is_manager_or_above() THEN RAISE EXCEPTION 'Insufficient privileges'; END IF;
  INSERT INTO project_geography_states (project_id, geography, status, opened_by_email, opened_at)
  VALUES (p_project_id, p_geography, 'open', auth.email(), NOW())
  ON CONFLICT (project_id, geography) DO UPDATE
    SET status = 'open', opened_by_email = auth.email(), opened_at = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION lock_geography(p_project_id UUID, p_geography TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF NOT is_manager_or_above() THEN RAISE EXCEPTION 'Insufficient privileges'; END IF;
  UPDATE project_geography_states SET status = 'locked'
  WHERE project_id = p_project_id AND geography = p_geography;
END;
$$;


-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================
-- ZERO RECURSION GUARANTEE:
--   • No RLS policy on team_assignments queries team_assignments.
--   • No RLS policy on tasks/projects/attrition/pgs queries team_assignments
--     directly — they call SECURITY DEFINER functions above which bypass RLS.
-- =============================================================================

-- Drop all old policies for a clean slate
DO $$ BEGIN
  DROP POLICY IF EXISTS profiles_admin_all          ON profiles;
  DROP POLICY IF EXISTS profiles_staff_read         ON profiles;
  DROP POLICY IF EXISTS profiles_self_read          ON profiles;
  DROP POLICY IF EXISTS profiles_self_update        ON profiles;
  DROP POLICY IF EXISTS profiles_manager_insert     ON profiles;
  DROP POLICY IF EXISTS projects_admin_all          ON projects;
  DROP POLICY IF EXISTS projects_member_read        ON projects;
  DROP POLICY IF EXISTS projects_manager_insert     ON projects;
  DROP POLICY IF EXISTS projects_manager_update     ON projects;
  DROP POLICY IF EXISTS ta_admin_all                ON team_assignments;
  DROP POLICY IF EXISTS ta_manager_select           ON team_assignments;
  DROP POLICY IF EXISTS ta_manager_insert           ON team_assignments;
  DROP POLICY IF EXISTS ta_manager_update           ON team_assignments;
  DROP POLICY IF EXISTS ta_manager_delete           ON team_assignments;
  DROP POLICY IF EXISTS ta_teamlead_read            ON team_assignments;
  DROP POLICY IF EXISTS ta_reviewer_read            ON team_assignments;
  DROP POLICY IF EXISTS ta_self_read                ON team_assignments;
  DROP POLICY IF EXISTS tasks_admin_all             ON tasks;
  DROP POLICY IF EXISTS tasks_manager_all           ON tasks;
  DROP POLICY IF EXISTS tasks_teamlead_read         ON tasks;
  DROP POLICY IF EXISTS tasks_reviewer_read         ON tasks;
  DROP POLICY IF EXISTS tasks_reviewer_update       ON tasks;
  DROP POLICY IF EXISTS tasks_contributor_read      ON tasks;
  DROP POLICY IF EXISTS tasks_contributor_update    ON tasks;
  DROP POLICY IF EXISTS tasks_client_read           ON tasks;
  DROP POLICY IF EXISTS chat_admin_all              ON chat_messages;
  DROP POLICY IF EXISTS chat_participant_read       ON chat_messages;
  DROP POLICY IF EXISTS chat_participant_insert     ON chat_messages;
  DROP POLICY IF EXISTS chat_recipient_update       ON chat_messages;
  DROP POLICY IF EXISTS chat_sender_delete          ON chat_messages;
  DROP POLICY IF EXISTS attrition_admin_all         ON attrition;
  DROP POLICY IF EXISTS attrition_manager_read      ON attrition;
  DROP POLICY IF EXISTS attrition_manager_insert    ON attrition;
  DROP POLICY IF EXISTS attrition_manager_delete    ON attrition;
  DROP POLICY IF EXISTS pgs_admin_all               ON project_geography_states;
  DROP POLICY IF EXISTS pgs_manager_all             ON project_geography_states;
  DROP POLICY IF EXISTS pgs_team_read               ON project_geography_states;
END $$;

ALTER TABLE profiles                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_assignments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages            ENABLE ROW LEVEL SECURITY;
ALTER TABLE attrition                ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_geography_states ENABLE ROW LEVEL SECURITY;


-- ── profiles ─────────────────────────────────────────────────────────────────
-- get_my_role() / is_*() read profiles with SECURITY DEFINER = no recursion.

CREATE POLICY profiles_admin_all ON profiles
  FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY profiles_staff_read ON profiles
  FOR SELECT TO authenticated
  USING (is_team_lead_or_above() OR get_my_role() = 'reviewer');

CREATE POLICY profiles_self_read ON profiles
  FOR SELECT TO authenticated
  USING (email = auth.email());

CREATE POLICY profiles_self_update ON profiles
  FOR UPDATE TO authenticated
  USING (email = auth.email()) WITH CHECK (email = auth.email());

CREATE POLICY profiles_manager_insert ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (is_manager_or_above());


-- ── projects ──────────────────────────────────────────────────────────────────
-- Uses i_manage_project() — SECURITY DEFINER, safe.

CREATE POLICY projects_admin_all ON projects
  FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY projects_member_read ON projects
  FOR SELECT TO authenticated
  USING (
    is_manager_or_above()
    OR EXISTS (
      SELECT 1 FROM team_assignments ta
      WHERE ta.project_id = projects.id
        AND ta.user_email  = auth.email()
        AND ta.status      = 'active'
    )
  );

CREATE POLICY projects_manager_insert ON projects
  FOR INSERT TO authenticated
  WITH CHECK (is_manager_or_above());

CREATE POLICY projects_manager_update ON projects
  FOR UPDATE TO authenticated
  USING (is_manager_or_above() AND i_manage_project(projects.id))
  WITH CHECK (is_manager_or_above());


-- ── team_assignments ──────────────────────────────────────────────────────────
-- CRITICAL: NO policy here ever queries team_assignments again.
-- i_manage_project_geo / i_lead_project_geo are SECURITY DEFINER.

CREATE POLICY ta_admin_all ON team_assignments
  FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- Manager sees all rows for their project+geo.
CREATE POLICY ta_manager_select ON team_assignments
  FOR SELECT TO authenticated
  USING (
    is_manager_or_above()
    AND i_manage_project_geo(team_assignments.project_id, team_assignments.geography)
  );

CREATE POLICY ta_manager_insert ON team_assignments
  FOR INSERT TO authenticated
  WITH CHECK (is_manager_or_above());

CREATE POLICY ta_manager_update ON team_assignments
  FOR UPDATE TO authenticated
  USING (is_manager_or_above()) WITH CHECK (is_manager_or_above());

CREATE POLICY ta_manager_delete ON team_assignments
  FOR DELETE TO authenticated
  USING (is_manager_or_above());

-- Team lead sees all rows for their project+geo.
CREATE POLICY ta_teamlead_read ON team_assignments
  FOR SELECT TO authenticated
  USING (
    get_my_role() = 'team_lead'
    AND i_lead_project_geo(team_assignments.project_id, team_assignments.geography)
  );

-- Reviewer sees their own row AND rows where they are the reviewer.
-- Simple column comparisons only — zero recursion risk.
CREATE POLICY ta_reviewer_read ON team_assignments
  FOR SELECT TO authenticated
  USING (
    get_my_role() = 'reviewer'
    AND (user_email = auth.email() OR reviewer_email = auth.email())
  );

-- Everyone can read their own assignment row.
CREATE POLICY ta_self_read ON team_assignments
  FOR SELECT TO authenticated
  USING (user_email = auth.email());


-- ── tasks ─────────────────────────────────────────────────────────────────────
-- Uses i_manage_project_geo, i_lead_project_geo, is_my_contributor,
-- i_am_member_of, i_am_client_of — all SECURITY DEFINER.

CREATE POLICY tasks_admin_all ON tasks
  FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY tasks_manager_all ON tasks
  FOR ALL TO authenticated
  USING (
    is_manager_or_above()
    AND i_manage_project_geo(tasks.project_id, tasks.geography)
  )
  WITH CHECK (
    is_manager_or_above()
    AND i_manage_project_geo(tasks.project_id, tasks.geography)
  );

CREATE POLICY tasks_teamlead_read ON tasks
  FOR SELECT TO authenticated
  USING (
    get_my_role() = 'team_lead'
    AND i_lead_project_geo(tasks.project_id, tasks.geography)
  );

CREATE POLICY tasks_reviewer_read ON tasks
  FOR SELECT TO authenticated
  USING (
    get_my_role() = 'reviewer'
    AND (
      reviewer_email = auth.email()
      OR is_my_contributor(tasks.contributor_email)
    )
  );

CREATE POLICY tasks_reviewer_update ON tasks
  FOR UPDATE TO authenticated
  USING (
    get_my_role() = 'reviewer'
    AND status IN ('completed','in_review','needs_correction')
    AND (
      reviewer_email = auth.email()
      OR is_my_contributor(tasks.contributor_email)
    )
  )
  WITH CHECK (get_my_role() = 'reviewer');

DROP POLICY IF EXISTS tasks_contributor_read ON tasks;
CREATE POLICY tasks_contributor_read ON tasks
  FOR SELECT TO authenticated
  USING (
    get_my_role() = 'contributor'
    AND (
      contributor_email = auth.email() -- Always see your own assigned work
      OR (
        status = 'available' -- Only see "Requestable" tasks if:
        AND i_am_member_of(tasks.project_id, tasks.geography) -- 1. You are assigned to this Project/Geo
        AND EXISTS (
            -- 2. AND the Geography is specifically marked as 'open'
            SELECT 1 FROM project_geography_states pgs 
            WHERE pgs.project_id = tasks.project_id 
              AND pgs.geography = tasks.geography 
              AND pgs.status = 'open'
        )
      )
    )
  );

CREATE POLICY tasks_contributor_update ON tasks
  FOR UPDATE TO authenticated
  USING (
    get_my_role() = 'contributor'
    AND contributor_email = auth.email()
    AND status IN ('assigned','needs_correction')
  )
  WITH CHECK (
    get_my_role() = 'contributor'
    AND contributor_email = auth.email()
  );

CREATE POLICY tasks_client_read ON tasks
  FOR SELECT TO authenticated
  USING (
    get_my_role() = 'client'
    AND i_am_client_of(tasks.project_id)
  );


-- ── chat_messages ─────────────────────────────────────────────────────────────
-- No cross-table lookups needed.

CREATE POLICY chat_admin_all ON chat_messages
  FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY chat_participant_read ON chat_messages
  FOR SELECT TO authenticated
  USING (sender_email = auth.email() OR recipient_email = auth.email());

CREATE POLICY chat_participant_insert ON chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (sender_email = auth.email());

CREATE POLICY chat_recipient_update ON chat_messages
  FOR UPDATE TO authenticated
  USING (recipient_email = auth.email())
  WITH CHECK (recipient_email = auth.email());

CREATE POLICY chat_sender_delete ON chat_messages
  FOR DELETE TO authenticated
  USING (sender_email = auth.email());


-- ── attrition ─────────────────────────────────────────────────────────────────

CREATE POLICY attrition_admin_all ON attrition
  FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY attrition_manager_read ON attrition
  FOR SELECT TO authenticated
  USING (
    is_manager_or_above()
    OR (
      get_my_role() = 'team_lead'
      AND i_lead_project(attrition.project_id)
    )
  );

CREATE POLICY attrition_manager_insert ON attrition
  FOR INSERT TO authenticated
  WITH CHECK (is_manager_or_above());

CREATE POLICY attrition_manager_delete ON attrition
  FOR DELETE TO authenticated
  USING (is_manager_or_above());


-- ── project_geography_states ──────────────────────────────────────────────────

CREATE POLICY pgs_admin_all ON project_geography_states
  FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY pgs_manager_all ON project_geography_states
  FOR ALL TO authenticated
  USING (
    is_manager_or_above()
    AND i_manage_project_geo(
      project_geography_states.project_id,
      project_geography_states.geography
    )
  )
  WITH CHECK (is_manager_or_above());

CREATE POLICY pgs_team_read ON project_geography_states
  FOR SELECT TO authenticated
  USING (
    i_am_member_of(
      project_geography_states.project_id,
      project_geography_states.geography
    )
  );


-- =============================================================================
-- GRANTS
-- =============================================================================

GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;


-- =============================================================================
-- END OF SCHEMA  (Recursion-Safe Edition)
-- =============================================================================


-- 2. Create a Function that automatically handles Profile creation/sync upon signup
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, system_role)
  VALUES (
    new.id, 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'full_name', new.email),
    'contributor' -- Default role for everyone
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create the Trigger to fire whenever a user signs up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- Allow authenticated users to insert logs
CREATE POLICY "Allow authenticated inserts" 
ON public.app_logs 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Allow authenticated users to read projects
CREATE POLICY "Allow users to read projects" 
ON public.projects 
FOR SELECT 
TO authenticated 
USING (true);

-- Allow authenticated users to read tasks
CREATE POLICY "Allow users to read tasks" 
ON public.tasks 
FOR SELECT 
TO authenticated 
USING (true);



-- Sync existing users who are already in Auth but missing from Profiles
INSERT INTO public.profiles (id, email, full_name, system_role)
SELECT 
  id, 
  email, 
  COALESCE(raw_user_meta_data->>'full_name', email), 
  'contributor'
FROM auth.users
ON CONFLICT (id) DO NOTHING;






-- 1. Create the function that inserts a row into public.profiles
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, system_role)
  values (
    new.id,                  -- Maps auth.uid to profiles.id
    new.email,               -- Maps auth.email to profiles.email
    new.email,               -- As requested: auth.email maps to full_name
    'contributor'            -- Sets default role to contributor
  );
  return new;
end;
$$;

-- 2. Create the trigger to run every time a user is added to auth.users
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


--NEVER USE THIS
DO $$
DECLARE
    profile_record RECORD;
    created_count INTEGER := 0;
    skipped_count INTEGER := 0;
BEGIN
    -- Ensure pgcrypto is available for the crypt function
    CREATE EXTENSION IF NOT EXISTS pgcrypto;

    FOR profile_record IN SELECT id, email, full_name FROM public.profiles LOOP
        
        -- 1. Check if the user already exists in the Auth table
        IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = profile_record.email) THEN
            
            -- 2. Create the Auth User
            INSERT INTO auth.users (
                instance_id, 
                id, 
                aud, 
                role, 
                email, 
                encrypted_password, 
                email_confirmed_at, 
                raw_app_meta_data, 
                raw_user_meta_data, 
                created_at, 
                updated_at, 
                confirmation_token, 
                email_change, 
                email_change_sent_at, 
                is_super_admin
            )
            VALUES (
                '00000000-0000-0000-0000-000000000000',
                profile_record.id, 
                'authenticated',
                'authenticated',
                profile_record.email,
                crypt('123456789', gen_salt('bf')), 
                now(),
                '{"provider":"email","providers":["email"]}',
                jsonb_build_object('full_name', profile_record.full_name),
                now(),
                now(),
                '',
                '',
                now(),
                FALSE
            );

            -- 3. Create the Identity (Including provider_id)
            INSERT INTO auth.identities (
                id,
                user_id,
                identity_data,
                provider,
                provider_id, -- Added this to satisfy the not-null constraint
                last_sign_in_at,
                created_at,
                updated_at
            )
            VALUES (
                gen_random_uuid(),
                profile_record.id,
                jsonb_build_object('sub', profile_record.id, 'email', profile_record.email),
                'email',
                profile_record.email, -- For email provider, provider_id is the email
                now(),
                now(),
                now()
            );
            
            created_count := created_count + 1;
            RAISE NOTICE 'SUCCESS: Created auth user for %', profile_record.email;

        ELSE
            skipped_count := skipped_count + 1;
            RAISE NOTICE 'SKIPPED: % already exists in Auth', profile_record.email;
        END IF;

    END LOOP;

    RAISE NOTICE '-----------------------------------------';
    RAISE NOTICE 'SYNC COMPLETE: % created, % skipped.', created_count, skipped_count;
    RAISE NOTICE '-----------------------------------------';
END $$;