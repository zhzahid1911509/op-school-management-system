-- One atomic, serialized startup migration, including upgrades from milestone 1.
BEGIN;
SELECT pg_advisory_xact_lock(705134621);
CREATE SCHEMA IF NOT EXISTS admission;
CREATE TABLE IF NOT EXISTS admission.classes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL CHECK (btrim(name) <> ''),
    total_seats integer NOT NULL CHECK (total_seats > 0)
);
CREATE TABLE IF NOT EXISTS admission.holds (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id uuid NOT NULL REFERENCES admission.classes(id),
    student_id text NOT NULL CHECK (student_id ~ '^[0-9]{17}$'),
    status text NOT NULL CHECK (status IN ('HELD','CONFIRMED','EXPIRED','CANCELLED')),
    expires_at timestamptz NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS one_admission_per_student
    ON admission.holds(class_id, student_id) WHERE status IN ('HELD','CONFIRMED');
CREATE INDEX IF NOT EXISTS holds_due ON admission.holds(expires_at, class_id) WHERE status = 'HELD';

CREATE OR REPLACE FUNCTION admission.reserve(p_class uuid, p_student text, p_seconds integer)
RETURNS admission.holds LANGUAGE plpgsql AS $$
DECLARE
    capacity integer;
    decision_time timestamptz;
    result admission.holds;
BEGIN
    SELECT total_seats INTO capacity FROM admission.classes WHERE id = p_class FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Class not found' USING ERRCODE = 'A0404'; END IF;
    IF p_seconds IS NULL OR p_seconds < 1 THEN RAISE EXCEPTION 'Invalid hold duration'; END IF;
    decision_time := clock_timestamp();
    UPDATE admission.holds SET status = 'EXPIRED'
        WHERE class_id = p_class AND status = 'HELD' AND expires_at <= decision_time;
    IF EXISTS (SELECT FROM admission.holds WHERE class_id = p_class AND student_id = p_student
               AND status IN ('HELD','CONFIRMED')) THEN
        RAISE EXCEPTION 'Student already has an admission for this class' USING ERRCODE = 'A0409';
    END IF;
    IF (SELECT count(*) FROM admission.holds WHERE class_id = p_class
        AND status IN ('HELD','CONFIRMED')) >= capacity THEN
        RAISE EXCEPTION 'Class is full' USING ERRCODE = 'A0409';
    END IF;
    INSERT INTO admission.holds(class_id, student_id, status, expires_at)
        VALUES (p_class, p_student, 'HELD', decision_time + make_interval(secs => p_seconds))
        RETURNING * INTO result;
    RETURN result;
END $$;

CREATE OR REPLACE FUNCTION admission.transition(p_hold uuid, p_student text, p_target text)
RETURNS admission.holds LANGUAGE plpgsql AS $$
DECLARE result admission.holds;
BEGIN
    -- Every writer locks the parent class first, including the expiry worker.
    PERFORM 1 FROM admission.classes c JOIN admission.holds h ON h.class_id = c.id
        WHERE h.id = p_hold FOR UPDATE OF c;
    IF NOT FOUND THEN RAISE EXCEPTION 'Application not found' USING ERRCODE = 'A0404'; END IF;
    SELECT * INTO STRICT result FROM admission.holds WHERE id = p_hold;
    IF result.student_id IS DISTINCT FROM p_student THEN
        RAISE EXCEPTION 'Application belongs to another student' USING ERRCODE = 'A0403';
    END IF;
    IF p_target IS NULL OR p_target NOT IN ('CONFIRMED','CANCELLED') THEN
        RAISE EXCEPTION 'Invalid target status' USING ERRCODE = 'A0400';
    END IF;
    IF result.status = p_target THEN RETURN result; END IF;
    IF result.status <> 'HELD' OR result.expires_at <= clock_timestamp() THEN
        RAISE EXCEPTION 'Application is no longer active' USING ERRCODE = 'A0409';
    END IF;
    UPDATE admission.holds SET status = p_target WHERE id = p_hold RETURNING * INTO result;
    RETURN result;
END $$;

CREATE OR REPLACE FUNCTION admission.expire_due() RETURNS integer LANGUAGE plpgsql AS $$
DECLARE changed integer;
BEGIN
    WITH due_classes AS MATERIALIZED (
        SELECT c.id FROM admission.classes c WHERE EXISTS (
            SELECT FROM admission.holds h WHERE h.class_id = c.id AND h.status = 'HELD'
            AND h.expires_at <= statement_timestamp()
        ) ORDER BY c.id LIMIT 100 FOR UPDATE OF c SKIP LOCKED
    )
    UPDATE admission.holds h SET status = 'EXPIRED' FROM due_classes c
        WHERE c.id = h.class_id AND h.status = 'HELD' AND h.expires_at <= statement_timestamp();
    GET DIAGNOSTICS changed = ROW_COUNT;
    RETURN changed;
END $$;

CREATE OR REPLACE VIEW admission.application_status AS
SELECT id, class_id, student_id, expires_at,
    CASE WHEN status = 'HELD' AND expires_at <= statement_timestamp() THEN 'EXPIRED'
         ELSE status END AS status
FROM admission.holds;

CREATE OR REPLACE VIEW admission.class_availability AS
SELECT c.id, c.name, c.total_seats,
    count(h.id) FILTER (WHERE h.status = 'HELD') AS held_seats,
    count(h.id) FILTER (WHERE h.status = 'CONFIRMED') AS confirmed_seats,
    c.total_seats - count(h.id) FILTER (WHERE h.status IN ('HELD','CONFIRMED')) AS available_seats
FROM admission.classes c LEFT JOIN admission.application_status h ON h.class_id = c.id
GROUP BY c.id;
COMMIT;
