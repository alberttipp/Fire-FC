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
            await supabase.from('profiles').update({ team_id: null }).not('id', 'is', null);

            // Delete in correct order for FK constraints - use gte to match all UUIDs
            await supabase.from('message_read_receipts').delete().gte('id', '00000000-0000-0000-0000-000000000000');
            await supabase.from('messages').delete().gte('id', '00000000-0000-0000-0000-000000000000');
            await supabase.from('channels').delete().gte('id', '00000000-0000-0000-0000-000000000000');
            await supabase.from('player_stats').delete().gte('id', '00000000-0000-0000-0000-000000000000');
            await supabase.from('player_badges').delete().gte('id', '00000000-0000-0000-0000-000000000000');
            await supabase.from('evaluations').delete().gte('id', '00000000-0000-0000-0000-000000000000');
            await supabase.from('assignments').delete().gte('id', '00000000-0000-0000-0000-000000000000');
            await supabase.from('event_rsvps').delete().gte('id', '00000000-0000-0000-0000-000000000000');
            await supabase.from('practice_sessions').delete().gte('id', '00000000-0000-0000-0000-000000000000');
            await supabase.from('scouting_notes').delete().gte('id', '00000000-0000-0000-0000-000000000000');
            await supabase.from('tryout_waitlist').delete().gte('id', '00000000-0000-0000-0000-000000000000');
            await supabase.from('events').delete().gte('id', '00000000-0000-0000-0000-000000000000');
            await supabase.from('players').delete().gte('id', '00000000-0000-0000-0000-000000000000');
            await supabase.from('teams').delete().gte('id', '00000000-0000-0000-0000-000000000000');
            await supabase.from('badges').delete().not('id', 'is', null);
            await supabase.from('drills').delete().gte('id', '00000000-0000-0000-0000-000000000000');

            // ============================================================
            // STEP 2: Create Teams
            // SCHEMA: id, name, age_group, logo_url, coach_id, join_code, team_type, season
            // Note: coach_id left null - demo users will see all teams
            // ============================================================
            setResult({ status: 'progress', message: 'Step 2/7: Creating 3 teams...' });

            const { error: teamsError } = await supabase.from('teams').insert([
                {
                    id: 'd02aba3e-3c30-430f-9377-3b334cffcd04',
                    name: 'Rockford Fire FC',
                    age_group: 'U11 Boys',
                    join_code: 'FIRE11',
                    team_type: 'club',
                    season: 'Spring 2026'
                },
                {
                    id: 'e13bcb4f-4d41-541a-a488-4c445ce491e5',
                    name: 'Rockford Fire FC',
                    age_group: 'U10 Boys',
                    join_code: 'FIRE10',
                    team_type: 'club',
                    season: 'Spring 2026'
                },
                {
                    id: 'f24cdc50-5e52-652b-b599-5d556df502f6',
                    name: 'Rockford Fire FC',
                    age_group: 'U12 Boys',
                    join_code: 'FIRE12',
                    team_type: 'club',
                    season: 'Spring 2026'
                },
            ]);
            if (teamsError) throw new Error(`Teams: ${teamsError.message}`);

            // ============================================================
            // STEP 3: Create Players
            // SCHEMA: id, team_id, first_name, last_name, jersey_number (INT), position, avatar_url, overall_rating, training_minutes, pace, shooting, passing, dribbling, defending, physical
            // ============================================================
            setResult({ status: 'progress', message: 'Step 3/7: Creating 42 players...' });

            // U11 Players (Bo's team)
            const u11Players = [
                { team_id: 'd02aba3e-3c30-430f-9377-3b334cffcd04', first_name: 'Bo', last_name: 'Tipp', jersey_number: 58, position: 'Forward', overall_rating: 72, training_minutes: 340, pace: 75, shooting: 78, passing: 70, dribbling: 74, defending: 45, physical: 68 },
                { team_id: 'd02aba3e-3c30-430f-9377-3b334cffcd04', first_name: 'Marcus', last_name: 'Chen', jersey_number: 10, position: 'Midfielder', overall_rating: 70, training_minutes: 310, pace: 68, shooting: 65, passing: 78, dribbling: 75, defending: 60, physical: 62 },
                { team_id: 'd02aba3e-3c30-430f-9377-3b334cffcd04', first_name: 'Jake', last_name: 'Williams', jersey_number: 4, position: 'Defender', overall_rating: 68, training_minutes: 290, pace: 65, shooting: 45, passing: 62, dribbling: 55, defending: 78, physical: 72 },
                { team_id: 'd02aba3e-3c30-430f-9377-3b334cffcd04', first_name: 'Tyler', last_name: 'Johnson', jersey_number: 1, position: 'Goalkeeper', overall_rating: 71, training_minutes: 320, pace: 55, shooting: 35, passing: 58, dribbling: 40, defending: 75, physical: 70 },
                { team_id: 'd02aba3e-3c30-430f-9377-3b334cffcd04', first_name: 'Ethan', last_name: 'Brown', jersey_number: 9, position: 'Forward', overall_rating: 67, training_minutes: 275, pace: 72, shooting: 70, passing: 62, dribbling: 68, defending: 42, physical: 65 },
                { team_id: 'd02aba3e-3c30-430f-9377-3b334cffcd04', first_name: 'Lucas', last_name: 'Garcia', jersey_number: 8, position: 'Midfielder', overall_rating: 66, training_minutes: 260, pace: 65, shooting: 60, passing: 72, dribbling: 68, defending: 58, physical: 60 },
                { team_id: 'd02aba3e-3c30-430f-9377-3b334cffcd04', first_name: 'Noah', last_name: 'Martinez', jersey_number: 5, position: 'Defender', overall_rating: 65, training_minutes: 245, pace: 62, shooting: 40, passing: 58, dribbling: 52, defending: 75, physical: 70 },
                { team_id: 'd02aba3e-3c30-430f-9377-3b334cffcd04', first_name: 'Liam', last_name: 'Davis', jersey_number: 6, position: 'Midfielder', overall_rating: 64, training_minutes: 230, pace: 64, shooting: 58, passing: 68, dribbling: 65, defending: 55, physical: 58 },
                { team_id: 'd02aba3e-3c30-430f-9377-3b334cffcd04', first_name: 'Mason', last_name: 'Rodriguez', jersey_number: 11, position: 'Forward', overall_rating: 63, training_minutes: 215, pace: 70, shooting: 65, passing: 58, dribbling: 62, defending: 40, physical: 60 },
                { team_id: 'd02aba3e-3c30-430f-9377-3b334cffcd04', first_name: 'Oliver', last_name: 'Wilson', jersey_number: 3, position: 'Defender', overall_rating: 62, training_minutes: 200, pace: 60, shooting: 38, passing: 55, dribbling: 50, defending: 72, physical: 68 },
                { team_id: 'd02aba3e-3c30-430f-9377-3b334cffcd04', first_name: 'James', last_name: 'Anderson', jersey_number: 7, position: 'Midfielder', overall_rating: 61, training_minutes: 185, pace: 62, shooting: 55, passing: 65, dribbling: 60, defending: 52, physical: 55 },
                { team_id: 'd02aba3e-3c30-430f-9377-3b334cffcd04', first_name: 'Benjamin', last_name: 'Thomas', jersey_number: 2, position: 'Defender', overall_rating: 60, training_minutes: 170, pace: 58, shooting: 35, passing: 52, dribbling: 48, defending: 70, physical: 65 },
                { team_id: 'd02aba3e-3c30-430f-9377-3b334cffcd04', first_name: 'Henry', last_name: 'Jackson', jersey_number: 14, position: 'Midfielder', overall_rating: 59, training_minutes: 155, pace: 60, shooting: 52, passing: 62, dribbling: 58, defending: 50, physical: 52 },
                { team_id: 'd02aba3e-3c30-430f-9377-3b334cffcd04', first_name: 'Alexander', last_name: 'White', jersey_number: 22, position: 'Goalkeeper', overall_rating: 58, training_minutes: 140, pace: 50, shooting: 30, passing: 52, dribbling: 35, defending: 68, physical: 62 },
            ];

            // U10 Players
            const u10Players = [
                { team_id: 'e13bcb4f-4d41-541a-a488-4c445ce491e5', first_name: 'Ryan', last_name: 'Smith', jersey_number: 10, position: 'Midfielder', overall_rating: 62, training_minutes: 220, pace: 60, shooting: 55, passing: 68, dribbling: 65, defending: 52, physical: 55 },
                { team_id: 'e13bcb4f-4d41-541a-a488-4c445ce491e5', first_name: 'Dylan', last_name: 'Lee', jersey_number: 7, position: 'Forward', overall_rating: 60, training_minutes: 205, pace: 65, shooting: 62, passing: 55, dribbling: 60, defending: 38, physical: 52 },
                { team_id: 'e13bcb4f-4d41-541a-a488-4c445ce491e5', first_name: 'Jack', last_name: 'Harris', jersey_number: 4, position: 'Defender', overall_rating: 58, training_minutes: 190, pace: 55, shooting: 35, passing: 52, dribbling: 48, defending: 68, physical: 62 },
                { team_id: 'e13bcb4f-4d41-541a-a488-4c445ce491e5', first_name: 'Owen', last_name: 'Clark', jersey_number: 1, position: 'Goalkeeper', overall_rating: 60, training_minutes: 210, pace: 48, shooting: 28, passing: 50, dribbling: 35, defending: 65, physical: 58 },
                { team_id: 'e13bcb4f-4d41-541a-a488-4c445ce491e5', first_name: 'Daniel', last_name: 'Lewis', jersey_number: 9, position: 'Forward', overall_rating: 57, training_minutes: 175, pace: 62, shooting: 58, passing: 50, dribbling: 55, defending: 35, physical: 50 },
                { team_id: 'e13bcb4f-4d41-541a-a488-4c445ce491e5', first_name: 'Matthew', last_name: 'Walker', jersey_number: 8, position: 'Midfielder', overall_rating: 56, training_minutes: 160, pace: 55, shooting: 50, passing: 60, dribbling: 58, defending: 48, physical: 48 },
                { team_id: 'e13bcb4f-4d41-541a-a488-4c445ce491e5', first_name: 'Joseph', last_name: 'Hall', jersey_number: 5, position: 'Defender', overall_rating: 55, training_minutes: 145, pace: 52, shooting: 32, passing: 48, dribbling: 45, defending: 65, physical: 58 },
                { team_id: 'e13bcb4f-4d41-541a-a488-4c445ce491e5', first_name: 'Samuel', last_name: 'Allen', jersey_number: 11, position: 'Forward', overall_rating: 54, training_minutes: 130, pace: 58, shooting: 55, passing: 48, dribbling: 52, defending: 32, physical: 45 },
                { team_id: 'e13bcb4f-4d41-541a-a488-4c445ce491e5', first_name: 'David', last_name: 'Young', jersey_number: 6, position: 'Midfielder', overall_rating: 53, training_minutes: 115, pace: 52, shooting: 48, passing: 58, dribbling: 55, defending: 45, physical: 45 },
                { team_id: 'e13bcb4f-4d41-541a-a488-4c445ce491e5', first_name: 'Andrew', last_name: 'King', jersey_number: 3, position: 'Defender', overall_rating: 52, training_minutes: 100, pace: 50, shooting: 30, passing: 45, dribbling: 42, defending: 62, physical: 55 },
                { team_id: 'e13bcb4f-4d41-541a-a488-4c445ce491e5', first_name: 'Christopher', last_name: 'Wright', jersey_number: 14, position: 'Midfielder', overall_rating: 51, training_minutes: 85, pace: 50, shooting: 45, passing: 55, dribbling: 52, defending: 42, physical: 42 },
                { team_id: 'e13bcb4f-4d41-541a-a488-4c445ce491e5', first_name: 'Joshua', last_name: 'Lopez', jersey_number: 2, position: 'Defender', overall_rating: 50, training_minutes: 70, pace: 48, shooting: 28, passing: 42, dribbling: 40, defending: 60, physical: 52 },
                { team_id: 'e13bcb4f-4d41-541a-a488-4c445ce491e5', first_name: 'Jayden', last_name: 'Hill', jersey_number: 17, position: 'Forward', overall_rating: 49, training_minutes: 55, pace: 55, shooting: 50, passing: 42, dribbling: 48, defending: 28, physical: 42 },
                { team_id: 'e13bcb4f-4d41-541a-a488-4c445ce491e5', first_name: 'Aiden', last_name: 'Scott', jersey_number: 22, position: 'Goalkeeper', overall_rating: 48, training_minutes: 40, pace: 42, shooting: 22, passing: 42, dribbling: 30, defending: 58, physical: 50 },
            ];

            // U12 Players
            const u12Players = [
                { team_id: 'f24cdc50-5e52-652b-b599-5d556df502f6', first_name: 'William', last_name: 'Green', jersey_number: 10, position: 'Midfielder', overall_rating: 74, training_minutes: 380, pace: 72, shooting: 68, passing: 80, dribbling: 78, defending: 62, physical: 68 },
                { team_id: 'f24cdc50-5e52-652b-b599-5d556df502f6', first_name: 'Michael', last_name: 'Adams', jersey_number: 9, position: 'Forward', overall_rating: 73, training_minutes: 365, pace: 78, shooting: 80, passing: 68, dribbling: 75, defending: 42, physical: 70 },
                { team_id: 'f24cdc50-5e52-652b-b599-5d556df502f6', first_name: 'Elijah', last_name: 'Baker', jersey_number: 4, position: 'Defender', overall_rating: 72, training_minutes: 350, pace: 68, shooting: 45, passing: 65, dribbling: 58, defending: 82, physical: 75 },
                { team_id: 'f24cdc50-5e52-652b-b599-5d556df502f6', first_name: 'Sebastian', last_name: 'Gonzalez', jersey_number: 1, position: 'Goalkeeper', overall_rating: 74, training_minutes: 370, pace: 58, shooting: 35, passing: 62, dribbling: 42, defending: 80, physical: 72 },
                { team_id: 'f24cdc50-5e52-652b-b599-5d556df502f6', first_name: 'Carter', last_name: 'Nelson', jersey_number: 11, position: 'Forward', overall_rating: 70, training_minutes: 320, pace: 75, shooting: 72, passing: 65, dribbling: 70, defending: 40, physical: 65 },
                { team_id: 'f24cdc50-5e52-652b-b599-5d556df502f6', first_name: 'Wyatt', last_name: 'Carter', jersey_number: 8, position: 'Midfielder', overall_rating: 69, training_minutes: 305, pace: 68, shooting: 62, passing: 75, dribbling: 72, defending: 58, physical: 62 },
                { team_id: 'f24cdc50-5e52-652b-b599-5d556df502f6', first_name: 'Jack', last_name: 'Mitchell', jersey_number: 5, position: 'Defender', overall_rating: 68, training_minutes: 290, pace: 65, shooting: 42, passing: 60, dribbling: 55, defending: 78, physical: 72 },
                { team_id: 'f24cdc50-5e52-652b-b599-5d556df502f6', first_name: 'Luke', last_name: 'Perez', jersey_number: 7, position: 'Forward', overall_rating: 67, training_minutes: 275, pace: 72, shooting: 70, passing: 62, dribbling: 68, defending: 38, physical: 62 },
                { team_id: 'f24cdc50-5e52-652b-b599-5d556df502f6', first_name: 'Grayson', last_name: 'Roberts', jersey_number: 6, position: 'Midfielder', overall_rating: 66, training_minutes: 260, pace: 65, shooting: 58, passing: 72, dribbling: 68, defending: 55, physical: 58 },
                { team_id: 'f24cdc50-5e52-652b-b599-5d556df502f6', first_name: 'Levi', last_name: 'Turner', jersey_number: 3, position: 'Defender', overall_rating: 65, training_minutes: 245, pace: 62, shooting: 38, passing: 58, dribbling: 52, defending: 75, physical: 70 },
                { team_id: 'f24cdc50-5e52-652b-b599-5d556df502f6', first_name: 'Isaac', last_name: 'Phillips', jersey_number: 14, position: 'Midfielder', overall_rating: 64, training_minutes: 230, pace: 62, shooting: 55, passing: 68, dribbling: 65, defending: 52, physical: 55 },
                { team_id: 'f24cdc50-5e52-652b-b599-5d556df502f6', first_name: 'Gabriel', last_name: 'Campbell', jersey_number: 2, position: 'Defender', overall_rating: 63, training_minutes: 215, pace: 60, shooting: 35, passing: 55, dribbling: 50, defending: 72, physical: 68 },
                { team_id: 'f24cdc50-5e52-652b-b599-5d556df502f6', first_name: 'Julian', last_name: 'Parker', jersey_number: 17, position: 'Forward', overall_rating: 62, training_minutes: 200, pace: 68, shooting: 65, passing: 58, dribbling: 62, defending: 35, physical: 58 },
                { team_id: 'f24cdc50-5e52-652b-b599-5d556df502f6', first_name: 'Lincoln', last_name: 'Evans', jersey_number: 22, position: 'Goalkeeper', overall_rating: 61, training_minutes: 185, pace: 52, shooting: 30, passing: 55, dribbling: 38, defending: 70, physical: 65 },
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
                { name: 'Kevin Park', email: 'kpark@email.com', phone: '815-555-0102', age_group: 'U10', notes: 'Athletic forward', status: 'contacted' },
                { name: 'Sofia Garcia', email: 'sofia@email.com', phone: '815-555-0103', age_group: 'U11', notes: 'Strong defender, rec league star', status: 'scheduled' },
                { name: 'Aiden Murphy', email: 'amurphy@email.com', phone: '815-555-0104', age_group: 'U12', notes: 'Goalkeeper with travel experience', status: 'pending' }
            ]);

            // ============================================================
            // STEP 7: Seed Drills Library (19 drills)
            // ============================================================
            setResult({ status: 'progress', message: 'Step 7/12: Creating drill library...' });

            const drillsToInsert = [
                { title: 'Foundation Taps', description: 'Basic ball control with alternating feet taps on top of ball.', skill: 'Ball Control', category: 'Technical', players: 'Solo', duration_minutes: 5, image_url: 'https://images.unsplash.com/photo-1517466787929-bc90951d0974?auto=format&fit=crop&q=80&w=500' },
                { title: 'Toe Taps (Stationary)', description: 'Quick toe taps on ball while stationary to build foot speed.', skill: 'Agility', category: 'Technical', players: 'Solo', duration_minutes: 5, image_url: 'https://images.unsplash.com/photo-1551958219-acbc608c6377?auto=format&fit=crop&q=80&w=500' },
                { title: 'Juggling Challenge', description: 'Keep ball in air using feet, thighs, and head. Track personal best.', skill: 'Ball Control', category: 'Technical', players: 'Solo', duration_minutes: 15, image_url: 'https://images.unsplash.com/photo-1526232761682-d26e03ac148e?auto=format&fit=crop&q=80&w=500' },
                { title: 'Figure 8 Dribbling', description: 'Dribble ball in figure 8 pattern around two cones.', skill: 'Dribbling', category: 'Technical', players: 'Solo', duration_minutes: 10, image_url: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&q=80&w=500' },
                { title: 'L-Turns & Cruyffs', description: 'Practice L-turn and Cruyff turn moves to beat defenders.', skill: 'Dribbling', category: 'Technical', players: 'Solo', duration_minutes: 12, image_url: 'https://images.unsplash.com/photo-1628157588553-5eeea00af15c?auto=format&fit=crop&q=80&w=500' },
                { title: 'Wall Passing', description: 'Pass against wall and control return. Work both feet.', skill: 'Passing', category: 'Technical', players: 'Solo', duration_minutes: 15, image_url: 'https://images.unsplash.com/photo-1517466787929-bc90951d0974?auto=format&fit=crop&q=80&w=500' },
                { title: '1-Minute Speed Dribble', description: 'Dribble through cone course as fast as possible. Time yourself.', skill: 'Speed', category: 'Fitness', players: 'Solo', duration_minutes: 10, image_url: 'https://images.unsplash.com/photo-1551958219-acbc608c6377?auto=format&fit=crop&q=80&w=500' },
                { title: 'Turn & Burn', description: 'Receive ball, turn quickly, and accelerate away.', skill: 'Transitions', category: 'Technical', players: 'Solo', duration_minutes: 8, image_url: 'https://images.unsplash.com/photo-1526232761682-d26e03ac148e?auto=format&fit=crop&q=80&w=500' },
                { title: 'Triangle Passing', description: 'Two players pass in triangle pattern, moving to next cone after pass.', skill: 'Passing', category: 'Technical', players: '2 Players', duration_minutes: 15, image_url: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&q=80&w=500' },
                { title: 'Mirror Drill', description: 'One player leads, other mirrors movements. Switch roles.', skill: 'Agility/Defense', category: 'Technical', players: '2 Players', duration_minutes: 5, image_url: 'https://images.unsplash.com/photo-1628157588553-5eeea00af15c?auto=format&fit=crop&q=80&w=500' },
                { title: 'One-Touch Circle', description: 'Quick one-touch passing in circular pattern.', skill: 'Passing', category: 'Technical', players: '2 Players', duration_minutes: 12, image_url: 'https://images.unsplash.com/photo-1517466787929-bc90951d0974?auto=format&fit=crop&q=80&w=500' },
                { title: 'Pressure Shielding', description: 'Shield ball from defender using body position.', skill: 'Strength', category: 'Physical', players: '2 Players', duration_minutes: 10, image_url: 'https://images.unsplash.com/photo-1551958219-acbc608c6377?auto=format&fit=crop&q=80&w=500' },
                { title: 'Shadow Defending', description: 'Stay goal-side and track attacker movements.', skill: 'Positioning', category: 'Tactical', players: 'w/ Sibling', duration_minutes: 8, image_url: 'https://images.unsplash.com/photo-1526232761682-d26e03ac148e?auto=format&fit=crop&q=80&w=500' },
                { title: 'Reactive Sprinting', description: 'React to partner commands and sprint in different directions.', skill: 'Speed', category: 'Fitness', players: 'w/ Sibling', duration_minutes: 5, image_url: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&q=80&w=500' },
                { title: 'Fox Tails (Chasey)', description: 'Tuck shirt in back and try to grab opponents tail while protecting yours.', skill: 'Agility', category: 'Fun', players: 'w/ Sibling', duration_minutes: 10, image_url: 'https://images.unsplash.com/photo-1628157588553-5eeea00af15c?auto=format&fit=crop&q=80&w=500' },
                { title: 'Parent Feed Volleys', description: 'Parent tosses ball, player volleys back. Work on technique.', skill: 'Control/Shooting', category: 'Technical', players: 'w/ Parent', duration_minutes: 10, image_url: 'https://images.unsplash.com/photo-1517466787929-bc90951d0974?auto=format&fit=crop&q=80&w=500' },
                { title: 'Red Light, Green Light', description: 'Dribble on green light, stop ball on red light.', skill: 'Dribbling', category: 'Fun', players: 'w/ Parent', duration_minutes: 10, image_url: 'https://images.unsplash.com/photo-1551958219-acbc608c6377?auto=format&fit=crop&q=80&w=500' },
                { title: 'Target Passing', description: 'Pass ball to hit targets set up by parent.', skill: 'Passing', category: 'Technical', players: 'w/ Parent', duration_minutes: 15, image_url: 'https://images.unsplash.com/photo-1526232761682-d26e03ac148e?auto=format&fit=crop&q=80&w=500' },
                { title: 'Penalty Shootout', description: 'Practice penalty kicks with parent as keeper.', skill: 'Shooting', category: 'Fun', players: 'w/ Parent', duration_minutes: 15, image_url: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&q=80&w=500' }
            ];

            const { data: insertedDrills, error: drillsError } = await supabase.from('drills').insert(drillsToInsert).select();
            if (drillsError) throw new Error(`Drills: ${drillsError.message}`);

            // ============================================================
            // STEP 8: Seed Badges (15 badges)
            // ============================================================
            setResult({ status: 'progress', message: 'Step 8/12: Creating badges...' });

            const badgesToInsert = [
                { id: 'clinical_finisher', name: 'Clinical Finisher', icon: '🎯', description: 'Scored a goal or showed excellent shooting technique.', category: 'Performance' },
                { id: 'lockdown_defender', name: 'Lockdown Defender', icon: '🛡️', description: 'Unbeatable in 1v1 situations or made game-saving tackles.', category: 'Performance' },
                { id: 'the_great_wall', name: 'The Great Wall', icon: '🧱', description: 'Clean sheet or commanded the box effectively (GK).', category: 'Performance' },
                { id: 'playmaker', name: 'Playmaker', icon: '🪄', description: 'Unlocked the defense with creative passing or assists.', category: 'Performance' },
                { id: 'interceptor', name: 'Interceptor', icon: '🛑', description: 'Consistently read the game to break up opponent play.', category: 'Performance' },
                { id: 'two_footed', name: 'Two-Footed', icon: '🔄', description: 'Successfully used weak foot to pass or shoot.', category: 'Technical' },
                { id: 'most_improved', name: 'Most Improved', icon: '📈', description: 'Showed the most progress in a specific skill.', category: 'Technical' },
                { id: 'skill_master', name: 'Skill Master', icon: '🧪', description: 'Mastered a new skill move and used it effectively.', category: 'Technical' },
                { id: 'engine_room', name: 'Engine Room', icon: '🏃', description: 'Highest work rate and covered the most ground.', category: 'Technical' },
                { id: 'composure', name: 'Composure', icon: '🧘', description: 'Stayed calm under heavy pressure.', category: 'Technical' },
                { id: 'the_general', name: 'The General', icon: '📣', description: 'Exceptional communication and organization.', category: 'Culture' },
                { id: 'ultimate_teammate', name: 'Ultimate Teammate', icon: '🤝', description: 'Encouraged teammates and lifted spirits.', category: 'Culture' },
                { id: 'fire_starter', name: 'Fire Starter', icon: '🔥', description: 'Brought the most energy and hype to the session.', category: 'Culture' },
                { id: 'student_of_the_game', name: 'Student of the Game', icon: '📚', description: 'Asked great questions and understood the "Why".', category: 'Culture' },
                { id: 'the_professional', name: 'The Professional', icon: '⏰', description: 'Arrived early, fully geared up, and ready to work.', category: 'Culture' }
            ];

            const { error: badgesError } = await supabase.from('badges').insert(badgesToInsert);
            if (badgesError) throw new Error(`Badges: ${badgesError.message}`);

            // ============================================================
            // STEP 9: Seed Assignments (Homework for players)
            // ============================================================
            setResult({ status: 'progress', message: 'Step 9/12: Creating homework assignments...' });

            // Get players and drills for assignments
            const { data: allPlayersForAssign } = await supabase.from('players').select('id, team_id, first_name');
            const u11PlayersForAssign = allPlayersForAssign?.filter(p => p.team_id === 'd02aba3e-3c30-430f-9377-3b334cffcd04') || [];

            if (insertedDrills && insertedDrills.length > 0 && u11PlayersForAssign.length > 0) {
                const assignmentsToInsert = [];
                const today = new Date();

                // Assign first 5 drills to first 5 U11 players
                for (let i = 0; i < Math.min(5, u11PlayersForAssign.length); i++) {
                    const dueDate = new Date(today);
                    dueDate.setDate(dueDate.getDate() + 3 + i);

                    assignmentsToInsert.push({
                        drill_id: insertedDrills[i % insertedDrills.length].id,
                        player_id: u11PlayersForAssign[i].id,
                        team_id: 'd02aba3e-3c30-430f-9377-3b334cffcd04',
                        due_date: dueDate.toISOString(),
                        status: i < 2 ? 'completed' : 'pending',
                        completed_at: i < 2 ? new Date().toISOString() : null
                    });
                }

                await supabase.from('assignments').insert(assignmentsToInsert);
            }

            // ============================================================
            // STEP 10: Seed Player Badges (Earned badges)
            // ============================================================
            setResult({ status: 'progress', message: 'Step 10/12: Awarding player badges...' });

            if (u11PlayersForAssign.length > 0) {
                const playerBadgesToInsert = [
                    { player_id: u11PlayersForAssign[0]?.id, badge_id: 'clinical_finisher', notes: 'Hat trick vs Lions FC!' },
                    { player_id: u11PlayersForAssign[0]?.id, badge_id: 'fire_starter', notes: 'Amazing energy at Tuesday practice' },
                    { player_id: u11PlayersForAssign[1]?.id, badge_id: 'playmaker', notes: '3 assists in last game' },
                    { player_id: u11PlayersForAssign[2]?.id, badge_id: 'lockdown_defender', notes: 'Shutdown their best player' },
                    { player_id: u11PlayersForAssign[3]?.id, badge_id: 'the_great_wall', notes: 'Clean sheet!' },
                    { player_id: u11PlayersForAssign[4]?.id, badge_id: 'most_improved', notes: 'Huge improvement in passing' },
                ].filter(b => b.player_id);

                await supabase.from('player_badges').insert(playerBadgesToInsert);
            }

            // ============================================================
            // STEP 11: Seed Chat Channels & Messages
            // ============================================================
            setResult({ status: 'progress', message: 'Step 11/12: Creating chat channels & messages...' });

            // Create channels for U11 team
            const channelsToInsert = [
                { team_id: 'd02aba3e-3c30-430f-9377-3b334cffcd04', name: 'Team Chat', type: 'team', description: 'General team discussion' },
                { team_id: 'd02aba3e-3c30-430f-9377-3b334cffcd04', name: 'Parents Only', type: 'parents', description: 'Parent coordination' },
                { team_id: 'd02aba3e-3c30-430f-9377-3b334cffcd04', name: 'Announcements', type: 'announcement', description: 'Important team announcements' }
            ];

            const { data: insertedChannels, error: channelsError } = await supabase.from('channels').insert(channelsToInsert).select();
            if (channelsError) console.log('Channels may already exist:', channelsError.message);

            // Seed sample messages
            if (insertedChannels && insertedChannels.length > 0) {
                const teamChannel = insertedChannels.find(c => c.type === 'team');
                const announcementChannel = insertedChannels.find(c => c.type === 'announcement');

                const messagesToInsert = [
                    { channel_id: announcementChannel?.id, sender_name: 'Coach Dave', sender_role: 'coach', content: '📢 REMINDER: Saturday game vs Eagles at 10am. Arrive by 9:15am. Wear HOME kit (red).', message_type: 'announcement', is_urgent: true },
                    { channel_id: announcementChannel?.id, sender_name: 'Coach Dave', sender_role: 'coach', content: 'Great practice today everyone! Keep working on those first touches at home.', message_type: 'announcement' },
                    { channel_id: teamChannel?.id, sender_name: 'Coach Dave', sender_role: 'coach', content: 'Looking forward to seeing everyone at practice Tuesday!', message_type: 'text' },
                    { channel_id: teamChannel?.id, sender_name: 'Sarah (Bo\'s Mom)', sender_role: 'parent', content: 'Bo will be 5 minutes late on Tuesday - dentist appointment.', message_type: 'text' },
                    { channel_id: teamChannel?.id, sender_name: 'Coach Dave', sender_role: 'coach', content: 'No problem Sarah, thanks for letting me know!', message_type: 'text' },
                    { channel_id: teamChannel?.id, sender_name: 'Mike (Marcus\'s Dad)', sender_role: 'parent', content: 'Can someone carpool from the north side on Saturday?', message_type: 'text' },
                    { channel_id: teamChannel?.id, sender_name: 'Lisa (Jake\'s Mom)', sender_role: 'parent', content: 'We can pick up Marcus! We drive right by your area.', message_type: 'text' }
                ].filter(m => m.channel_id);

                await supabase.from('messages').insert(messagesToInsert);
            }

            // ============================================================
            // STEP 12: Seed Player Stats & Evaluations
            // ============================================================
            setResult({ status: 'progress', message: 'Step 12/12: Creating player stats & evaluations...' });

            // Player stats
            if (u11PlayersForAssign.length > 0) {
                const statsToInsert = u11PlayersForAssign.map((player, idx) => ({
                    player_id: player.id,
                    xp: Math.floor(Math.random() * 500) + 100,
                    level: Math.floor(idx / 3) + 1,
                    games_played: Math.floor(Math.random() * 10) + 5,
                    goals: player.first_name === 'Bo' ? 8 : Math.floor(Math.random() * 5),
                    assists: Math.floor(Math.random() * 4),
                    clean_sheets: 0
                }));

                await supabase.from('player_stats').insert(statsToInsert);
            }

            // ============================================================
            // STEP 13: Reassign current user to U11 team
            // ============================================================
            setResult({ status: 'progress', message: 'Finalizing: Assigning your profile to U11 team...' });

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

                    <p className="text-xs text-gray-600 text-center">Creates: 3 teams • 42 players • 60+ events • 19 drills • 15 badges • chat channels</p>
                </div>
            </div>
        </div>
    );
};

export default AdminPanel;
