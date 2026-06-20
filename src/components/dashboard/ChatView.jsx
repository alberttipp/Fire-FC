import React, { useState, useEffect, useRef } from 'react';
import { Send, AlertCircle, Hash, MessageSquare, Users, Bell, Megaphone, Lock, Loader2, Menu, X, Plus, Image as ImageIcon } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../Toast';
import ReactionBar from '../ReactionBar';
import useLongPress from '../../hooks/useLongPress';
import NewConversationModal from './NewConversationModal';

const ChatView = ({ initialConversationId = null }) => {
    const { user, profile } = useAuth();
    const toast = useToast();
    // Deep-link target from a chat push notification — consumed once on the
    // first channel load so it lands on that thread, then normal behavior.
    const initialConvRef = useRef(initialConversationId);
    const [channels, setChannels] = useState([]);
    const [activeChannel, setActiveChannel] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    // When set, that message id shows the reaction picker. Cleared on
    // any selection (auto-close) or on background tap.
    const [reactionPickerFor, setReactionPickerFor] = useState(null);
    // { conversation_id: unread_count } — driven by the
    // get_conversation_unread_counts RPC and refreshed on every new
    // message via realtime + when the user opens a channel.
    const [unreadByConv, setUnreadByConv] = useState({});

    // Close the picker when the user taps anywhere outside it. The
    // ReactionBar component stops propagation on its own clicks so this
    // only fires on truly-outside taps.
    useEffect(() => {
        if (!reactionPickerFor) return;
        const close = () => setReactionPickerFor(null);
        const t = setTimeout(() => {
            document.addEventListener('click', close);
            document.addEventListener('touchstart', close);
        }, 0); // defer so the long-press that opened it doesn't immediately re-close
        return () => {
            clearTimeout(t);
            document.removeEventListener('click', close);
            document.removeEventListener('touchstart', close);
        };
    }, [reactionPickerFor]);
    const [isUrgent, setIsUrgent] = useState(false);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [imageUploading, setImageUploading] = useState(false);
    const imageInputRef = useRef(null);
    const [memberCount, setMemberCount] = useState(0);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [showNewDM, setShowNewDM] = useState(false);
    const [teamMembers, setTeamMembers] = useState([]);
    const [chatError, setChatError] = useState(null);
    // Reflects the realtime channel state: 'idle' | 'connecting' |
    // 'live' | 'reconnecting' | 'offline'. Used by the small header
    // badge so families know whether what they're seeing is current.
    const [connectionStatus, setConnectionStatus] = useState('idle');
    // Map of message_id -> array of reaction rows. Fetched in one
    // batched query when messages load so ReactionBar doesn't have
    // to fire N parallel GETs per chat open (that pattern saturated
    // PostgREST on 2026-05-23 — every visible message triggered an
    // RLS check, all timed out together, the chat looked dead).
    const [reactionsByMsg, setReactionsByMsg] = useState({});
    const messagesEndRef = useRef(null);
    const channelSubscription = useRef(null);
    // Tracks the conversation whose state is currently live in this component.
    // Used by fetchMessages + realtime handler so a late response or a stale
    // INSERT event can't overwrite the messages of the channel the user has
    // since switched to.
    const activeChannelIdRef = useRef(null);

    const currentUserRole = profile?.role || user?.role || 'coach';
    const currentTeamId = profile?.team_id || null;

    // For parents, the chat sender name is "{Kid}'s {Dad/Mom}" so it's
    // obvious who's talking in a team thread (a name like "Juan Grajales"
    // doesn't tell other families which kid he belongs to). Composed from
    // family_members.relationship_label + the linked player's first name.
    // Coaches/players keep their normal name. Computed once on mount.
    const [parentChatName, setParentChatName] = useState(null);
    useEffect(() => {
        if (!user?.id || currentUserRole !== 'parent') { setParentChatName(null); return; }
        let cancelled = false;
        (async () => {
            const { data } = await supabase
                .from('family_members')
                .select('relationship_label, players:player_id(first_name)')
                .eq('user_id', user.id)
                .in('relationship', ['guardian', 'fan'])
                .order('created_at', { ascending: true })
                .limit(1)
                .maybeSingle();
            if (cancelled) return;
            const kid = data?.players?.first_name;
            if (kid) {
                const label = (data.relationship_label && data.relationship_label !== 'Parent')
                    ? data.relationship_label
                    : 'Parent';
                setParentChatName(`${kid}'s ${label}`);
            }
        })();
        return () => { cancelled = true; };
    }, [user?.id, currentUserRole]);

    const currentUserName = parentChatName
        || profile?.full_name || user?.display_name || user?.email?.split('@')[0] || 'User';

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Lock background scroll while the mobile channel drawer is open so a
    // touch-drag scrolls the drawer's list, not the page behind it.
    useEffect(() => {
        if (!sidebarOpen) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, [sidebarOpen]);

    useEffect(() => {
        if (user?.id) {
            fetchChannels();
            fetchUnreadCounts();
        }
    }, [user?.id]);

    // Refresh unread counts on focus + every 60s while ChatView is open.
    // (Phase 2 will swap this for push-driven realtime — for now polling is
    // cheap and avoids the Supabase realtime privacy-payload concern.)
    useEffect(() => {
        if (!user?.id) return;
        const tick = () => fetchUnreadCounts();
        window.addEventListener('focus', tick);
        document.addEventListener('visibilitychange', tick);
        const interval = setInterval(tick, 60_000);
        return () => {
            window.removeEventListener('focus', tick);
            document.removeEventListener('visibilitychange', tick);
            clearInterval(interval);
        };
    }, [user?.id]);

    useEffect(() => {
        activeChannelIdRef.current = activeChannel?.id || null;
        if (activeChannel) {
            // Remember the last opened channel so the next visit lands
            // here instead of resetting to the first channel.
            try { localStorage.setItem('firefc-last-chat-channel', activeChannel.id); }
            catch (_) { /* localStorage blocked — non-fatal */ }
            fetchMessages(activeChannel.id);
            fetchMemberCount(activeChannel.id);
            subscribeToMessages(activeChannel.id);
            markConversationRead(activeChannel.id);
            setSidebarOpen(false);
        }

        return () => {
            if (channelSubscription.current) {
                supabase.removeChannel(channelSubscription.current);
            }
        };
        // Depend on the id, not the object — fetchChannels re-runs hand back
        // a new array of channel objects, and we don't want a same-id
        // re-render to tear down + rebuild the subscription and refetch.
    }, [activeChannel?.id]);

    const fetchChannels = async () => {
        setLoading(true);
        setChatError(null);
        try {
            const isPlayer = currentUserRole === 'player';
            let allChannels = [];
            let firstFetchError = null;

            if (!isPlayer) {
                // Staff + parents: team channel(s) the user can see via RLS, plus
                // ANY conversation they're a member of (dm / group / staff_dm) —
                // member-based so parent DMs and quick "Message Coach" groups show
                // up, not just staff_dm. Two independent queries in parallel.
                const [teamRes, memberRes] = await Promise.all([
                    supabase
                        .from('conversations')
                        .select('id, team_id, type, name, created_at')
                        .eq('type', 'team')
                        .order('created_at', { ascending: true }),
                    supabase
                        .from('conversations')
                        .select('id, team_id, type, name, created_at, conversation_members!inner(user_id)')
                        .eq('conversation_members.user_id', user.id)
                        .neq('type', 'team')
                        .order('created_at', { ascending: true }),
                ]);

                if (teamRes.error) {
                    console.error('Team convos error:', teamRes.error);
                    firstFetchError = firstFetchError || teamRes.error;
                }
                if (teamRes.data) allChannels.push(...teamRes.data);

                if (memberRes.error) {
                    console.error('Member convos error:', memberRes.error);
                    firstFetchError = firstFetchError || memberRes.error;
                }
                if (memberRes.data) allChannels.push(...memberRes.data);
            } else {
                // Players: only player_dm via conversation_members
                const { data: playerDMs, error: playerErr } = await supabase
                    .from('conversations')
                    .select('id, team_id, type, name, created_at, conversation_members!inner(user_id)')
                    .eq('conversation_members.user_id', user.id)
                    .eq('type', 'player_dm')
                    .order('created_at', { ascending: true });

                if (playerErr) {
                    console.error('Player DMs error:', playerErr);
                    firstFetchError = firstFetchError || playerErr;
                }
                if (playerDMs) allChannels.push(...playerDMs);
            }

            // If every sub-fetch failed AND we got no channels, treat as a real
            // error so the UI can show retry. Partial success (some channels
            // returned, one error) just logs and shows what we got.
            if (firstFetchError && allChannels.length === 0) {
                setChatError(firstFetchError.message || "Couldn't load conversations.");
                setChannels([]);
                setActiveChannel(null);
                return;
            }

            const unique = [...new Map(allChannels.map(c => [c.id, c])).values()];
            setChannels(unique);
            // Prefer the channel the user had open last time so a return
            // visit lands back in context instead of bouncing them to
            // the first channel in the list. Falls back to the first
            // channel if the cached id is no longer accessible.
            let preferred = null;
            // A push-notification deep link wins (consumed once).
            if (initialConvRef.current) {
                preferred = unique.find(c => c.id === initialConvRef.current) || null;
                initialConvRef.current = null;
            }
            if (!preferred) {
                try {
                    const cachedId = localStorage.getItem('firefc-last-chat-channel');
                    if (cachedId) preferred = unique.find(c => c.id === cachedId) || null;
                } catch (_) { /* localStorage blocked — non-fatal */ }
            }
            setActiveChannel(preferred || (unique.length > 0 ? unique[0] : null));
        } catch (err) {
            console.error('Error fetching conversations:', err);
            setChatError(err.message || "Couldn't load conversations.");
            setChannels([]);
            setActiveChannel(null);
        } finally {
            setLoading(false);
        }
    };

    // Pull per-conversation unread counts via the server-side RPC.
    // Cheap single round-trip; refresh on mount, after fetchChannels,
    // when the user opens a conversation (so its badge clears), and on
    // every realtime new-message event for any of the user's convos.
    const fetchUnreadCounts = async () => {
        const { data, error } = await supabase.rpc('get_conversation_unread_counts');
        if (error) {
            console.warn('get_conversation_unread_counts failed:', error);
            return;
        }
        const map = {};
        (data || []).forEach(r => { map[r.conversation_id] = r.unread_count; });
        setUnreadByConv(map);
    };

    // When the user opens a conversation, mark it read by stamping
    // their last_read_at on conversation_members. Optimistically zero
    // the local badge so the UI updates instantly.
    const markConversationRead = async (conversationId) => {
        if (!user?.id || !conversationId) return;
        setUnreadByConv(prev => ({ ...prev, [conversationId]: 0 }));
        await supabase
            .from('conversation_members')
            .update({ last_read_at: new Date().toISOString() })
            .eq('conversation_id', conversationId)
            .eq('user_id', user.id);
    };

    const fetchReactionsForMessages = async (conversationId, messageIds) => {
        if (!messageIds || messageIds.length === 0) {
            setReactionsByMsg({});
            return;
        }
        const { data, error } = await supabase
            .from('message_reactions')
            .select('id, emoji, user_id, message_id')
            .in('message_id', messageIds);
        if (activeChannelIdRef.current !== conversationId) return;
        if (error) {
            // Clear state on failure so stale chips don't linger from
            // a previous successful fetch (Codex review f5ac19f).
            console.warn('[ChatView] batch reactions fetch failed:', error);
            setReactionsByMsg({});
            return;
        }
        const grouped = {};
        (data || []).forEach(r => {
            if (!grouped[r.message_id]) grouped[r.message_id] = [];
            grouped[r.message_id].push({ id: r.id, emoji: r.emoji, user_id: r.user_id });
        });
        setReactionsByMsg(grouped);
    };

    const fetchMessages = async (conversationId) => {
        try {
            const { data, error } = await supabase
                .from('messages')
                .select('*')
                .eq('conversation_id', conversationId)
                .order('created_at', { ascending: true })
                .limit(100);

            if (error) {
                console.error('Error fetching messages:', error);
                throw error;
            }
            // Drop stale responses: if the user has switched channels (or
            // closed chat) before this resolved, don't overwrite the new
            // channel's state. This was the source of the "only my message"
            // flash — realtime would prepend the just-sent row, then a
            // late fetch of the previous channel would wipe it.
            if (activeChannelIdRef.current !== conversationId) return;
            // Batch-fetch reactions for all visible messages in one
            // query. Fires in parallel with the merge below; doesn't
            // block message render.
            fetchReactionsForMessages(conversationId, (data || []).map(m => m.id));
            // Merge with any rows already present (e.g. an optimistic
            // append from handleSend or a realtime INSERT that landed
            // first) so we don't clobber the just-sent message.
            const incoming = data || [];
            setMessages(prev => {
                if (prev.length === 0) return incoming;
                const seen = new Set(incoming.map(m => m.id));
                const extras = prev.filter(m => !seen.has(m.id));
                if (extras.length === 0) return incoming;
                return [...incoming, ...extras].sort((a, b) =>
                    new Date(a.created_at) - new Date(b.created_at)
                );
            });
        } catch (err) {
            console.error('Error fetching messages:', err);
            if (activeChannelIdRef.current !== conversationId) return;
            setMessages([]);
        }
    };

    const fetchMemberCount = async (conversationId) => {
        try {
            const { count, error } = await supabase
                .from('conversation_members')
                .select('*', { count: 'exact', head: true })
                .eq('conversation_id', conversationId);

            if (!error && count !== null) {
                setMemberCount(count);
            }
        } catch (err) {
            setMemberCount(0);
        }
    };

    const subscribeToMessages = (conversationId) => {
        if (channelSubscription.current) {
            supabase.removeChannel(channelSubscription.current);
        }

        setConnectionStatus('connecting');
        channelSubscription.current = supabase
            .channel(`messages:${conversationId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `conversation_id=eq.${conversationId}`
                },
                (payload) => {
                    // Ignore events for a channel the user has already left.
                    if (activeChannelIdRef.current !== conversationId) return;
                    setMessages(prev => {
                        if (prev.some(m => m.id === payload.new.id)) return prev;
                        return [...prev, payload.new];
                    });
                }
            )
            .subscribe((status) => {
                if (activeChannelIdRef.current !== conversationId) return;
                if (status === 'SUBSCRIBED')          setConnectionStatus('live');
                else if (status === 'CHANNEL_ERROR')   setConnectionStatus('reconnecting');
                else if (status === 'TIMED_OUT')       setConnectionStatus('reconnecting');
                else if (status === 'CLOSED')          setConnectionStatus('offline');
            });
    };

    const handleSend = async () => {
        if (!newMessage.trim() || !activeChannel) return;

        const isPlayer = currentUserRole === 'player';
        if (isPlayer && activeChannel.type !== 'player_dm') {
            setChatError('Players can only send messages in player DMs.');
            setTimeout(() => setChatError(null), 4000);
            return;
        }

        setSending(true);

        // Client-generated id so we can synthesize the local row without
        // an .insert().select() round trip. The previous .select() forced
        // PostgREST to re-evaluate the messages SELECT policy on the new
        // row, which for parent users walks family_members. With the DB
        // pool hot, that came back as a spurious "may not have permission"
        // on the first send. Providing the id ourselves lets the realtime
        // INSERT echo dedupe by id when it arrives.
        const clientMessageId =
            (typeof crypto !== 'undefined' && crypto.randomUUID)
                ? crypto.randomUUID()
                : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const messageData = {
            id: clientMessageId,
            conversation_id: activeChannel.id,
            sender_id: user?.id || null,
            sender_name: currentUserName,
            sender_role: currentUserRole,
            content: newMessage.trim(),
            message_type: isUrgent ? 'announcement' : 'text',
            is_urgent: isUrgent
        };

        // _pending is a client-only marker so MessageRow can style the
        // bubble as in-flight until the server confirms. The realtime
        // INSERT echo arrives with the same id (we provide it) but
        // without _pending, so the dedupe-by-id replaces the optimistic
        // row with the canonical row automatically.
        const optimisticRow = {
            ...messageData,
            created_at: new Date().toISOString(),
            _pending: true,
        };
        const sendChannelId = activeChannel.id;
        if (activeChannelIdRef.current === sendChannelId) {
            setMessages(prev => {
                if (prev.some(m => m.id === optimisticRow.id)) return prev;
                return [...prev, optimisticRow];
            });
        }
        // Clear the input immediately so the user can keep typing while
        // the server round-trip is in flight.
        setNewMessage('');
        setIsUrgent(false);

        try {
            const { error } = await supabase
                .from('messages')
                .insert([messageData]);

            if (error) {
                console.error('Send error:', error);
                throw error;
            }
            // On success, clear the _pending flag on the optimistic
            // row if the realtime echo hasn't replaced it yet. Only
            // applies if the user hasn't switched channels.
            if (activeChannelIdRef.current === sendChannelId) {
                setMessages(prev => prev.map(m =>
                    m.id === clientMessageId && m._pending
                        ? { ...m, _pending: false }
                        : m
                ));
            }
        } catch (err) {
            // Roll the optimistic row back only if we're still on the
            // channel we sent from. Codex flagged a sloppy edge case
            // here: if the user switched channels mid-send and the
            // insert failed, the previous rollback ran against the
            // wrong channel's state. UUID collision is unlikely but
            // the guard is correct.
            if (activeChannelIdRef.current === sendChannelId) {
                setMessages(prev => prev.filter(m => m.id !== clientMessageId));
            }
            console.error('Error sending message:', err);
            setChatError('Failed to send message. You may not have permission to post here.');
            setTimeout(() => setChatError(null), 4000);
        } finally {
            setSending(false);
        }
    };

    // Attach + send a picture. Uploads to the shared `media` bucket under the
    // team-<id> prefix (already permitted by the media_team_gallery_insert
    // storage policy for any team member), then sends a message_type='image'
    // message whose content is the public URL — the bubble renderer already
    // handles image messages. Scoped to non-players (they have token sessions
    // without an auth.uid(), so direct storage uploads would fail RLS).
    const handleSendImage = async (file) => {
        if (!file || !activeChannel) return;
        if (currentUserRole === 'player') return;
        if (!file.type.startsWith('image/')) {
            setChatError('Only image files can be attached.');
            setTimeout(() => setChatError(null), 4000);
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            setChatError('Image too large — max 10MB.');
            setTimeout(() => setChatError(null), 4000);
            return;
        }
        if (!currentTeamId) {
            setChatError("Couldn't attach the image — your team isn't loaded yet. Try again in a moment.");
            setTimeout(() => setChatError(null), 4000);
            return;
        }

        const sendChannelId = activeChannel.id;
        const clientMessageId =
            (typeof crypto !== 'undefined' && crypto.randomUUID)
                ? crypto.randomUUID()
                : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

        setImageUploading(true);
        try {
            const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
            const path = `team-${currentTeamId}/chat-${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
            const { error: uploadErr } = await supabase.storage
                .from('media')
                .upload(path, file, { contentType: file.type || undefined, cacheControl: '3600' });
            if (uploadErr) throw uploadErr;

            const { data: urlData } = supabase.storage.from('media').getPublicUrl(path);
            const publicUrl = urlData?.publicUrl;
            if (!publicUrl) throw new Error('Could not resolve the uploaded image URL.');

            const messageData = {
                id: clientMessageId,
                conversation_id: sendChannelId,
                sender_id: user?.id || null,
                sender_name: currentUserName,
                sender_role: currentUserRole,
                content: publicUrl,
                message_type: 'image',
                is_urgent: false,
            };

            if (activeChannelIdRef.current === sendChannelId) {
                setMessages(prev => prev.some(m => m.id === clientMessageId)
                    ? prev
                    : [...prev, { ...messageData, created_at: new Date().toISOString(), _pending: true }]);
            }

            const { error } = await supabase.from('messages').insert([messageData]);
            if (error) throw error;

            if (activeChannelIdRef.current === sendChannelId) {
                setMessages(prev => prev.map(m =>
                    m.id === clientMessageId && m._pending ? { ...m, _pending: false } : m));
            }
        } catch (err) {
            if (activeChannelIdRef.current === sendChannelId) {
                setMessages(prev => prev.filter(m => m.id !== clientMessageId));
            }
            console.error('Error sending image:', err);
            setChatError('Failed to send image. You may not have permission to post here.');
            setTimeout(() => setChatError(null), 4000);
        } finally {
            setImageUploading(false);
            if (imageInputRef.current) imageInputRef.current.value = '';
        }
    };

    const fetchTeamMembers = async () => {
        // Use the active channel's team_id, or first available channel's team_id
        const teamId = activeChannel?.team_id || channels[0]?.team_id || currentTeamId;
        if (!teamId) return;

        try {
            const { data, error } = await supabase
                .from('team_memberships')
                .select('user_id, role')
                .eq('team_id', teamId);

            if (!error && data) {
                // Get profiles for these users
                const userIds = data.map(m => m.user_id).filter(id => id !== user.id);
                if (userIds.length > 0) {
                    const { data: profiles } = await supabase
                        .from('profiles')
                        .select('id, full_name, email')
                        .in('id', userIds);

                    const merged = data
                        .filter(m => m.user_id !== user.id)
                        .map(m => {
                            const p = profiles?.find(p => p.id === m.user_id);
                            return {
                                user_id: m.user_id,
                                role: m.role,
                                name: p?.full_name || p?.email || 'Unknown'
                            };
                        });
                    setTeamMembers(merged);
                }
            }
        } catch (err) {
            console.error('Error fetching team members:', err);
        }
    };

    const createStaffDM = async (otherUserId, otherName) => {
        const teamId = activeChannel?.team_id || channels[0]?.team_id || currentTeamId;
        try {
            const { data: convo, error: convoErr } = await supabase
                .from('conversations')
                .insert([{
                    team_id: teamId,
                    type: 'staff_dm',
                    name: `${currentUserName} & ${otherName}`,
                    created_by: user.id
                }])
                .select()
                .single();

            if (convoErr) throw convoErr;

            // Add both users as members
            await supabase.from('conversation_members').insert([
                { conversation_id: convo.id, user_id: user.id, role: 'admin' },
                { conversation_id: convo.id, user_id: otherUserId, role: 'member' }
            ]);

            setShowNewDM(false);
            await fetchChannels();
            setActiveChannel(convo);
        } catch (err) {
            console.error('Error creating DM:', err);
            toast.error("Couldn't start the conversation. Try again.");
        }
    };

    const getChannelIcon = (type) => {
        switch (type) {
            case 'team': return <Hash className="w-4 h-4 text-brand-green" />;
            case 'player_dm': return <MessageSquare className="w-4 h-4 text-blue-400" />;
            case 'staff_dm': return <Lock className="w-4 h-4 text-purple-400" />;
            default: return <Hash className="w-4 h-4" />;
        }
    };

    const formatTime = (timestamp) => {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        const now = new Date();
        const isToday = date.toDateString() === now.toDateString();

        if (isToday) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' +
               date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const isOwnMessage = (msg) => {
        return msg.sender_id === user?.id;
    };

    const getRoleBadgeStyle = (role) => {
        switch (role) {
            case 'coach': return 'bg-brand-gold/20 text-brand-gold';
            case 'manager': return 'bg-purple-500/20 text-purple-400';
            case 'parent': return 'bg-blue-500/20 text-blue-400';
            case 'player': return 'bg-green-500/20 text-green-400';
            default: return 'bg-gray-500/20 text-gray-400';
        }
    };

    const getAvatarStyle = (role) => {
        switch (role) {
            case 'coach':
            case 'manager': return 'bg-brand-gold text-brand-dark';
            case 'parent': return 'bg-blue-600 text-white';
            default: return 'bg-gray-700 text-gray-300';
        }
    };

    // No full-screen takeover during initial load — the sidebar already
    // shows its own inline "Loading conversations…" state, and the main
    // panel shows "Select a channel" until activeChannel is populated.
    // Returning a full-screen loader here caused the chat to blank the
    // entire UI every time the tab was opened.

    return (
        <div className="h-[calc(100vh-140px)] flex gap-0 md:gap-6 animate-fade-in-up relative">
            {/* Mobile Menu Button */}
            <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="md:hidden absolute top-3 left-3 z-30 p-2 bg-white/10 rounded-lg text-white hover:bg-white/20"
            >
                {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            {/* Sidebar / Channel List. Mobile: a drawer ABOVE the app header
                (z-50) and bottom nav (z-80) so its top option isn't hidden;
                top padding clears the status bar. Desktop: a normal column. */}
            <div className={`
                fixed md:relative inset-y-0 left-0 z-[100] md:z-auto
                w-72 md:w-64 glass-panel p-4 flex flex-col rounded-none md:rounded-2xl
                pt-[max(1rem,calc(env(safe-area-inset-top)+0.5rem))] md:pt-4
                transform transition-transform duration-200 ease-in-out
                ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
                h-full
            `}>
                <div className="flex items-center justify-between mb-3 px-2">
                    <h3 className="text-gray-400 text-xs font-bold uppercase tracking-widest">Chats</h3>
                    <button onClick={() => setSidebarOpen(false)} className="md:hidden p-1 text-gray-400 hover:text-white" title="Close">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* DM anyone on the team — opens a searchable contact list. */}
                {currentUserRole !== 'player' && (
                    <button
                        onClick={() => setShowNewDM(true)}
                        className="w-full mb-3 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-brand-green/15 border border-brand-green/40 text-brand-green text-sm font-bold uppercase tracking-wider hover:bg-brand-green/25"
                    >
                        <Plus className="w-4 h-4" /> New message
                    </button>
                )}

                <div className="space-y-1 flex-1 min-h-0 overflow-y-auto overscroll-contain">
                    {loading ? (
                        <div className="text-center py-8 px-2">
                            <Loader2 className="w-6 h-6 text-gray-500 mx-auto mb-2 animate-spin" />
                            <p className="text-gray-500 text-xs">Loading conversations…</p>
                        </div>
                    ) : chatError ? (
                        <div className="text-center py-8 px-2">
                            <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                            <p className="text-red-300 text-xs mb-1">Couldn't load conversations.</p>
                            <p className="text-gray-500 text-xs mb-3">Check your connection.</p>
                            <button
                                onClick={fetchChannels}
                                className="px-3 py-1.5 bg-red-500/20 border border-red-500/40 rounded text-xs text-red-200 hover:bg-red-500/30"
                            >
                                Retry
                            </button>
                        </div>
                    ) : channels.length === 0 ? (
                        <div className="text-center py-8 px-2">
                            <MessageSquare className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                            <p className="text-gray-500 text-xs">No conversations yet.</p>
                            <p className="text-gray-600 text-xs mt-1">If you just joined the team, refresh this page in a few seconds — your team chat is auto-created when you're added to the roster.</p>
                        </div>
                    ) : (
                        channels.map(channel => {
                            const unread = unreadByConv[channel.id] || 0;
                            const isActive = activeChannel?.id === channel.id;
                            return (
                                <button
                                    key={channel.id}
                                    onClick={() => setActiveChannel(channel)}
                                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${isActive ? 'bg-white/10 text-brand-golden border border-white/5' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
                                >
                                    {getChannelIcon(channel.type)}
                                    <span className={`truncate flex-1 text-left ${unread > 0 && !isActive ? 'font-bold text-white' : ''}`}>{channel.name}</span>
                                    {unread > 0 && !isActive && (
                                        <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-brand-green text-brand-dark text-[10px] font-bold">
                                            {unread > 99 ? '99+' : unread}
                                        </span>
                                    )}
                                </button>
                            );
                        })
                    )}
                </div>

                {/* New Conversation Modal — DM or Group. Uses the
                    create_conversation RPC (atomic) and the
                    get_messageable_users RPC for the picker. */}
                {/* Online Status */}
                <div className="mt-auto pt-4 border-t border-white/10">
                    <div className="flex items-center gap-2 px-2 text-xs text-gray-500">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <span>You are online as <span className="text-brand-green">{currentUserName}</span></span>
                    </div>
                </div>
            </div>

            {/* Overlay for mobile sidebar — just below the drawer (z-100). */}
            {sidebarOpen && (
                <div className="fixed inset-0 bg-black/50 z-[99] md:hidden" onClick={() => setSidebarOpen(false)} />
            )}

            {/* Main Chat Area */}
            <div className="flex-1 glass-panel flex flex-col rounded-2xl overflow-hidden relative">
                {/* Header */}
                <div className="bg-black/20 p-4 border-b border-white/5 flex justify-between items-center">
                    <div className="flex items-center gap-2 text-white font-bold uppercase tracking-wide">
                        <span className="md:hidden w-8" /> {/* spacer for mobile menu button */}
                        {activeChannel && getChannelIcon(activeChannel.type)}
                        {activeChannel?.name || 'Select a channel'}
                    </div>
                    {activeChannel && (
                        <div className="flex items-center gap-3 text-xs text-gray-400">
                            {/* Connection status — gives families a clear
                                signal whether what they're seeing is live or
                                stale, instead of guessing. */}
                            <span
                                className={`flex items-center gap-1.5 font-medium ${
                                    connectionStatus === 'live'         ? 'text-brand-green' :
                                    connectionStatus === 'connecting'   ? 'text-gray-400'    :
                                    connectionStatus === 'reconnecting' ? 'text-yellow-400'  :
                                    connectionStatus === 'offline'      ? 'text-red-400'     : 'text-gray-500'
                                }`}
                                title={`Realtime ${connectionStatus}`}
                            >
                                <span
                                    className={`inline-block w-2 h-2 rounded-full ${
                                        connectionStatus === 'live'         ? 'bg-brand-green animate-pulse' :
                                        connectionStatus === 'connecting'   ? 'bg-gray-400 animate-pulse'    :
                                        connectionStatus === 'reconnecting' ? 'bg-yellow-400 animate-pulse'  :
                                        connectionStatus === 'offline'      ? 'bg-red-400'                   : 'bg-gray-600'
                                    }`}
                                />
                                <span className="hidden sm:inline">
                                    {connectionStatus === 'live'         ? 'Live' :
                                     connectionStatus === 'connecting'   ? 'Connecting…' :
                                     connectionStatus === 'reconnecting' ? 'Reconnecting…' :
                                     connectionStatus === 'offline'      ? 'Offline' : ''}
                                </span>
                            </span>
                            <span className="flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                {memberCount} member{memberCount !== 1 ? 's' : ''}
                            </span>
                        </div>
                    )}
                </div>

                {/* Messages Feed */}
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 md:space-y-6">
                    {loading && !activeChannel ? (
                        <div className="text-center text-gray-500 mt-20">
                            <Loader2 className="w-8 h-8 animate-spin text-brand-green mx-auto mb-2" />
                            <p className="text-xs">Loading chat…</p>
                        </div>
                    ) : !activeChannel ? (
                        <div className="text-center text-gray-500 mt-20">
                            <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-20" />
                            <p>No channel selected.</p>
                            <p className="text-xs mt-1">Pick a channel from the sidebar to start chatting.</p>
                        </div>
                    ) : messages.length === 0 ? (
                        <div className="text-center text-gray-500 mt-20">
                            <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-20" />
                            <p>No messages yet in this channel.</p>
                            <p className="text-xs mt-1">Be the first to say something!</p>
                        </div>
                    ) : (
                        messages.map(msg => (
                            <MessageRow
                                key={msg.id}
                                msg={msg}
                                own={isOwnMessage(msg)}
                                getAvatarStyle={getAvatarStyle}
                                getRoleBadgeStyle={getRoleBadgeStyle}
                                formatTime={formatTime}
                                pickerOpen={reactionPickerFor === msg.id}
                                onOpenPicker={() => setReactionPickerFor(msg.id)}
                                onClosePicker={() => setReactionPickerFor(null)}
                                reactionRows={reactionsByMsg[msg.id] || []}
                            />
                        ))
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Error Banner */}
                {chatError && (
                    <div className="mx-4 mt-2 p-2 bg-red-500/20 border border-red-500/40 rounded-lg text-red-300 text-xs flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        {chatError}
                    </div>
                )}

                {/* Input Area */}
                {activeChannel && (
                    <div className="p-3 md:p-4 bg-black/40 border-t border-white/5">
                        <div className="flex flex-col gap-2">
                            {/* Toolbar */}
                            <div className="flex items-center gap-4 px-2">
                                <label className={`flex items-center gap-2 text-xs font-bold cursor-pointer transition-colors ${isUrgent ? 'text-red-500' : 'text-gray-500 hover:text-white'}`}>
                                    <input
                                        type="checkbox"
                                        checked={isUrgent}
                                        onChange={(e) => setIsUrgent(e.target.checked)}
                                        className="w-4 h-4 rounded border-gray-600 bg-transparent focus:ring-red-500 text-red-600"
                                    />
                                    <AlertCircle className="w-4 h-4" />
                                    <span className="hidden sm:inline">MARK URGENT</span>
                                </label>
                                {(currentUserRole === 'coach' || currentUserRole === 'manager') && (
                                    <span className="text-xs text-gray-600 hidden md:inline">Staff messages are highlighted</span>
                                )}
                            </div>

                            {/* Quick emoji row — tap to append. Mobile keyboards
                                already expose the full emoji picker; this is just
                                the most-used team-friendly shortcuts. */}
                            <div className="flex gap-1 overflow-x-auto no-scrollbar -mx-1 px-1 mb-2 pb-1">
                                {['👍', '🔥', '⚽', '👏', '🙌', '😂', '❤️', '🎉', '🤝', '👀', '💪', '✅', '🥳', '🙏'].map(e => (
                                    <button
                                        key={e}
                                        type="button"
                                        onClick={() => setNewMessage(m => m + e)}
                                        className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg bg-white/[0.04] border border-white/10 hover:bg-white/10 transition-colors text-lg leading-none"
                                        aria-label={`Insert ${e}`}
                                    >
                                        {e}
                                    </button>
                                ))}
                            </div>

                            {/* Text Box */}
                            <div className="flex gap-2">
                                {currentUserRole !== 'player' && (
                                    <>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            ref={imageInputRef}
                                            className="hidden"
                                            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleSendImage(f); }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => imageInputRef.current?.click()}
                                            disabled={sending || imageUploading}
                                            title="Attach a picture"
                                            aria-label="Attach a picture"
                                            className="shrink-0 bg-white/5 border border-white/10 rounded-xl px-3 text-gray-300 hover:bg-white/10 hover:text-white transition-colors flex items-center justify-center disabled:opacity-50"
                                        >
                                            {imageUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImageIcon className="w-5 h-5" />}
                                        </button>
                                    </>
                                )}
                                <input
                                    type="text"
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                                    placeholder={`Message ${activeChannel?.name || 'channel'}...`}
                                    disabled={sending || imageUploading}
                                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-green/50 placeholder:text-gray-600 font-sans disabled:opacity-50"
                                />
                                <button
                                    onClick={handleSend}
                                    disabled={sending || !newMessage.trim()}
                                    className="bg-brand-green text-brand-dark rounded-xl px-4 md:px-6 font-bold uppercase hover:bg-white hover:scale-105 transition-all flex items-center gap-2 disabled:opacity-50 disabled:hover:scale-100"
                                >
                                    {sending ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <Send className="w-5 h-5" />
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* New conversation / DM contact picker — rendered at the ChatView
                root so it is NOT trapped inside the sidebar's glass-panel
                (backdrop-filter breaks a fixed modal's positioning). */}
            {showNewDM && (
                <NewConversationModal
                    onClose={() => setShowNewDM(false)}
                    onCreated={async (newConvoId) => {
                        await fetchChannels();
                        const { data: conv } = await supabase
                            .from('conversations')
                            .select('id, team_id, type, name, created_at')
                            .eq('id', newConvoId)
                            .maybeSingle();
                        if (conv) setActiveChannel(conv);
                        setSidebarOpen(false);
                    }}
                />
            )}
        </div>
    );
};

// ---------------------------------------------------------------------
// MessageRow — extracted because useLongPress is a hook (can't be called
// inside the messages.map). Owns the bubble + reactions area, accepts
// the picker open/close state from the parent.
// ---------------------------------------------------------------------
const MessageRow = ({
    msg,
    own,
    getAvatarStyle,
    getRoleBadgeStyle,
    formatTime,
    pickerOpen,
    onOpenPicker,
    onClosePicker,
    reactionRows,
}) => {
    const longPress = useLongPress(() => onOpenPicker());

    const pending = !!msg._pending;
    return (
        <div className={`flex gap-3 md:gap-4 ${own ? 'flex-row-reverse' : ''} ${pending ? 'opacity-70' : ''}`}>
            <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-xs md:text-sm ${getAvatarStyle(msg.sender_role)}`}>
                {msg.sender_name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div className={`max-w-[85%] md:max-w-[70%] ${own ? 'items-end' : 'items-start'} flex flex-col`}>
                <div className={`flex items-center gap-2 mb-1 ${own ? 'flex-row-reverse' : ''}`}>
                    <span className="text-sm font-bold text-white">{msg.sender_name || 'Unknown'}</span>
                    {pending && (
                        <span className="text-[10px] uppercase tracking-wider text-gray-500" title="Waiting for server confirmation">
                            sending…
                        </span>
                    )}
                    {msg.sender_role && (
                        <span className={`text-xs px-1.5 py-0.5 rounded uppercase font-bold ${getRoleBadgeStyle(msg.sender_role)}`}>
                            {msg.sender_role}
                        </span>
                    )}
                    <span className="text-xs text-gray-500">{formatTime(msg.created_at)}</span>
                </div>
                <div
                    {...longPress}
                    onContextMenu={(e) => { e.preventDefault(); onOpenPicker(); }}
                    className={`p-3 rounded-2xl text-sm leading-relaxed select-none cursor-pointer ${
                        msg.is_urgent
                            ? 'bg-red-500/20 border border-red-500 text-red-100 shadow-[0_0_15px_rgba(239,68,68,0.2)]'
                            : msg.message_type === 'announcement'
                                ? 'bg-yellow-500/10 border border-yellow-500/30 text-yellow-100'
                                : own
                                    ? 'bg-brand-green/20 border border-brand-green/30 text-white rounded-tr-none'
                                    : 'bg-white/5 border border-white/10 text-gray-300 rounded-tl-none'
                    }`}
                    title="Press and hold to react"
                >
                    {msg.is_urgent && (
                        <div className="flex items-center gap-1 text-red-400 font-bold text-xs uppercase mb-1">
                            <AlertCircle className="w-3 h-3" /> Urgent Alert
                        </div>
                    )}
                    {msg.message_type === 'announcement' && !msg.is_urgent && (
                        <div className="flex items-center gap-1 text-yellow-400 font-bold text-xs uppercase mb-1">
                            <Megaphone className="w-3 h-3" /> Announcement
                        </div>
                    )}
                    {msg.message_type === 'image' && msg.content?.startsWith('http')
                        ? (
                            <a
                                href={msg.content}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <img
                                    src={msg.content}
                                    alt="shared image"
                                    className="rounded-lg max-w-full max-h-72 h-auto object-cover"
                                    loading="lazy"
                                />
                            </a>
                        )
                        : msg.content}
                </div>
                {/* Reactions — chips when collapsed (only emojis with count>0
                    render), full picker when pickerOpen. Mirrors bubble side. */}
                <div className="mt-1.5">
                    <ReactionBar
                        tableName="message_reactions"
                        columnName="message_id"
                        targetId={msg.id}
                        compact
                        align={own ? 'right' : 'left'}
                        pickerOpen={pickerOpen}
                        onClosePicker={onClosePicker}
                        initialRows={reactionRows}
                    />
                </div>
            </div>
        </div>
    );
};

export default ChatView;
