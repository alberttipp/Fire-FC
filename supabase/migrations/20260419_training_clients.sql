-- ============================================
-- TRAINING CLIENTS & SESSIONS
-- Tables for private/individual training management
-- ============================================

CREATE TABLE IF NOT EXISTS training_clients (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    coach_id UUID NOT NULL REFERENCES auth.users(id),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    parent_name TEXT,
    parent_email TEXT,
    parent_phone TEXT,
    notes TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS training_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    coach_id UUID NOT NULL REFERENCES auth.users(id),
    title TEXT NOT NULL,
    session_type TEXT DEFAULT 'individual' CHECK (session_type IN ('individual', 'small_group', 'team')),
    start_time TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER DEFAULT 60,
    location_name TEXT,
    is_paid BOOLEAN DEFAULT FALSE,
    price NUMERIC(8,2),
    payment_status TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'waived')),
    notes TEXT,
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS training_session_attendees (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES training_clients(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'invited' CHECK (status IN ('invited', 'confirmed', 'attended', 'no_show')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(session_id, client_id)
);

ALTER TABLE training_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_session_attendees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches manage own clients" ON training_clients FOR ALL USING (coach_id = auth.uid());
CREATE POLICY "Coaches manage own sessions" ON training_sessions FOR ALL USING (coach_id = auth.uid());
CREATE POLICY "Coaches manage session attendees" ON training_session_attendees FOR ALL USING (
    EXISTS (SELECT 1 FROM training_sessions ts WHERE ts.id = training_session_attendees.session_id AND ts.coach_id = auth.uid())
);

CREATE INDEX IF NOT EXISTS idx_training_clients_coach ON training_clients(coach_id);
CREATE INDEX IF NOT EXISTS idx_training_sessions_coach ON training_sessions(coach_id, start_time);

NOTIFY pgrst, 'reload schema';
