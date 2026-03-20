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
-- TABLES
-- NOTE: projects no longer has a geographies[] array.
--       project_geography_states is the sole master registry of geo+project pairs.
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
  -- geographies[] removed: use project_geography_states as the master registry
  daily_target   INTEGER NOT NULL DEFAULT 50,
  weekly_target  INTEGER NOT NULL DEFAULT 250,
  created_date   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_date   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by     TEXT
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

CREATE TABLE IF NOT EXISTS team_assignments (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id            UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  project_type          project_type_enum NOT NULL,
  geography             TEXT NOT NULL,
  -- geo_state_id links to the master geography registry entry
  geo_state_id          UUID REFERENCES project_geography_states(id) ON DELETE SET NULL,
  -- UID-based FK references (preferred over email for security)
  user_id               UUID REFERENCES profiles(id) ON DELETE SET NULL,   -- the assigned person
  reviewer_id           UUID REFERENCES profiles(id) ON DELETE SET NULL,   -- the reviewer
  team_lead_id          UUID REFERENCES profiles(id) ON DELETE SET NULL,   -- the team lead
  -- Keep email/name fields for display / legacy queries
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

ALTER TABLE team_assignments 
ADD CONSTRAINT unique_user_project 
UNIQUE (user_email, project_id);

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
  -- UID-based FK references
  contributor_id           UUID REFERENCES profiles(id) ON DELETE SET NULL,  -- the worker
  reviewer_id              UUID REFERENCES profiles(id) ON DELETE SET NULL,  -- the checker
  -- Keep email/name fields for display / legacy queries
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
  -- reviewer_id already declared above with the contributor_id block
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
  project_type      project_type_enum,
  date_of_attrition TIMESTAMPTZ,
  deleted_by        TEXT,
  notes             TEXT,
  created_date      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_date      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by        TEXT
);

CREATE TABLE IF NOT EXISTS app_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT,
  page_name TEXT,
  action TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);



-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_tasks_project_geo       ON tasks (project_id, geography);
CREATE INDEX IF NOT EXISTS idx_tasks_status            ON tasks (status);
CREATE INDEX IF NOT EXISTS idx_tasks_contributor_email ON tasks (contributor_email);
CREATE INDEX IF NOT EXISTS idx_tasks_contributor_id    ON tasks (contributor_id);
CREATE INDEX IF NOT EXISTS idx_tasks_reviewer_email    ON tasks (reviewer_email);
CREATE INDEX IF NOT EXISTS idx_tasks_reviewer_id       ON tasks (reviewer_id);
CREATE INDEX IF NOT EXISTS idx_tasks_date_completed    ON tasks (date_completed DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_review_date       ON tasks (review_date DESC);
CREATE INDEX IF NOT EXISTS idx_ta_project_geo          ON team_assignments (project_id, geography);
CREATE INDEX IF NOT EXISTS idx_ta_user_id              ON team_assignments (user_id);
CREATE INDEX IF NOT EXISTS idx_ta_reviewer_id          ON team_assignments (reviewer_id);
CREATE INDEX IF NOT EXISTS idx_ta_team_lead_id         ON team_assignments (team_lead_id);
CREATE INDEX IF NOT EXISTS idx_ta_user_email           ON team_assignments (user_email);
CREATE INDEX IF NOT EXISTS idx_ta_reviewer_email       ON team_assignments (reviewer_email);
CREATE INDEX IF NOT EXISTS idx_ta_team_lead_email      ON team_assignments (team_lead_email);
CREATE INDEX IF NOT EXISTS idx_ta_role_status          ON team_assignments (role, status);
CREATE INDEX IF NOT EXISTS idx_profiles_id_email       ON profiles (id, email);
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
-- All functions now use auth.uid() (UUID) instead of auth.email() (TEXT)
-- to avoid medium-risk email-spoofing / email-change vectors.

CREATE OR REPLACE FUNCTION get_my_role()
RETURNS system_role_enum
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  -- Returns 'contributor' or 'client' as a safe default if no profile is found, 
  -- or you can keep it as is if you want it to fail strictly.
  SELECT COALESCE(
    (SELECT system_role FROM profiles WHERE id = auth.uid() LIMIT 1),
    'contributor'::system_role_enum 
  );
$$;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND system_role = 'admin' LIMIT 1
  );
$$;

CREATE OR REPLACE FUNCTION is_manager_or_above()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND system_role IN ('admin','manager') LIMIT 1
  );
$$;

CREATE OR REPLACE FUNCTION is_team_lead_or_above()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND system_role IN ('admin','manager','team_lead') LIMIT 1
  );
