import React, { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '../supabaseClient';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [session, setSession] = useState(null);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    const [demoUser, setDemoUser] = useState(null);

    useEffect(() => {
        // Check active sessions and sets the user
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) fetchProfile(session.user.id);
            else {
                // Check for virtual user (Demo or Player PIN)
                const storedUser = localStorage.getItem('user');
                if (storedUser) {
                    const parsedUser = JSON.parse(storedUser);
                    setUser(parsedUser);

                    // Create profile for demo/virtual user
                    const virtualProfile = {
                        id: parsedUser.id,
                        full_name: parsedUser.display_name || 'User',
                        email: parsedUser.email,
                        role: parsedUser.role,
                        avatar_url: parsedUser.avatar_url || null
                    };
                    setProfile(virtualProfile);
                }
                setLoading(false);
            }
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) fetchProfile(session.user.id);
            else {
                // Keep virtual user if exists, unless explicitly signed out? 
                // Actually signOut clears it.
                setProfile(null);
                setLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const fetchProfile = async (userId) => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (error) {
                console.warn('Error fetching profile:', error);
            }

            setProfile(data);
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const signIn = async (email, password) => {
        return supabase.auth.signInWithPassword({ email, password });
    };

    const signOut = async () => {
        setDemoUser(null);
        return supabase.auth.signOut();
    };

    const signUp = async (email, password, metadata = {}) => {
        // Ensure role is set, defaulting to parent if not provided (though DB handles default too)
        const data = {
            role: 'parent',
            ...metadata
        };

        return supabase.auth.signUp({
            email,
            password,
            options: {
                data: data
            }
        });
    };

    const loginDemo = (role) => {
        let demoUser = {
            id: '',
            email: 'demo@firefc.com',
            role: role // 'coach', 'player', 'parent', 'manager'
        };

        if (role === 'manager') {
            demoUser.id = 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380d44';
            demoUser.email = 'manager@firefc.com';
            demoUser.display_name = 'Club Director';
        } else if (role === 'player') {
            demoUser.id = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22';
            demoUser.email = 'player@firefc.com';
            demoUser.display_name = 'Bo Tipp';
            demoUser.avatar_url = '/branding/bo_tipp.png';
        } else if (role === 'parent') {
            demoUser.id = 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c33';
            demoUser.email = 'parent@firefc.com';
            demoUser.display_name = 'Parent';
        } else {
            // Default Coach match
            demoUser.id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
            demoUser.email = 'coach@firefc.com';
            demoUser.display_name = 'Coach Mike';
        }

        setUser(demoUser);
        localStorage.setItem('user', JSON.stringify(demoUser));

        // Create demo profile object (demo profiles don't exist in DB)
        const demoProfile = {
            id: demoUser.id,
            full_name: demoUser.display_name,
            email: demoUser.email,
            role: role,
            avatar_url: demoUser.avatar_url || null
        };
        setProfile(demoProfile);

        return { data: { user: demoUser }, error: null };
    };

    const loginPlayer = async (playerId, pin) => {
        try {
            const { data, error } = await supabase.rpc('verify_player_pin', {
                player_id: playerId,
                input_pin: pin
            });

            if (error) throw error;
            if (!data.success) throw new Error(data.message);

            // Create a virtual user session
            const playerUser = {
                id: data.player.id,
                email: 'player@firefc.com', // Dummy
                role: 'player',
                display_name: `${data.player.first_name} ${data.player.last_name}`,
                avatar_url: data.player.avatar_url,
                team_id: data.player.team_id
            };

            setUser(playerUser);
            // Persist to local storage so it survives refresh (simple version)
            localStorage.setItem('user', JSON.stringify(playerUser));

            // Create profile for player
            const playerProfile = {
                id: playerUser.id,
                full_name: playerUser.display_name,
                email: playerUser.email,
                role: 'player',
                avatar_url: playerUser.avatar_url || null
            };
            setProfile(playerProfile);

            return { data: playerUser, error: null };

        } catch (err) {
            console.error("Player Login Error:", err);
            return { data: null, error: err };
        }
    };

    const value = {
        user: demoUser || user,
        session,
        profile,
        signIn,
        signOut,
        signUp,
        loading,
        loginDemo,
        loginPlayer
    };

    return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
};
