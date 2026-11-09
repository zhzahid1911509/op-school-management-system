-- Isolated fixtures roll back even on a successful test.
BEGIN;
DO $$
DECLARE
    class_id uuid;
    a admission.holds;
    b admission.holds;
    student constant text := '00000000000000001';
BEGIN
    INSERT INTO admission.classes(name, total_seats) VALUES ('Lifecycle test', 1) RETURNING id INTO class_id;
    SELECT * INTO a FROM admission.reserve(class_id, student, 600);
    BEGIN
        PERFORM admission.reserve(class_id, student, 600);
        RAISE EXCEPTION 'Duplicate application was accepted';
    EXCEPTION WHEN SQLSTATE 'A0409' THEN NULL; END;
    BEGIN
        PERFORM admission.transition(a.id, '00000000000000002', 'CONFIRMED');
        RAISE EXCEPTION 'Wrong owner was accepted';
    EXCEPTION WHEN SQLSTATE 'A0403' THEN NULL; END;
    PERFORM admission.transition(a.id, student, 'CANCELLED');
    SELECT * INTO b FROM admission.reserve(class_id, student, 600);
    UPDATE admission.holds SET expires_at = clock_timestamp() - interval '1 second' WHERE id = b.id;
    IF (SELECT available_seats FROM admission.class_availability WHERE id = class_id) <> 1 THEN
        RAISE EXCEPTION 'Expired seat missing from availability';
    END IF;
    BEGIN
        PERFORM admission.transition(b.id, student, 'CONFIRMED');
        RAISE EXCEPTION 'Late payment was accepted';
    EXCEPTION WHEN SQLSTATE 'A0409' THEN NULL; END;
    PERFORM admission.expire_due();
    IF (SELECT status FROM admission.holds WHERE id = b.id) <> 'EXPIRED' THEN
        RAISE EXCEPTION 'Expiry sweep failed';
    END IF;
    SELECT * INTO a FROM admission.reserve(class_id, student, 600);
    PERFORM admission.transition(a.id, student, 'CONFIRMED');
    PERFORM admission.transition(a.id, student, 'CONFIRMED');
    IF NOT EXISTS (SELECT FROM admission.class_availability WHERE id = class_id
                  AND held_seats = 0 AND confirmed_seats = 1 AND available_seats = 0) THEN
        RAISE EXCEPTION 'Incorrect totals after repeated confirmation';
    END IF;
END $$;
ROLLBACK;
