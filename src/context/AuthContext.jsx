import React, { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '../supabaseClient';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

// Player access tokens (kid-mode logins) need to keep the session alive
// long enough to last a typical training day, even across page navigations
// and tab close/reopen. 3 hours per the user's requirement.
const PLAYER_SESSION_TTL_MS = 3 * 60 * 60 * 1000;
const VIRTUAL_USER_KEY = 'user';
const VIRTUAL_USER_EXPIRES_KEY = 'user_expires_at';

// Save a virtual (non-Supabase) user to localStorage. Players get a 3-hour
// expiry; demo/manager virtual users persist until explicit signOut.
const saveVirtualUser = (userObj) => {
    localStorage.setItem(VIRTUAL_USER_KEY, JSON.stringify(userObj));
    if (userObj?.role === 'player') {
        localStorage.setItem(VIRTUAL_USER_EXPIRES_KEY, String(Date.now() + PLAYER_SESSION_TTL_MS));
    } else {
        localStorage.removeItem(VIRTUAL_USER_EXPIRES_KEY);
    }
};

// Read the virtual user, honoring TTL. Returns null if missing or expired.
const readVirtualUser = () => {
    const stored = localStorage.getItem(VIRTUAL_USER_KEY);
    if (!stored) return null;
    const expiresAtStr = localStorage.getItem(VIRTUAL_USER_EXPIRES_KEY);
    if (expiresAtStr) {
        const expiresAt = parseInt(expiresAtStr, 10);
        if (Number.isFinite(expiresAt) && Date.now() > expiresAt) {
            localStorage.removeItem(VIRTUAL_USER_KEY);
            localStorage.removeItem(VIRTUAL_USER_EXPIRES_KEY);
            return null;
        }
    }
    try {
        return JSON.parse(stored);
    } catch {
        localStorage.removeItem(VIRTUAL_USER_KEY);
        localStorage.removeItem(VIRTUAL_USER_EXPIRES_KEY);
        return null;
    }
};

const clearVirtualUser = () => {
    localStorage.removeItem(VIRTUAL_USER_KEY);
    localStorage.removeItem(VIRTUAL_USER_EXPIRES_KEY);
};

const profileFromVirtualUser = (vu) => ({
    id: vu.id,
    full_name: vu.display_name || 'User',
    email: vu.email,
    role: vu.role,
    avatar_url: vu.avatar_url || null,
});

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [session, setSession] = useState(null);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    const [demoUser, setDemoUser] = useState(null);

    useEffect(() => {
        // Initial mount — restore from real Supabase session OR fall back
        // to a virtual user (player token / demo) from localStorage.
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            if (session?.user) {
                setUser(session.user);
                fetchProfile(session.user.id);
            } else {
                const vu = readVirtualUser();
                if (vu) {
                    setUser(vu);
                    setProfile(profileFromVirtualUser(vu));
                }
                setLoading(false);
            }
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            if (session?.user) {
                // Real Supabase auth — replaces any virtual user
                setUser(session.user);
                fetchProfile(session.user.id);
            } else {
                // No real session. DO NOT clear a virtual user here — they
                // (player tokens, demo accounts) are managed via localStorage
                // with their own TTL. Earlier code did `setUser(null)` here
                // unconditionally, which logged players out the moment any
                // auth event fired (e.g., on navigation).
                const vu = readVirtualUser();
                if (vu) {
                    setUser(vu);
                    setProfile(profileFromVirtualUser(vu));
                } else {
                    setUser(null);
                    setProfile(null);
                }
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

            // Fetch user's role from team_memberships
            const { data: membership, error: membershipError } = await supabase
                .from('team_memberships')
                .select('role, team_id')
                .eq('user_id', userId)
                .order('joined_at', { ascending: false })
                .limit(1)
                .single();

            // Merge role into profile
            const profileWithRole = {
                ...data,
                role: membership?.role || null,
                team_id: membership?.team_id || null
            };

            setProfile(profileWithRole);
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
        clearVirtualUser();
        setUser(null);
        setProfile(null);
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
        if (!import.meta.env.DEV) {
            console.warn('Demo mode is disabled in production');
            return { data: null, error: { message: 'Demo mode disabled' } };
        }

        let demoUser = {
            id: '',
            email: 'demo@firefc.com',
            role: role
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
            demoUser.id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
            demoUser.email = 'coach@firefc.com';
            demoUser.display_name = 'Coach Mike';
        }

        setUser(demoUser);
        saveVirtualUser(demoUser);

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
            // Persist with 3-hour TTL (handled by saveVirtualUser based on role)
            saveVirtualUser(playerUser);

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

    // Login with access token (parent-generated link)
    const loginWithToken = async (playerData) => {
        // playerData comes from verify_player_access_token RPC
        const playerUser = {
            id: playerData.id,
            email: 'player@firefc.com',
            role: 'player',
            display_name: `${playerData.first_name} ${playerData.last_name}`,
            avatar_url: playerData.avatar_url,
            team_id: playerData.team_id
        };

        setUser(playerUser);
        // Persist with 3-hour TTL (handled by saveVirtualUser based on role)
        saveVirtualUser(playerUser);

        const playerProfile = {
            id: playerUser.id,
            full_name: playerUser.display_name,
            email: playerUser.email,
            role: 'player',
            avatar_url: playerUser.avatar_url || null
        };
        setProfile(playerProfile);

        return { data: playerUser, error: null };
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
        loginPlayer,
        loginWithToken
    };

    return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
};