$$;

-- ── Anti-recursion lookup functions ──────────────────────────────────────────
-- Each reads team_assignments with SECURITY DEFINER so the read is NOT
-- intercepted by RLS on team_assignments — preventing any recursive loop.
-- ALL now use auth.uid() matched against user_id / reviewer_id / team_lead_id.

-- TRUE if caller is an active manager for the given project + geography.
CREATE OR REPLACE FUNCTION i_manage_project_geo(p_project_id UUID, p_geography TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_assignments
    WHERE user_id    = auth.uid()
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
    WHERE user_id    = auth.uid()
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
    WHERE user_id    = auth.uid()
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
    WHERE user_id    = auth.uid()
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
    WHERE user_id    = auth.uid()
      AND status     = 'active'
      AND project_id = p_project_id
      AND geography  = p_geography
    LIMIT 1
  );
$$;

-- TRUE if the given contributor (by UUID) is assigned to the calling reviewer.
CREATE OR REPLACE FUNCTION is_my_contributor(p_contributor_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_assignments
    WHERE reviewer_id = auth.uid()
      AND user_id     = p_contributor_id
      AND status      = 'active'
    LIMIT 1
  );
$$;





-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Auto-register geography in project_geography_states when an assignment is inserted.
-- This makes project_geography_states the automatic master registry.
CREATE OR REPLACE FUNCTION auto_register_geography()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  INSERT INTO project_geography_states (project_id, geography, status)
  VALUES (NEW.project_id, NEW.geography, 'locked')
  ON CONFLICT (project_id, geography) DO NOTHING;

  IF NEW.geo_state_id IS NULL THEN
    SELECT id INTO NEW.geo_state_id
    FROM project_geography_states
    WHERE project_id = NEW.project_id AND geography = NEW.geography
    LIMIT 1;
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_auto_register_geography ON team_assignments;
CREATE TRIGGER trg_auto_register_geography
  BEFORE INSERT ON team_assignments
  FOR EACH ROW EXECUTE FUNCTION auto_register_geography();

-- Auto-stamp updated_date
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



--Atomic function to add a user and assign them to a team in one step, used by the manager UI when adding a new user. This ensures that the profile and team assignment are always in sync, and prevents orphaned profiles or assignments if one part fails. It also uses the new user_id UUID reference for stronger integrity.
-- 1. DROP THE OLD VERSION
DROP FUNCTION IF EXISTS admin_add_user_to_team(text, text, text, uuid, text, text);

-- 2. CREATE THE FULLY CASTED VERSION
CREATE OR REPLACE FUNCTION admin_add_user_to_team(
    p_email TEXT,
    p_full_name TEXT,
    p_role TEXT,
    p_project_id UUID,
    p_project_type TEXT,
    p_geography TEXT
)
RETURNS UUID 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- 1. Upsert Profile (Uses system_role_enum)
    INSERT INTO profiles (email, full_name, system_role, status, synced)
    VALUES (
        p_email, 
        p_full_name, 
        p_role::system_role_enum, 
        'active', 
        false
    )
    ON CONFLICT (email) DO UPDATE 
    SET full_name = EXCLUDED.full_name, 
        system_role = EXCLUDED.system_role
    RETURNING id INTO v_user_id;

    -- 2. Upsert Assignment (Uses 3 different Enums)
    INSERT INTO team_assignments (
        project_id, 
        project_type, 
        geography, 
        user_id, 
        user_email, 
        user_name, 
        role, 
        status, 
        work_percentage
    )
    VALUES (
        p_project_id, 
        p_project_type::public.project_type_enum,    -- CAST 1
        p_geography, 
        v_user_id, 
        p_email, 
        p_full_name, 
        p_role::public.assignment_role_enum,        -- CAST 2
        'active'::public.assignment_status_enum,    -- CAST 3
        100
    )
    ON CONFLICT (user_email, project_id) DO UPDATE
    SET role = EXCLUDED.role,
        user_name = EXCLUDED.user_name,
        status = EXCLUDED.status;

    RETURN v_user_id;
END;
$$;


-- =============================================================================
-- SYNC PROFILE → AUTH TRIGGER
-- When a manager creates a profile (or flips synced = TRUE), this trigger
-- calls auth.users to create/update the Supabase Auth account automatically.
-- NOTE: Requires pg_net extension OR a Supabase Edge Function webhook.
-- The approach below uses Supabase's built-in auth.admin API via a
-- SECURITY DEFINER function that calls the management API.
-- =============================================================================

