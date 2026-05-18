-- Helper RPC: atomically claim up to N pending notification_outbox
-- rows (FOR UPDATE SKIP LOCKED so concurrent drainers don't fight),
-- bump their attempts, return them. Drainer processes the claimed
-- batch and marks each sent/failed individually.

CREATE OR REPLACE FUNCTION public.claim_pending_outbox_rows(p_limit int DEFAULT 50)
RETURNS TABLE(
    id uuid,
    user_id uuid,
    category text,
    title text,
    body text,
    url text,
    tag text,
    attempts int,
    org_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    WITH claimed AS (
        SELECT o.id
        FROM public.notification_outbox o
        WHERE o.status = 'pending'
        ORDER BY o.created_at ASC
        LIMIT p_limit
        FOR UPDATE SKIP LOCKED
    )
    UPDATE public.notification_outbox o
    SET attempts = o.attempts + 1
    FROM claimed c
    WHERE o.id = c.id
    RETURNING o.id, o.user_id, o.category, o.title, o.body, o.url, o.tag, o.attempts, o.org_id;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_pending_outbox_rows(int) FROM public;
GRANT EXECUTE ON FUNCTION public.claim_pending_outbox_rows(int) TO service_role;
