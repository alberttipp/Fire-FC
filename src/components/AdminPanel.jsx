import React, { useState } from 'react';
import {
    Database, RefreshCw, Trash2, Shield, X,
    AlertTriangle, CheckCircle, Users, Calendar, Award
} from 'lucide-react';
import { supabase } from '../supabaseClient';

const AdminPanel = ({ onClose }) => {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [confirmReset, setConfirmReset] = useState(false);
    const [stats, setStats] = useState(null);

    const fetchStats = async () => {
        try {
            const results = await Promise.allSettled([
                supabase.from('teams').select('id', { count: 'exact', head: true }),
                supabase.from('players').select('id', { count: 'exact', head: true }),
                supabase.from('events').select('id', { count: 'exact', head: true }),
                supabase.from('event_rsvps').select('id', { count: 'exact', head: true }),
                supabase.from('drills').select('id', { count: 'exact', head: true }),
                supabase.from('badges').select('id', { count: 'exact', head: true }),
            ]);

            setStats({
                teams: results[0].status === 'fulfilled' ? results[0].value.count || 0 : 0,
                players: results[1].status === 'fulfilled' ? results[1].value.count || 0 : 0,
                events: results[2].status === 'fulfilled' ? results[2].value.count || 0 : 0,
                rsvps: results[3].status === 'fulfilled' ? results[3].value.count || 0 : 0,
                drills: results[4].status === 'fulfilled' ? results[4].value.count || 0 : 0,
                badges: results[5].status === 'fulfilled' ? results[5].value.count || 0 : 0,
            });
        } catch (err) {
            console.error('Stats error:', err);
        }
    };

    React.useEffect(() => {
        fetchStats();
    }, []);

    const handleReseed = async () => {
        if (!confirmReset) {
            setConfirmReset(true);
            return;
        }

        setLoading(true);
        setResult(null);

        try {
            // ============================================================
            // STEP 1: Clear all existing data (FK order matters!)
            // ============================================================
            setResult({ status: 'progress', message: 'Step 1/7: Clearing existing data...' });

            // Clear FK references first
            await supabase.from('profiles').update({ team_id: null }).neq('id', '00000000-0000-0000-0000-000000000000');

            // Delete in correct order for FK constraints
            await supabase.from('event_rsvps').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            await supabase.from('practice_sessions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            await supabase.from('scouting_notes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            await supabase.from('tryout_waitlist').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            await supabase.from('events').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            await supabase.from('players').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            await supabase.from('teams').delete().neq('id', '00000000-0000-0000-0000-000000000000');

            // ============================================================
            // STEP 2: Create Teams
            // SCHEMA: id, name, age_group, logo_url, coach_id, join_code, team_type, season, year_season, sub_season
            // ============================================================
            setResult({ status: 'progress', message: 'Step 2/7: Creating 3 teams...' });

            const { error: teamsError } = await supabase.from('teams').insert([
                {
                    id: 'd02aba3e-3c30-430f-9377-3b334cffcd04',
                    name: 'Rockford Fire FC',
                    age_group: 'U11 Boys',
                    join_code: 'FIRE11',
                    team_type: 'club',
                    season: 'Spring 2026',
                    year_season: '2025-2026',
                    sub_season: 'spring'
                },
                {
                    id: 'e13bcb4f-4d41-541a-a488-4c445ce491e5',
                    name: 'Rockford Fire FC',
                    age_group: 'U10 Boys',
                    join_code: 'FIRE10',
                    team_type: 'club',
                    season: 'Spring 2026',
                    year_season: '2025-2026',
                    sub_season: 'spring'
                },
                {
                    id: 'f24cdc50-5e52-652b-b599-5d556df502f6',
                    name: 'Rockford Fire FC',
                    age_group: 'U12 Boys',
                    join_code: 'FIRE12',
                    team_type: 'club',
                    season: 'Spring 2026',
                    year_season: '2025-2026',
                    sub_season: 'spring'
                },
            ]);
            if (teamsError) throw new Error(`Teams: ${teamsError.message}`);

            // ============================================================
            // STEP 3: Create Players
            // SCHEMA: id, team_id, first_name, last_name, number (TEXT!), avatar_url, pin_code, stats (JSONB)
            // ============================================================
            setResult({ status: 'progress', message: 'Step 3/7: Creating 42 players...' });

            // U11 Players (Bo's team)
            const u11Players = [
                { team_id: 'd02aba3e-3c30-430f-9377-3b334cffcd04', first_name: 'Bo', last_name: 'Tipp', number: '58', stats: { position: 'Forward', overall_rating: 72, training_minutes: 340 } },
                { team_id: 'd02aba3e-3c30-430f-9377-3b334cffcd04', first_name: 'Marcus', last_name: 'Chen', number: '10', stats: { position: 'Midfielder', overall_rating: 70, training_minutes: 310 } },
                { team_id: 'd02aba3e-3c30-430f-9377-3b334cffcd04', first_name: 'Jake', last_name: 'Williams', number: '4', stats: { position: 'Defender', overall_rating: 68, training_minutes: 290 } },
                { team_id: 'd02aba3e-3c30-430f-9377-3b334cffcd04', first_name: 'Tyler', last_name: 'Johnson', number: '1', stats: { position: 'Goalkeeper', overall_rating: 71, training_minutes: 320 } },
                { team_id: 'd02aba3e-3c30-430f-9377-3b334cffcd04', first_name: 'Ethan', last_name: 'Brown', number: '9', stats: { position: 'Forward', overall_rating: 67, training_minutes: 275 } },
                { team_id: 'd02aba3e-3c30-430f-9377-3b334cffcd04', first_name: 'Lucas', last_name: 'Garcia', number: '8', stats: { position: 'Midfielder', overall_rating: 66, training_minutes: 260 } },
                { team_id: 'd02aba3e-3c30-430f-9377-3b334cffcd04', first_name: 'Noah', last_name: 'Martinez', number: '5', stats: { position: 'Defender', overall_rating: 65, training_minutes: 245 } },
                { team_id: 'd02aba3e-3c30-430f-9377-3b334cffcd04', first_name: 'Liam', last_name: 'Davis', number: '6', stats: { position: 'Midfielder', overall_rating: 64, training_minutes: 230 } },
                { team_id: 'd02aba3e-3c30-430f-9377-3b334cffcd04', first_name: 'Mason', last_name: 'Rodriguez', number: '11', stats: { position: 'Forward', overall_rating: 63, training_minutes: 215 } },
                { team_id: 'd02aba3e-3c30-430f-9377-3b334cffcd04', first_name: 'Oliver', last_name: 'Wilson', number: '3', stats: { position: 'Defender', overall_rating: 62, training_minutes: 200 } },
                { team_id: 'd02aba3e-3c30-430f-9377-3b334cffcd04', first_name: 'James', last_name: 'Anderson', number: '7', stats: { position: 'Midfielder', overall_rating: 61, training_minutes: 185 } },
                { team_id: 'd02aba3e-3c30-430f-9377-3b334cffcd04', first_name: 'Benjamin', last_name: 'Thomas', number: '2', stats: { position: 'Defender', overall_rating: 60, training_minutes: 170 } },
                { team_id: 'd02aba3e-3c30-430f-9377-3b334cffcd04', first_name: 'Henry', last_name: 'Jackson', number: '14', stats: { position: 'Midfielder', overall_rating: 59, training_minutes: 155 } },
                { team_id: 'd02aba3e-3c30-430f-9377-3b334cffcd04', first_name: 'Alexander', last_name: 'White', number: '22', stats: { position: 'Goalkeeper', overall_rating: 58, training_minutes: 140 } },
            ];

            // U10 Players
            const u10Players = [
                { team_id: 'e13bcb4f-4d41-541a-a488-4c445ce491e5', first_name: 'Ryan', last_name: 'Smith', number: '10', stats: { position: 'Midfielder', overall_rating: 62, training_minutes: 220 } },
                { team_id: 'e13bcb4f-4d41-541a-a488-4c445ce491e5', first_name: 'Dylan', last_name: 'Lee', number: '7', stats: { position: 'Forward', overall_rating: 60, training_minutes: 205 } },
                { team_id: 'e13bcb4f-4d41-541a-a488-4c445ce491e5', first_name: 'Jack', last_name: 'Harris', number: '4', stats: { position: 'Defender', overall_rating: 58, training_minutes: 190 } },
                { team_id: 'e13bcb4f-4d41-541a-a488-4c445ce491e5', first_name: 'Owen', last_name: 'Clark', number: '1', stats: { position: 'Goalkeeper', overall_rating: 60, training_minutes: 210 } },
                { team_id: 'e13bcb4f-4d41-541a-a488-4c445ce491e5', first_name: 'Daniel', last_name: 'Lewis', number: '9', stats: { position: 'Forward', overall_rating: 57, training_minutes: 175 } },
                { team_id: 'e13bcb4f-4d41-541a-a488-4c445ce491e5', first_name: 'Matthew', last_name: 'Walker', number: '8', stats: { position: 'Midfielder', overall_rating: 56, training_minutes: 160 } },
                { team_id: 'e13bcb4f-4d41-541a-a488-4c445ce491e5', first_name: 'Joseph', last_name: 'Hall', number: '5', stats: { position: 'Defender', overall_rating: 55, training_minutes: 145 } },
                { team_id: 'e13bcb4f-4d41-541a-a488-4c445ce491e5', first_name: 'Samuel', last_name: 'Allen', number: '11', stats: { position: 'Forward', overall_rating: 54, training_minutes: 130 } },
                { team_id: 'e13bcb4f-4d41-541a-a488-4c445ce491e5', first_name: 'David', last_name: 'Young', number: '6', stats: { position: 'Midfielder', overall_rating: 53, training_minutes: 115 } },
                { team_id: 'e13bcb4f-4d41-541a-a488-4c445ce491e5', first_name: 'Andrew', last_name: 'King', number: '3', stats: { position: 'Defender', overall_rating: 52, training_minutes: 100 } },
                { team_id: 'e13bcb4f-4d41-541a-a488-4c445ce491e5', first_name: 'Christopher', last_name: 'Wright', number: '14', stats: { position: 'Midfielder', overall_rating: 51, training_minutes: 85 } },
                { team_id: 'e13bcb4f-4d41-541a-a488-4c445ce491e5', first_name: 'Joshua', last_name: 'Lopez', number: '2', stats: { position: 'Defender', overall_rating: 50, training_minutes: 70 } },
                { team_id: 'e13bcb4f-4d41-541a-a488-4c445ce491e5', first_name: 'Jayden', last_name: 'Hill', number: '17', stats: { position: 'Forward', overall_rating: 49, training_minutes: 55 } },
                { team_id: 'e13bcb4f-4d41-541a-a488-4c445ce491e5', first_name: 'Aiden', last_name: 'Scott', number: '22', stats: { position: 'Goalkeeper', overall_rating: 48, training_minutes: 40 } },
            ];

            // U12 Players
            const u12Players = [
                { team_id: 'f24cdc50-5e52-652b-b599-5d556df502f6', first_name: 'William', last_name: 'Green', number: '10', stats: { position: 'Midfielder', overall_rating: 74, training_minutes: 380 } },
                { team_id: 'f24cdc50-5e52-652b-b599-5d556df502f6', first_name: 'Michael', last_name: 'Adams', number: '9', stats: { position: 'Forward', overall_rating: 73, training_minutes: 365 } },
                { team_id: 'f24cdc50-5e52-652b-b599-5d556df502f6', first_name: 'Elijah', last_name: 'Baker', number: '4', stats: { position: 'Defender', overall_rating: 72, training_minutes: 350 } },
                { team_id: 'f24cdc50-5e52-652b-b599-5d556df502f6', first_name: 'Sebastian', last_name: 'Gonzalez', number: '1', stats: { position: 'Goalkeeper', overall_rating: 74, training_minutes: 370 } },
                { team_id: 'f24cdc50-5e52-652b-b599-5d556df502f6', first_name: 'Carter', last_name: 'Nelson', number: '11', stats: { position: 'Forward', overall_rating: 70, training_minutes: 320 } },
                { team_id: 'f24cdc50-5e52-652b-b599-5d556df502f6', first_name: 'Wyatt', last_name: 'Carter', number: '8', stats: { position: 'Midfielder', overall_rating: 69, training_minutes: 305 } },
                { team_id: 'f24cdc50-5e52-652b-b599-5d556df502f6', first_name: 'Jack', last_name: 'Mitchell', number: '5', stats: { position: 'Defender', overall_rating: 68, training_minutes: 290 } },
                { team_id: 'f24cdc50-5e52-652b-b599-5d556df502f6', first_name: 'Luke', last_name: 'Perez', number: '7', stats: { position: 'Forward', overall_rating: 67, training_minutes: 275 } },
                { team_id: 'f24cdc50-5e52-652b-b599-5d556df502f6', first_name: 'Grayson', last_name: 'Roberts', number: '6', stats: { position: 'Midfielder', overall_rating: 66, training_minutes: 260 } },
                { team_id: 'f24cdc50-5e52-652b-b599-5d556df502f6', first_name: 'Levi', last_name: 'Turner', number: '3', stats: { position: 'Defender', overall_rating: 65, training_minutes: 245 } },
                { team_id: 'f24cdc50-5e52-652b-b599-5d556df502f6', first_name: 'Isaac', last_name: 'Phillips', number: '14', stats: { position: 'Midfielder', overall_rating: 64, training_minutes: 230 } },
                { team_id: 'f24cdc50-5e52-652b-b599-5d556df502f6', first_name: 'Gabriel', last_name: 'Campbell', number: '2', stats: { position: 'Defender', overall_rating: 63, training_minutes: 215 } },
                { team_id: 'f24cdc50-5e52-652b-b599-5d556df502f6', first_name: 'Julian', last_name: 'Parker', number: '17', stats: { position: 'Forward', overall_rating: 62, training_minutes: 200 } },
                { team_id: 'f24cdc50-5e52-652b-b599-5d556df502f6', first_name: 'Lincoln', last_name: 'Evans', number: '22', stats: { position: 'Goalkeeper', overall_rating: 61, training_minutes: 185 } },
            ];

            const { error: playersError } = await supabase.from('players').insert([...u11Players, ...u10Players, ...u12Players]);
            if (playersError) throw new Error(`Players: ${playersError.message}`);

            // ============================================================
            // STEP 4: Create Events
            // SCHEMA: id, team_id, title, type, start_time, end_time, location_name, location_address, arrival_time_minutes, kit_color, notes, created_by
            // ============================================================
            setResult({ status: 'progress', message: 'Step 4/7: Creating events...' });

            const teamIds = [
                'd02aba3e-3c30-430f-9377-3b334cffcd04',
                'e13bcb4f-4d41-541a-a488-4c445ce491e5',
                'f24cdc50-5e52-652b-b599-5d556df502f6'
            ];
            const opponents = ['Lions FC', 'Eagles United', 'Storm SC', 'Thunder FC', 'Blazers', 'Rapids', 'Phoenix SC', 'Wolves FC'];
            const eventsToInsert = [];

            for (const teamId of teamIds) {
                for (let dayOffset = -30; dayOffset <= 15; dayOffset++) {
                    const date = new Date();
                    date.setDate(date.getDate() + dayOffset);
                    date.setHours(0, 0, 0, 0);
                    const dow = date.getDay();

                    if (dow === 2) { // Tuesday Practice
                        const startTime = new Date(date);
                        startTime.setHours(18, 0, 0, 0);
                        const endTime = new Date(date);
                        endTime.setHours(19, 30, 0, 0);

                        eventsToInsert.push({
                            team_id: teamId,
                            title: 'Tuesday Practice',
                            type: 'practice',
                            start_time: startTime.toISOString(),
                            end_time: endTime.toISOString(),
                            location_name: 'Rockford Sports Complex',
                            location_address: '123 Sports Dr, Rockford, IL',
                            arrival_time_minutes: 15,
                            kit_color: 'red',
                            notes: 'Technical focus - bring water'
                        });
                    } else if (dow === 4) { // Thursday Practice
                        const startTime = new Date(date);
                        startTime.setHours(18, 0, 0, 0);
                        const endTime = new Date(date);
                        endTime.setHours(19, 30, 0, 0);

                        eventsToInsert.push({
                            team_id: teamId,
                            title: 'Thursday Practice',
                            type: 'practice',
                            start_time: startTime.toISOString(),
                            end_time: endTime.toISOString(),
                            location_name: 'Rockford Sports Complex',
                            location_address: '123 Sports Dr, Rockford, IL',
                            arrival_time_minutes: 15,
                            kit_color: 'red',
                            notes: 'Tactical focus'
                        });
                    } else if (dow === 6) { // Saturday Game
                        const startTime = new Date(date);
                        startTime.setHours(10, 0, 0, 0);
                        const endTime = new Date(date);
                        endTime.setHours(11, 30, 0, 0);
                        const isHome = dayOffset % 2 === 0;

                        eventsToInsert.push({
                            team_id: teamId,
                            title: `Game vs ${opponents[Math.abs(dayOffset) % 8]}`,
                            type: 'game',
                            start_time: startTime.toISOString(),
                            end_time: endTime.toISOString(),
                            location_name: isHome ? 'Rockford Sports Complex' : 'Central Park Field',
                            location_address: isHome ? '123 Sports Dr, Rockford, IL' : '456 Park Ave, Rockford, IL',
                            arrival_time_minutes: 30,
                            kit_color: isHome ? 'red' : 'white',
                            notes: 'League match'
                        });
                    }
                }
            }

            // Insert events in batches
            for (let i = 0; i < eventsToInsert.length; i += 50) {
                const batch = eventsToInsert.slice(i, i + 50);
                const { error: eventsError } = await supabase.from('events').insert(batch);
                if (eventsError) throw new Error(`Events: ${eventsError.message}`);
            }

            // ============================================================
            // STEP 5: Create RSVPs for past events
            // SCHEMA: id, event_id, player_id, status, notes, updated_at
            // ============================================================
            setResult({ status: 'progress', message: 'Step 5/7: Creating RSVPs...' });

            const { data: pastEvents } = await supabase
                .from('events')
                .select('id, team_id')
                .lt('start_time', new Date().toISOString());

            const { data: allPlayers } = await supabase.from('players').select('id, team_id');

            if (pastEvents && allPlayers && pastEvents.length > 0 && allPlayers.length > 0) {
                const rsvpsToInsert = [];
                for (const event of pastEvents) {
                    const teamPlayers = allPlayers.filter(p => p.team_id === event.team_id);
                    for (const player of teamPlayers) {
                        const rand = Math.random();
                        let status = rand < 0.70 ? 'going' : rand < 0.85 ? 'maybe' : rand < 0.95 ? 'not_going' : 'pending';
                        rsvpsToInsert.push({
                            event_id: event.id,
                            player_id: player.id,
                            status: status,
                            notes: null
                        });
                    }
                }

                // Insert in batches
                for (let i = 0; i < rsvpsToInsert.length; i += 100) {
                    await supabase.from('event_rsvps').insert(rsvpsToInsert.slice(i, i + 100));
                }
            }

            // ============================================================
            // STEP 6: Create Practice Sessions, Scouting Notes, Tryout Waitlist
            // ============================================================
            setResult({ status: 'progress', message: 'Step 6/7: Creating practice sessions & notes...' });

            // practice_sessions SCHEMA: team_id, event_id, created_by, name, scheduled_date, total_duration, drills (JSONB), status, notes
            await supabase.from('practice_sessions').insert([
                {
                    team_id: 'd02aba3e-3c30-430f-9377-3b334cffcd04',
                    name: 'Standard Tuesday Technical',
                    scheduled_date: new Date().toISOString().split('T')[0],
                    total_duration: 75,
                    drills: [
                        { name: 'Dynamic Warmup', duration: 10, category: 'warmup' },
                        { name: 'Passing Pairs', duration: 15, category: 'passing' },
                        { name: '1v1 Moves', duration: 15, category: 'technical' },
                        { name: 'Shooting Drill', duration: 15, category: 'shooting' },
                        { name: '3v3 Scrimmage', duration: 15, category: 'game' },
                        { name: 'Cooldown', duration: 5, category: 'cooldown' }
                    ],
                    status: 'draft',
                    notes: 'Focus on first touch'
                },
                {
                    team_id: 'd02aba3e-3c30-430f-9377-3b334cffcd04',
                    name: 'Thursday Tactical Session',
                    scheduled_date: new Date().toISOString().split('T')[0],
                    total_duration: 75,
                    drills: [
                        { name: 'Rondo 4v1', duration: 10, category: 'warmup' },
                        { name: 'Positional Play', duration: 20, category: 'tactical' },
                        { name: 'Defensive Shape', duration: 15, category: 'tactical' },
                        { name: 'Full Scrimmage', duration: 25, category: 'game' },
                        { name: 'Team Talk', duration: 5, category: 'cooldown' }
                    ],
                    status: 'draft',
                    notes: 'Work on transitions'
                }
            ]);

            // scouting_notes SCHEMA: created_by, player_name, player_id, prospect_id, note_text, audio_url, tags (ARRAY)
            await supabase.from('scouting_notes').insert([
                { player_name: 'Marcus Chen', note_text: 'Excellent vision and passing. Reads the game well.', tags: ['Technical', 'Passing', 'Leadership'] },
                { player_name: 'Bo Tipp', note_text: 'Natural finisher with both feet. Leadership potential.', tags: ['Shooting', 'Attitude', 'Leadership'] },
                { player_name: 'Jake Williams', note_text: 'Strong 1v1 defender. Good positioning.', tags: ['Defending', 'Strength'] }
            ]);

            // tryout_waitlist SCHEMA: name, email, phone, age_group, notes, status
            await supabase.from('tryout_waitlist').insert([
                { name: 'Tommy Richards', email: 'tommy@email.com', phone: '815-555-0101', age_group: 'U11', notes: 'Midfielder - club experience', status: 'pending' },
                { name: 'Kevin Park', email: 'kpark@email.com', phone: '815-555-0102', age_group: 'U10', notes: 'Athletic forward', status: 'contacted' }
            ]);

            // ============================================================
            // STEP 7: Reassign current user to U11 team
            // ============================================================
            setResult({ status: 'progress', message: 'Step 7/7: Assigning your profile to U11 team...' });

            const { data: { user: currentUser } } = await supabase.auth.getUser();
            if (currentUser) {
                await supabase
                    .from('profiles')
                    .update({ team_id: 'd02aba3e-3c30-430f-9377-3b334cffcd04' })
                    .eq('id', currentUser.id);
            }

            // DONE!
            setResult({ status: 'success', message: '✅ Database seeded! Refresh the page to see changes.' });
            setConfirmReset(false);
            fetchStats();

        } catch (err) {
            console.error('Reseed error:', err);
            setResult({ status: 'error', message: err.message || 'Reseed failed' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-brand-dark border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="p-6 border-b border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-500/20 rounded-lg">
                            <Shield className="w-6 h-6 text-red-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Admin Panel</h2>
                            <p className="text-xs text-gray-500">Database Management</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg">
                        <X className="w-6 h-6 text-gray-400" />
                    </button>
                </div>

                {/* Current Stats */}
                <div className="p-6 border-b border-white/10">
                    <h3 className="text-sm font-bold text-gray-400 uppercase mb-3">Current Database</h3>
                    {stats ? (
                        <>
                            <div className="grid grid-cols-3 gap-3">
                                <div className="bg-white/5 rounded-lg p-3 text-center">
                                    <Users className="w-5 h-5 text-blue-400 mx-auto mb-1" />
                                    <p className="text-2xl font-bold text-white">{stats.players}</p>
                                    <p className="text-xs text-gray-500">Players</p>
                                </div>
                                <div className="bg-white/5 rounded-lg p-3 text-center">
                                    <Calendar className="w-5 h-5 text-green-400 mx-auto mb-1" />
                                    <p className="text-2xl font-bold text-white">{stats.events}</p>
                                    <p className="text-xs text-gray-500">Events</p>
                                </div>
                                <div className="bg-white/5 rounded-lg p-3 text-center">
                                    <Award className="w-5 h-5 text-yellow-400 mx-auto mb-1" />
                                    <p className="text-2xl font-bold text-white">{stats.drills}</p>
                                    <p className="text-xs text-gray-500">Drills</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-3 mt-3">
                                <div className="bg-white/5 rounded-lg p-2 text-center">
                                    <p className="text-lg font-bold text-white">{stats.teams}</p>
                                    <p className="text-xs text-gray-500">Teams</p>
                                </div>
                                <div className="bg-white/5 rounded-lg p-2 text-center">
                                    <p className="text-lg font-bold text-white">{stats.rsvps}</p>
                                    <p className="text-xs text-gray-500">RSVPs</p>
                                </div>
                                <div className="bg-white/5 rounded-lg p-2 text-center">
                                    <p className="text-lg font-bold text-white">{stats.badges}</p>
                                    <p className="text-xs text-gray-500">Badges</p>
                                </div>
                            </div>
                        </>
                    ) : (
                        <p className="text-gray-500 text-sm">Loading stats...</p>
                    )}
                </div>

                {/* Actions */}
                <div className="p-6 space-y-4">
                    <h3 className="text-sm font-bold text-gray-400 uppercase mb-3">Actions</h3>

                    {result && (
                        <div className={`p-4 rounded-lg flex items-start gap-3 ${result.status === 'success' ? 'bg-green-500/20 text-green-400' :
                                result.status === 'error' ? 'bg-red-500/20 text-red-400' :
                                    'bg-blue-500/20 text-blue-400'
                            }`}>
                            {result.status === 'success' ? <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" /> :
                                result.status === 'error' ? <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" /> :
                                    <RefreshCw className="w-5 h-5 animate-spin flex-shrink-0 mt-0.5" />}
                            <p className="text-sm break-words">{result.message}</p>
                        </div>
                    )}

                    {confirmReset && !loading && (
                        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                            <div className="flex items-center gap-2 text-red-400 mb-2">
                                <AlertTriangle className="w-5 h-5" />
                                <span className="font-bold">Warning!</span>
                            </div>
                            <p className="text-sm text-gray-400 mb-2">
                                This will reset teams, players, events, and RSVPs.
                            </p>
                            <p className="text-xs text-green-400">✓ Drills, badges & training plans preserved</p>
                        </div>
                    )}

                    <button
                        onClick={handleReseed}
                        disabled={loading}
                        className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${confirmReset
                                ? 'bg-red-500 text-white hover:bg-red-600'
                                : 'bg-brand-gold/10 border border-brand-gold/30 text-brand-gold hover:bg-brand-gold/20'
                            } disabled:opacity-50`}
                    >
                        {loading ? (
                            <><RefreshCw className="w-5 h-5 animate-spin" /> Processing...</>
                        ) : confirmReset ? (
                            <><Trash2 className="w-5 h-5" /> Confirm Reset & Reseed</>
                        ) : (
                            <><Database className="w-5 h-5" /> Reset & Reseed Database</>
                        )}
                    </button>

                    {confirmReset && !loading && (
                        <button
                            onClick={() => setConfirmReset(false)}
                            className="w-full py-2 text-gray-400 hover:text-white text-sm"
                        >
                            Cancel
                        </button>
                    )}

                    <p className="text-xs text-gray-600 text-center">Creates: 3 teams • 42 players • ~60 events • RSVPs</p>
                </div>
            </div>
        </div>
    );
};

export default AdminPanel;
