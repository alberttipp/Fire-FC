-- Add event_rsvps, player_stats, assignments to the supabase_realtime
-- publication so postgres_changes subscriptions on the client fire on
-- writes. Previously only messages and events were in the publication,
-- which is why RsvpSummary, the leaderboard, and HomeworkHub didn't
-- update live.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
         WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='event_rsvps'
    ) THEN
        EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.event_rsvps';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
         WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='player_stats'
    ) THEN
        EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.player_stats';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
         WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='assignments'
    ) THEN
        EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.assignments';
    END IF;
END $$;