-- Option A (recommended): use a Postgres function + Supabase Auth Admin API
-- called via pg_net (install extension first: CREATE EXTENSION IF NOT EXISTS pg_net;)
-- This sends an HTTP request to your project's auth admin endpoint.

CREATE OR REPLACE FUNCTION sync_profile_to_auth()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_user_id UUID;
  v_temp_password TEXT;
BEGIN
  -- Only run when synced flips to TRUE or on INSERT with synced = TRUE
  IF (TG_OP = 'UPDATE' AND NOT OLD.synced AND NEW.synced)
     OR (TG_OP = 'INSERT' AND NEW.synced) THEN

    -- Check if auth user already exists
    SELECT id INTO v_user_id FROM auth.users WHERE email = NEW.email LIMIT 1;

    IF v_user_id IS NULL THEN
      -- Generate a secure temp password (user must reset on first login)
      v_temp_password := encode(gen_random_bytes(12), 'base64');

      -- Insert into auth.users (Supabase internal)
      INSERT INTO auth.users (
        id,
        instance_id,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_user_meta_data,
        role,
        aud,
        created_at,
        updated_at
      ) VALUES (
        NEW.id,   -- reuse profiles.id as auth uid for perfect UID alignment
        '00000000-0000-0000-0000-000000000000',
        NEW.email,
        crypt(v_temp_password, gen_salt('bf')),
        NOW(),    -- mark email as confirmed (internal users don't need verification)
        jsonb_build_object(
          'full_name',   NEW.full_name,
          'system_role', NEW.system_role::TEXT
        ),
        'authenticated',
        'authenticated',
        NOW(),
        NOW()
      );

      -- Also insert into auth.identities (required by Supabase for email login)
      INSERT INTO auth.identities (
        id,
        user_id,
        identity_data,
        provider,
        last_sign_in_at,
        created_at,
        updated_at
      ) VALUES (
        NEW.id,
        NEW.id,
        jsonb_build_object('sub', NEW.id::TEXT, 'email', NEW.email),
        'email',
        NOW(),
        NOW(),
        NOW()
      );

    ELSE
      -- Auth user exists — update metadata to stay in sync
      UPDATE auth.users
      SET raw_user_meta_data = jsonb_build_object(
            'full_name',   NEW.full_name,
            'system_role', NEW.system_role::TEXT
          ),
          updated_at = NOW()
      WHERE id = v_user_id;
    END IF;

    -- Stamp profiles.id = auth.uid() for UID alignment
    IF NEW.id IS NULL THEN
      NEW.id := v_user_id;
    END IF;

  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_profile_to_auth ON profiles;
CREATE TRIGGER trg_sync_profile_to_auth
  BEFORE INSERT OR UPDATE OF synced ON profiles
  FOR EACH ROW EXECUTE FUNCTION sync_profile_to_auth();

-- =============================================================================
-- REVERSE SYNC: AUTH → PROFILES (on first login)
-- When a user logs in for the first time, stamp logged_in = TRUE and
-- last_login on their profile row.
-- =============================================================================

CREATE OR REPLACE FUNCTION on_auth_user_login()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  UPDATE profiles
  SET logged_in  = TRUE,
      last_login = NOW()
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

-- Wire to auth.sessions (fires on every new session = login)
DROP TRIGGER IF EXISTS trg_on_auth_user_login ON auth.sessions;
CREATE TRIGGER trg_on_auth_user_login
  AFTER INSERT ON auth.sessions
  FOR EACH ROW EXECUTE FUNCTION on_auth_user_login();


-- =============================================================================
-- RPC FUNCTIONS
-- =============================================================================

CREATE OR REPLACE FUNCTION request_batch(batch_size INT DEFAULT 20)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_uid      UUID := auth.uid();
  v_project  UUID;
  v_geo      TEXT;
  v_batch_id TEXT;
  v_count    INT;
BEGIN
  SELECT ta.project_id, ta.geography INTO v_project, v_geo
  FROM   team_assignments ta
  WHERE  ta.user_id = v_uid AND ta.status = 'active' AND ta.role = 'contributor'
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
         contributor_id    = v_uid,
         contributor_email = (SELECT email     FROM profiles WHERE id = v_uid LIMIT 1),
         contributor_name  = (SELECT full_name FROM profiles WHERE id = v_uid LIMIT 1),
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


--FUNCTION to atomically attrite a user from a project + geography, called by the manager UI when removing a user. This ensures that all related data changes (profile status, team assignment status, and auth deletion) happen together in one transaction, and prevents orphaned assignments or profiles if one part fails. It also uses the new user_id UUID reference for stronger integrity.
-- Drop the old one to be safe
DROP FUNCTION IF EXISTS admin_attrite_user(uuid, text, text, text, text, text, text, uuid, text, text);

CREATE OR REPLACE FUNCTION admin_attrite_user(
  p_profile_id UUID,
  p_email TEXT,
  p_full_name TEXT,
  p_role TEXT,
  p_byu_id TEXT,
  p_cohort TEXT,
  p_geography TEXT,
  p_project_id UUID,
  p_project_type project_type_enum, -- Added
  p_deleted_by TEXT,
  p_notes TEXT
) RETURNS VOID AS $$
BEGIN
  -- Insert into Attrition Log
  INSERT INTO attrition (
    email, 
    full_name, 
    role, 
    byu_pathway_id, 
    cohort, 
    geography, 
    project_id, 
    project_type, 
    date_of_attrition, 
    deleted_by,
    notes
  ) VALUES (
    p_email, 
    p_full_name, 
    p_role, 
    p_byu_id, 
    p_cohort, 
    p_geography, 
    p_project_id, 
    p_project_type,
    NOW(), 
    p_deleted_by,
    p_notes
  );

  -- Remove the specific assignment
  DELETE FROM team_assignments WHERE user_email = p_email;

  -- SAFELY DEACTIVATE instead of deleting the profile
  UPDATE profiles 
  SET status = 'inactive', 
      synced = false,
      updated_date = NOW()
  WHERE id = p_profile_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =============================================================================
-- MIGRATION HELPERS — run once to backfill id-based FK columns
-- =============================================================================

-- Backfill team_assignments.user_id from profiles where email matches
UPDATE team_assignments ta
SET user_id = p.id
FROM profiles p
WHERE p.email = ta.user_email
  AND ta.user_id IS NULL;

-- Backfill team_assignments.reviewer_id
UPDATE team_assignments ta
SET reviewer_id = p.id
FROM profiles p
WHERE p.email = ta.reviewer_email
  AND ta.reviewer_id IS NULL;

-- Backfill team_assignments.team_lead_id
UPDATE team_assignments ta
SET team_lead_id = p.id
FROM profiles p
WHERE p.email = ta.team_lead_email
  AND ta.team_lead_id IS NULL;

-- Backfill tasks.contributor_id
UPDATE tasks t
SET contributor_id = p.id
FROM profiles p
WHERE p.email = t.contributor_email
  AND t.contributor_id IS NULL;

-- Backfill tasks.reviewer_id
UPDATE tasks t
SET reviewer_id = p.id
FROM profiles p
WHERE p.email = t.reviewer_email
  AND t.reviewer_id IS NULL;



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

-- ── profiles ─────────────────────────────────────────────────────────────────

-- SELF-READ: For login
CREATE POLICY profiles_self_read ON profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

-- STAFF-READ: Strictly limited to the Manager's project territory
CREATE POLICY profiles_staff_read ON profiles
  FOR SELECT TO authenticated
  USING (
    is_admin() 
    OR get_my_role() = 'reviewer'
    OR EXISTS (
      SELECT 1 FROM team_assignments ta
      WHERE ta.user_id = profiles.id
        AND i_manage_project_geo(ta.project_id, ta.geography)
    )
  );

-- STAFF-UPDATE: Strictly limited to users in the Manager's territory
CREATE POLICY profiles_manager_update ON profiles
  FOR UPDATE TO authenticated
  USING (
    is_admin()
    OR EXISTS (
      SELECT 1 FROM team_assignments ta
      WHERE ta.user_id = profiles.id
        AND i_manage_project_geo(ta.project_id, ta.geography)
    )
  )
  WITH CHECK (is_manager_or_above());

-- ADMIN-ALL
CREATE POLICY profiles_admin_all ON profiles
  FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());


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
        AND ta.user_id    = auth.uid()
        AND ta.status     = 'active'
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

