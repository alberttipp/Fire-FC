import React, { useEffect, useMemo, useState } from 'react';
import { Bell, Smartphone, Trash2, Loader2, Moon, Clock, BellOff, BellRing } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../Toast';
import { NOTIFICATION_CATEGORIES, NOTIFICATION_CHANNELS, SNOOZE_OPTIONS } from '../../constants/notifications';
import EnablePushButton from './EnablePushButton';
import { getPushStatus } from '../../utils/push';

// Phase 3 settings view: per-category snooze + channel matrix + quiet
// hours + registered devices. Reads/writes notification_preferences,
// notification_snoozes, profiles.quiet_hours_*. All edits hit DB via
// upsert with composite primary keys — no race.
const NotificationsView = () => {
    const { user, profile } = useAuth();
    const toast = useToast();

    const [prefs, setPrefs] = useState({});      // { `${cat}|${ch}`: enabled bool }
    const [snoozes, setSnoozes] = useState({});  // { cat: ISO string }
    const [quiet, setQuiet] = useState({ start: '', end: '', tz: 'America/Chicago' });
    const [devices, setDevices] = useState([]);
    const [pushStatus, setPushStatus] = useState(null); // this device/context's live status
    const [loading, setLoading] = useState(true);
    const [savingQuiet, setSavingQuiet] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const tick = () => getPushStatus().then(s => { if (!cancelled) setPushStatus(s); });
        tick();
        document.addEventListener('visibilitychange', tick);
        return () => { cancelled = true; document.removeEventListener('visibilitychange', tick); };
    }, []);

    const load = async () => {
        if (!user?.id) return;
        setLoading(true);
        const [prefsRes, snoozesRes, devicesRes, profRes] = await Promise.all([
            supabase.from('notification_preferences').select('category, channel, enabled').eq('user_id', user.id),
            supabase.from('notification_snoozes').select('category, snooze_until').eq('user_id', user.id),
            supabase.from('user_push_subscriptions').select('id, endpoint, user_agent, created_at, last_seen_at').eq('user_id', user.id).order('last_seen_at', { ascending: false }),
            supabase.from('profiles').select('quiet_hours_start, quiet_hours_end, quiet_hours_tz').eq('id', user.id).maybeSingle(),
        ]);
        const p = {};
        (prefsRes.data || []).forEach(r => { p[`${r.category}|${r.channel}`] = r.enabled; });
        setPrefs(p);
        const s = {};
        (snoozesRes.data || []).forEach(r => { s[r.category] = r.snooze_until; });
        setSnoozes(s);
        setDevices(devicesRes.data || []);
        setQuiet({
            start: profRes.data?.quiet_hours_start || '',
            end: profRes.data?.quiet_hours_end || '',
            tz: profRes.data?.quiet_hours_tz || 'America/Chicago',
        });
        setLoading(false);
    };

    useEffect(() => { load(); }, [user?.id]);

    const isEnabled = (cat, ch) => {
        const v = prefs[`${cat}|${ch}`];
        return v === undefined ? true : v; // sparse default = on
    };

    const togglePref = async (cat, ch) => {
        const next = !isEnabled(cat, ch);
        setPrefs(prev => ({ ...prev, [`${cat}|${ch}`]: next }));
        const { error } = await supabase.from('notification_preferences').upsert({
            user_id: user.id, category: cat, channel: ch, enabled: next, updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,category,channel' });
        if (error) {
            toast.error(`Couldn't save: ${error.message}`);
            setPrefs(prev => ({ ...prev, [`${cat}|${ch}`]: !next }));
        }
    };

    const snooze = async (cat, minutes) => {
        const until = new Date(Date.now() + minutes * 60_000).toISOString();
        setSnoozes(prev => ({ ...prev, [cat]: until }));
        const { error } = await supabase.from('notification_snoozes').upsert({
            user_id: user.id, category: cat, snooze_until: until, updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,category' });
        if (error) {
            toast.error(`Couldn't snooze: ${error.message}`);
            await load();
        } else {
            toast.success(`Snoozed ${cat} until ${new Date(until).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`);
        }
    };

    const resume = async (cat) => {
        setSnoozes(prev => { const n = { ...prev }; delete n[cat]; return n; });
        const { error } = await supabase.from('notification_snoozes').delete().eq('user_id', user.id).eq('category', cat);
        if (error) { toast.error(`Couldn't resume: ${error.message}`); await load(); }
        else toast.success('Resumed.');
    };

    const saveQuietHours = async () => {
        setSavingQuiet(true);
        const { error } = await supabase.from('profiles').update({
            quiet_hours_start: quiet.start || null,
            quiet_hours_end: quiet.end || null,
            quiet_hours_tz: quiet.tz || 'America/Chicago',
        }).eq('id', user.id);
        setSavingQuiet(false);
        if (error) toast.error(`Couldn't save quiet hours: ${error.message}`);
        else toast.success('Quiet hours saved.');
    };

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

    const snoozeRemaining = (cat) => {
        const until = snoozes[cat];
        if (!until) return null;
        const ms = new Date(until).getTime() - Date.now();
        if (ms <= 0) return null;
        const mins = Math.round(ms / 60_000);
        if (mins < 60) return `${mins}m left`;
        if (mins < 60 * 24) return `${Math.round(mins / 60)}h left`;
        return `${Math.round(mins / (60 * 24))}d left`;
    };

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl text-white font-display font-bold uppercase tracking-wider flex items-center gap-2">
                    <Bell className="w-6 h-6 text-brand-green" /> Notifications
                </h1>
                <p className="text-gray-400 text-sm mt-1">
                    Control what you get notified about, where, and when.
                </p>
            </div>

            {/* Enable push on this device */}
            <div className="glass-panel p-5 space-y-3">
                <h2 className="text-white font-bold flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-brand-gold" /> Push on this device
                </h2>
                <p className="text-xs text-gray-400">
                    Required before any phone banners can reach this browser. iPhone users need to Add to Home Screen first.
                </p>
                {/* Live per-context status — push is per browser context, so the
                    installed app and a browser tab each show their own state. */}
                {pushStatus && (
                    <div className="flex flex-wrap gap-2 text-[11px]">
                        <span className={`px-2 py-1 rounded-full font-bold ${pushStatus.subscribed ? 'bg-brand-green/20 text-brand-green' : 'bg-red-500/20 text-red-300'}`}>
                            This device: {pushStatus.subscribed ? 'Subscribed ✅' : 'Not subscribed ❌'}
                        </span>
                        <span className="px-2 py-1 rounded-full bg-white/5 text-gray-300">Permission: {pushStatus.permission}</span>
                        <span className="px-2 py-1 rounded-full bg-white/5 text-gray-300">{pushStatus.standalone ? 'Installed app' : 'Browser tab'}</span>
                        {pushStatus.iosNeedsInstall && <span className="px-2 py-1 rounded-full bg-brand-gold/20 text-brand-gold">iPhone: add to Home Screen to enable</span>}
                    </div>
                )}
                <EnablePushButton />
            </div>

            {loading ? (
                <div className="glass-panel p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-500" /></div>
            ) : (
                <>
                {/* Snooze panel */}
                <div className="glass-panel p-5">
                    <h2 className="text-white font-bold mb-1 flex items-center gap-2">
                        <Moon className="w-4 h-4 text-blue-400" /> Snooze by category
                    </h2>
                    <p className="text-xs text-gray-400 mb-4">
                        Mute a single category for a fixed window. In-app bell still records everything; only phone banners are silenced.
                    </p>
                    <div className="space-y-3">
                        {NOTIFICATION_CATEGORIES.map(cat => {
                            const remaining = snoozeRemaining(cat.id);
                            return (
                                <div key={cat.id} className="flex items-start justify-between gap-3 p-3 bg-white/5 rounded-lg">
                                    <div className="flex-1 min-w-0">
                                        <div className="text-white text-sm font-medium">{cat.label}</div>
                                        <div className="text-gray-500 text-[11px]">{cat.description}</div>
                                        {remaining && <div className="text-blue-400 text-[11px] font-bold mt-1">Snoozed · {remaining}</div>}
                                    </div>
                                    <div className="flex items-center gap-1 flex-wrap justify-end">
                                        {remaining ? (
                                            <button onClick={() => resume(cat.id)} className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider rounded bg-brand-green/20 text-brand-green hover:bg-brand-green/30">Resume</button>
                                        ) : (
                                            SNOOZE_OPTIONS.map(opt => (
                                                <button
                                                    key={opt.minutes}
                                                    onClick={() => snooze(cat.id, opt.minutes)}
                                                    className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider rounded bg-white/5 text-gray-300 hover:bg-white/10"
                                                >{opt.label}</button>
                                            ))
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Channel matrix */}
                <div className="glass-panel p-5">
                    <h2 className="text-white font-bold mb-1 flex items-center gap-2">
                        <BellRing className="w-4 h-4 text-brand-green" /> Channels by category
                    </h2>
                    <p className="text-xs text-gray-400 mb-4">
                        Pick which categories ping you in-app vs phone. Default is on for everything.
                    </p>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-gray-400 text-[10px] uppercase tracking-wider border-b border-white/10">
                                    <th className="py-2 pr-3">Category</th>
                                    {NOTIFICATION_CHANNELS.map(c => (
                                        <th key={c.id} className="py-2 px-3 text-center" title={c.description}>{c.label}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {NOTIFICATION_CATEGORIES.map(cat => (
                                    <tr key={cat.id} className="border-b border-white/5">
                                        <td className="py-2.5 pr-3 text-white">{cat.label}</td>
                                        {NOTIFICATION_CHANNELS.map(ch => {
                                            const on = isEnabled(cat.id, ch.id);
                                            return (
                                                <td key={ch.id} className="py-2.5 px-3 text-center">
                                                    <button
                                                        onClick={() => togglePref(cat.id, ch.id)}
                                                        className={`w-10 h-6 rounded-full relative transition-colors ${on ? 'bg-brand-green' : 'bg-gray-700'}`}
                                                        title={on ? 'On — click to mute' : 'Muted — click to enable'}
                                                    >
                                                        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${on ? 'translate-x-4' : 'translate-x-0.5'}`} />
                                                    </button>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Quiet hours */}
                <div className="glass-panel p-5">
                    <h2 className="text-white font-bold mb-1 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-purple-400" /> Quiet hours
                    </h2>
                    <p className="text-xs text-gray-400 mb-4">
                        Silence phone banners during a daily window (in-app bell still records everything). Leave both fields empty to disable.
                    </p>
                    <div className="flex items-end gap-3 flex-wrap">
                        <div>
                            <label className="block text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-1">Start</label>
                            <input
                                type="time"
                                value={quiet.start || ''}
                                onChange={(e) => setQuiet(q => ({ ...q, start: e.target.value }))}
                                className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-1">End</label>
                            <input
                                type="time"
                                value={quiet.end || ''}
                                onChange={(e) => setQuiet(q => ({ ...q, end: e.target.value }))}
                                className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-1">Timezone</label>
                            <input
                                type="text"
                                value={quiet.tz || ''}
                                onChange={(e) => setQuiet(q => ({ ...q, tz: e.target.value }))}
                                placeholder="America/Chicago"
                                className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm w-40"
                            />
                        </div>
                        <button
                            onClick={saveQuietHours}
                            disabled={savingQuiet}
                            className="px-4 py-2 rounded-lg bg-brand-green/20 border border-brand-green/40 text-brand-green text-sm font-bold hover:bg-brand-green/30 disabled:opacity-50"
                        >
                            {savingQuiet ? <Loader2 className="w-4 h-4 animate-spin inline" /> : 'Save'}
                        </button>
                    </div>
                </div>

                {/* Devices */}
                <div className="glass-panel p-5">
                    <h2 className="text-white font-bold mb-3 flex items-center gap-2">
                        <Smartphone className="w-4 h-4 text-brand-green" /> Registered devices
                    </h2>
                    {devices.length === 0 ? (
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
                </>
            )}
        </div>
    );
};

export default NotificationsView;
