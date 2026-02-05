import React, { useState, useEffect } from 'react';
import { X, Bell, Sparkles, CheckCircle, Clock, Trash2 } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';

const NotificationPanel = ({ onClose, onAutoGenerate }) => {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchNotifications();
    }, [user]);

    const fetchNotifications = async () => {
        if (!user?.id) return;

        setLoading(true);
        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) {
            console.error('Error fetching notifications:', error);
        } else {
            setNotifications(data || []);
        }
        setLoading(false);
    };

    const markAsRead = async (notificationId) => {
        const { error } = await supabase
            .from('notifications')
            .update({ read: true })
            .eq('id', notificationId);

        if (error) {
            console.error('Error marking notification as read:', error);
            return; // Don't update UI if operation failed
        }

        setNotifications(prev =>
            prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
        );
    };

    const deleteNotification = async (notificationId) => {
        const { error } = await supabase
            .from('notifications')
            .delete()
            .eq('id', notificationId);

        if (error) {
            console.error('Error deleting notification:', error);
            return; // Don't update UI if deletion failed
        }

        setNotifications(prev => prev.filter(n => n.id !== notificationId));
    };

    const handleAction = (notification) => {
        if (notification.action_type === 'auto_generate') {
            // Close panel and trigger auto-generate in parent
            markAsRead(notification.id);
            onAutoGenerate?.(notification.action_data);
            onClose();
        } else if (notification.action_type === 'view_assignments') {
            markAsRead(notification.id);
            // Navigate to training view - parent handles this
            onClose();
        }
    };

    const getNotificationIcon = (type) => {
        switch (type) {
            case 'assignment_reminder':
                return <Clock className="w-5 h-5 text-brand-gold" />;
            case 'auto_assigned':
                return <CheckCircle className="w-5 h-5 text-brand-green" />;
            default:
                return <Bell className="w-5 h-5 text-gray-400" />;
        }
    };

    const formatTime = (dateStr) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now - date;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}d ago`;
        if (hours > 0) return `${hours}h ago`;
        return 'Just now';
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-start justify-end p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div
                className="bg-brand-dark border border-white/10 w-full max-w-md rounded-xl shadow-2xl mt-16 mr-4 overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="bg-gradient-to-r from-brand-dark to-gray-900 p-4 border-b border-white/10 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <Bell className="w-5 h-5 text-brand-green" />
                        <h2 className="text-lg text-white font-display uppercase font-bold tracking-wider">
                            Notifications
                        </h2>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Notification List */}
                <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
                    {loading ? (
                        <div className="p-8 text-center text-gray-500">
                            <div className="w-6 h-6 border-2 border-brand-green border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                            Loading...
                        </div>
                    ) : notifications.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                            <Bell className="w-12 h-12 mx-auto mb-3 opacity-20" />
                            <p>No notifications yet</p>
                            <p className="text-xs mt-1">You'll see reminders and updates here</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-white/5">
                            {notifications.map(notification => (
                                <div
                                    key={notification.id}
                                    className={`p-4 hover:bg-white/5 transition-colors ${!notification.read ? 'bg-brand-green/5 border-l-2 border-brand-green' : ''}`}
                                >
                                    <div className="flex gap-3">
                                        <div className="flex-shrink-0 mt-1">
                                            {getNotificationIcon(notification.type)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2">
                                                <h4 className={`font-bold text-sm ${!notification.read ? 'text-white' : 'text-gray-300'}`}>
                                                    {notification.title}
                                                </h4>
                                                <span className="text-xs text-gray-500 flex-shrink-0">
                                                    {formatTime(notification.created_at)}
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-400 mt-1">
                                                {notification.message}
                                            </p>

                                            {/* Action Buttons */}
                                            <div className="flex items-center gap-2 mt-3">
                                                {notification.action_type === 'auto_generate' && (
                                                    <button
                                                        onClick={() => handleAction(notification)}
                                                        className="flex items-center gap-1.5 text-xs font-bold uppercase text-brand-gold bg-brand-gold/10 px-3 py-1.5 rounded border border-brand-gold/20 hover:bg-brand-gold/20 transition-colors"
                                                    >
                                                        <Sparkles className="w-3 h-3" />
                                                        Auto-Generate
                                                    </button>
                                                )}
                                                {notification.action_type === 'view_assignments' && (
                                                    <button
                                                        onClick={() => handleAction(notification)}
                                                        className="text-xs font-bold uppercase text-brand-green hover:underline"
                                                    >
                                                        View Assignments
                                                    </button>
                                                )}
                                                {!notification.read && (
                                                    <button
                                                        onClick={() => markAsRead(notification.id)}
                                                        className="text-xs text-gray-500 hover:text-white"
                                                    >
                                                        Mark read
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => deleteNotification(notification.id)}
                                                    className="text-gray-500 hover:text-red-400 ml-auto"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {notifications.length > 0 && (
                    <div className="p-3 border-t border-white/10 bg-black/20">
                        <button
                            onClick={async () => {
                                const { error } = await supabase
                                    .from('notifications')
                                    .update({ read: true })
                                    .eq('user_id', user?.id);

                                if (error) {
                                    console.error('Error marking all as read:', error);
                                    return;
                                }
                                setNotifications(prev => prev.map(n => ({ ...n, read: true })));
                            }}
                            className="text-xs text-gray-400 hover:text-white uppercase tracking-wider"
                        >
                            Mark all as read
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default NotificationPanel;