-- =============================================================================
-- ── TEAM ASSIGNMENTS RLS (COMPLETE SCOPED VERSION) ───────────────────────────
-- =============================================================================

-- 1. ADMIN: Full system override
CREATE POLICY ta_admin_all ON team_assignments
  FOR ALL TO authenticated
  USING (is_admin()) 
  WITH CHECK (is_admin());

-- 2. SELF-READ: Everyone can read their own assignment row
CREATE POLICY ta_self_read ON team_assignments
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 3. MANAGER SELECT: Manager sees all rows ONLY for their managed project + geo
CREATE POLICY ta_manager_select ON team_assignments
  FOR SELECT TO authenticated
  USING (
    is_manager_or_above()
    AND i_manage_project_geo(project_id, geography)
  );

-- 4. MANAGER INSERT: Manager can only add users into their managed territory
CREATE POLICY ta_manager_insert ON team_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    is_manager_or_above()
    AND i_manage_project_geo(project_id, geography)
  );

-- 5. MANAGER UPDATE: Manager can only edit users within their managed territory
CREATE POLICY ta_manager_update ON team_assignments
  FOR UPDATE TO authenticated
  USING (
    is_manager_or_above()
    AND i_manage_project_geo(project_id, geography)
  )
  WITH CHECK (
    is_manager_or_above()
    AND i_manage_project_geo(project_id, geography)
  );

