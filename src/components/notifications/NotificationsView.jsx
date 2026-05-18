import React, { useEffect, useState } from 'react';
import { Bell, Smartphone, Trash2, Loader2 } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../Toast';
import EnablePushButton from './EnablePushButton';

// NotificationsView — landing surface for Notifications tab in parent
// + manager dashboards. Phase 2 minimum: enable/disable push for this
// device, list of registered devices, link to the in-app history.
// Phase 3 will add the per-category settings + snooze + quiet hours
// matrix on this same surface.
const NotificationsView = () => {
    const { user } = useAuth();
    const toast = useToast();
    const [devices, setDevices] = useState([]);
    const [loading, setLoading] = useState(true);

    const load = async () => {
        if (!user?.id) return;
        setLoading(true);
        const { data, error } = await supabase
            .from('user_push_subscriptions')
            .select('id, endpoint, user_agent, created_at, last_seen_at')
            .eq('user_id', user.id)
            .order('last_seen_at', { ascending: false });
        if (error) console.warn('load devices failed:', error);
        setDevices(data || []);
        setLoading(false);
    };

    useEffect(() => { load(); }, [user?.id]);

    const revoke = async (id) => {
        const { error } = await supabase.from('user_push_subscriptions').delete().eq('id', id);
        if (error) { toast.error(`Couldn't revoke: ${error.message}`); return; }
        toast.success("Device revoked.");
        await load();
    };

    const friendlyAgent = (ua) => {
        if (!ua) return 'Unknown device';
        if (/iPhone|iPad/i.test(ua)) return 'iPhone/iPad';
        if (/Android/i.test(ua)) return 'Android';
        if (/Macintosh/i.test(ua)) return 'Mac';
        if (/Windows/i.test(ua)) return 'Windows PC';
        return 'Browser';
    };

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl text-white font-display font-bold uppercase tracking-wider flex items-center gap-2">
                    <Bell className="w-6 h-6 text-brand-green" /> Notifications
                </h1>
                <p className="text-gray-400 text-sm mt-1">
                    Manage push notifications and registered devices. Per-category snooze + quiet hours coming next phase.
                </p>
            </div>

            <div className="glass-panel p-5 space-y-3">
                <h2 className="text-white font-bold flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-brand-gold" /> Push on this device
                </h2>
                <p className="text-xs text-gray-400">
                    When enabled, you'll get a phone banner for new chat messages, new events, and (for coaches/managers) RSVP changes — even when Fire FC is closed.
                </p>
                <EnablePushButton />
            </div>

            <div className="glass-panel p-5">
                <h2 className="text-white font-bold mb-3 flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-brand-green" /> Registered devices
                </h2>
                {loading ? (
                    <div className="text-gray-500 text-sm flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
                ) : devices.length === 0 ? (
                    <p className="text-gray-500 text-sm">No devices registered yet. Enable push above to add this one.</p>
                ) : (
                    <ul className="space-y-2">
                        {devices.map(d => (
                            <li key={d.id} className="flex items-center justify-between bg-white/5 p-3 rounded-lg">
                                <div className="min-w-0">
                                    <div className="text-white text-sm font-medium">{friendlyAgent(d.user_agent)}</div>
                                    <div className="text-gray-500 text-xs">
                                        Last seen: {new Date(d.last_seen_at).toLocaleString()}
                                    </div>
                                </div>
                                <button
                                    onClick={() => revoke(d.id)}
                                    className="text-red-400 hover:text-red-300 p-2 rounded hover:bg-red-500/10"
                                    title="Revoke this device"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
};

export default NotificationsView;
