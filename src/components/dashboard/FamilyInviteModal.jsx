import React, { useState, useEffect } from 'react';
import { X, Shield, Heart, Copy, Check, Trash2, Plus, Users } from 'lucide-react';
import { supabase } from '../../supabaseClient';

const FamilyInviteModal = ({ player, onClose }) => {
    const [invites, setInvites] = useState([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [copiedCode, setCopiedCode] = useState(null);

    // Helpers to generate a random 6-character code
    const generateCode = () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I, 1, O, 0 for clarity
        let result = '';
        for (let i = 0; i < 6; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    };

    const fetchInvites = async () => {
        try {
            const { data, error } = await supabase
                .from('family_invites')
                .select('*')
                .eq('player_id', player.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setInvites(data || []);
        } catch (err) {
            console.error('Error fetching invites:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (player) fetchInvites();
    }, [player]);

    const handleCreateInvite = async (role) => {
        setGenerating(true);
        const code = generateCode();

        try {
            const { data, error } = await supabase
                .from('family_invites')
                .insert([
                    {
                        player_id: player.id,
                        role: role,
                        code: code,
                        created_by: (await supabase.auth.getUser()).data.user.id
                    }
                ])
                .select()
                .single();

            if (error) throw error;

            setInvites([data, ...invites]);
        } catch (err) {
            console.error('Error creating invite:', err);
            alert('Failed to generate invite.');
        } finally {
            setGenerating(false);
        }
    };

    const handleDeleteInvite = async (id) => {
        if (!confirm('Are you sure you want to delete this invite? The code will no longer work.')) return;

        try {
            const { error } = await supabase
                .from('family_invites')
                .delete()
                .eq('id', id);

            if (error) throw error;
            setInvites(invites.filter(inv => inv.id !== id));
        } catch (err) {
            console.error('Error deleting invite:', err);
        }
    };

    const copyToClipboard = (code) => {
        navigator.clipboard.writeText(code);
        setCopiedCode(code);
        setTimeout(() => setCopiedCode(null), 2000);
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-brand-dark border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl relative">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
                >
                    <X className="w-6 h-6" />
                </button>

                <div className="p-8">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-16 h-16 rounded-full bg-gray-700 overflow-hidden border-2 border-brand-gold">
                            <img
                                src={player.avatar || `https://ui-avatars.com/api/?name=${player.name}&background=random`}
                                alt={player.name}
                                className="w-full h-full object-cover"
                            />
                        </div>
                        <div>
                            <h2 className="text-2xl font-display font-bold text-white uppercase tracking-wider">
                                {player.name}
                            </h2>
                            <p className="text-brand-green font-bold text-sm uppercase tracking-widest">
                                #{player.number} • Manage Access
                            </p>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="grid grid-cols-2 gap-4 mb-8">
                        <button
                            onClick={() => handleCreateInvite('guardian')}
                            disabled={generating}
                            className="flex flex-col items-center justify-center p-4 bg-brand-green/10 border border-brand-green/30 rounded-xl hover:bg-brand-green/20 transition-all group"
                        >
                            <Shield className="w-8 h-8 text-brand-green mb-2 group-hover:scale-110 transition-transform" />
                            <span className="text-white font-bold uppercase text-xs tracking-wider">Invite Guardian</span>
                            <span className="text-gray-400 text-[10px] mt-1">Full Access</span>
                        </button>

                        <button
                            onClick={() => handleCreateInvite('fan')}
                            disabled={generating}
                            className="flex flex-col items-center justify-center p-4 bg-purple-500/10 border border-purple-500/30 rounded-xl hover:bg-purple-500/20 transition-all group"
                        >
                            <Heart className="w-8 h-8 text-purple-400 mb-2 group-hover:scale-110 transition-transform" />
                            <span className="text-white font-bold uppercase text-xs tracking-wider">Invite Fan</span>
                            <span className="text-gray-400 text-[10px] mt-1">Read Only</span>
                        </button>
                    </div>

                    {/* Invite List */}
                    <h3 className="text-brand-gold text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-2">
                        <Users className="w-4 h-4" /> Active Invites
                    </h3>

                    {loading ? (
                        <div className="text-center py-4 text-gray-500">Loading invites...</div>
                    ) : invites.length === 0 ? (
                        <div className="text-center py-6 border border-dashed border-white/10 rounded-xl bg-black/20">
                            <p className="text-gray-500 text-sm">No active invites for this player.</p>
                        </div>
                    ) : (
                        <div className="space-y-3 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                            {invites.map((invite) => (
                                <div key={invite.id} className="bg-white/5 border border-white/10 rounded-lg p-3 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${invite.role === 'guardian' ? 'bg-brand-green/20 text-brand-green' : 'bg-purple-500/20 text-purple-400'}`}>
                                            {invite.role === 'guardian' ? <Shield className="w-4 h-4" /> : <Heart className="w-4 h-4" />}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xl font-mono font-bold text-white tracking-widest">
                                                    {invite.code}
                                                </span>
                                            </div>
                                            <p className="text-[10px] text-gray-400 uppercase tracking-wider">
                                                {invite.role} • Expires in 48h
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => copyToClipboard(invite.code)}
                                            className="p-2 hover:bg-white/10 rounded-full transition-colors text-white"
                                            title="Copy Code"
                                        >
                                            {copiedCode === invite.code ? <Check className="w-4 h-4 text-brand-green" /> : <Copy className="w-4 h-4" />}
                                        </button>
                                        <button
                                            onClick={() => handleDeleteInvite(invite.id)}
                                            className="p-2 hover:bg-red-500/20 rounded-full transition-colors text-gray-500 hover:text-red-500"
                                            title="Delete Invite"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default FamilyInviteModal;