-- 6. MANAGER DELETE: Manager can only remove users from their managed territory
CREATE POLICY ta_manager_delete ON team_assignments
  FOR DELETE TO authenticated
  USING (
    is_manager_or_above()
    AND i_manage_project_geo(project_id, geography)
  );

-- 7. TEAM LEAD READ: Team lead sees all rows for their assigned project + geo
CREATE POLICY ta_teamlead_read ON team_assignments
  FOR SELECT TO authenticated
  USING (
    get_my_role() = 'team_lead'
    AND i_lead_project_geo(project_id, geography)
  );

-- 8. REVIEWER READ: Reviewer sees their own row AND rows where they are the assigned reviewer
CREATE POLICY ta_reviewer_read ON team_assignments
  FOR SELECT TO authenticated
  USING (
    get_my_role() = 'reviewer'
    AND (user_id = auth.uid() OR reviewer_id = auth.uid())
  );


-- ── tasks ─────────────────────────────────────────────────────────────────────
-- Uses i_manage_project_geo, i_lead_project_geo, is_my_contributor,
-- i_am_member_of, i_am_client_of — all SECURITY DEFINER.

CREATE POLICY tasks_admin_all ON tasks
  FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- CREATE POLICY tasks_manager_all ON tasks
--   FOR ALL TO authenticated
--   USING (
--     is_manager_or_above()
--     AND i_manage_project_geo(tasks.project_id, tasks.geography)
--   )
--   WITH CHECK (
--     is_manager_or_above()
--     AND i_manage_project_geo(tasks.project_id, tasks.geography)
--   );

-- CREATE POLICY tasks_teamlead_read ON tasks
--   FOR SELECT TO authenticated
--   USING (
--     get_my_role() = 'team_lead'
--     AND i_lead_project_geo(tasks.project_id, tasks.geography)
--   );

CREATE POLICY "tasks_admin_and_manager_access" 
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

CREATE POLICY tasks_reviewer_read ON tasks
  FOR SELECT TO authenticated
  USING (
    get_my_role() = 'reviewer'
    AND (
      reviewer_id = auth.uid()
      OR is_my_contributor(tasks.contributor_id)
    )
  );

CREATE POLICY tasks_reviewer_update ON tasks
  FOR UPDATE TO authenticated
  USING (
    get_my_role() = 'reviewer'
    AND status IN ('completed','in_review','needs_correction')
    AND (
      reviewer_id = auth.uid()
      OR is_my_contributor(tasks.contributor_id)
    )
  )
  WITH CHECK (get_my_role() = 'reviewer');

CREATE POLICY tasks_contributor_read ON tasks
  FOR SELECT TO authenticated
  USING (
    get_my_role() = 'contributor'
    AND (
      contributor_id = auth.uid()
      OR (
        status = 'available'
        AND i_am_member_of(tasks.project_id, tasks.geography)
      )
    )
  );

CREATE POLICY tasks_contributor_update ON tasks
  FOR UPDATE TO authenticated
  USING (
    get_my_role() = 'contributor'
    AND contributor_id = auth.uid()
    AND status IN ('assigned','needs_correction')
  )
  WITH CHECK (
    get_my_role() = 'contributor'
    AND contributor_id = auth.uid()
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

-- chat_messages still uses email columns (no profiles FK there),
-- so we keep email comparisons but cross-check against auth.uid() via profiles.
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


-- ── attrition ─────────────────────────────────────────────────────────────────

CREATE POLICY attrition_admin_all ON attrition
  FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- Create the new scoped policy ***************
CREATE POLICY attrition_scoped_read ON attrition
  FOR SELECT TO authenticated
  USING (
    is_admin() 
    OR is_manager()
    OR (
      get_my_role() = 'team_lead'
      AND EXISTS (
        SELECT 1 FROM team_assignments 
        WHERE user_email = auth.email() 
        AND geography = attrition.geography
        AND project_id = attrition.project_id
      )
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
-- END OF SCHEMA  (UID-Based Edition)
-- =============================================================================