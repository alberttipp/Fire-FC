import React, { useMemo } from 'react';
import { Award, BookOpen, CheckCircle, Clock, Footprints, Target, Trophy } from 'lucide-react';

const PASSPORT_SECTIONS = [
    { label: 'Ball Mastery', match: ['ball', 'dribbling', 'technical', 'touch'] },
    { label: 'First Touch', match: ['first touch', 'receiving'] },
    { label: 'Passing', match: ['passing', 'pass'] },
    { label: 'Finishing', match: ['finishing', 'shooting', 'finish', 'shot'] },
    { label: 'Defending', match: ['defending', 'defense', 'pressing', 'marking'] },
    { label: 'Consistency', match: ['streak', 'training', 'minutes', 'weekly', 'consistency'] },
];

const getBadge = (row) => row?.badges || row?.badge || row || null;

const badgeText = (badge) => [
    badge?.name,
    badge?.category,
    badge?.description,
].filter(Boolean).join(' ').toLowerCase();

const DevelopmentPassportCard = ({ badges = [], stats = null, playerName = 'Player' }) => {
    const passport = useMemo(() => {
        const unique = new Map();
        for (const row of badges || []) {
            const badge = getBadge(row);
            if (!badge?.id) continue;
            const awardedAt = row?.awarded_at || row?.created_at || null;
            if (!unique.has(badge.id)) {
                unique.set(badge.id, { ...badge, count: 0, latestAwardedAt: awardedAt });
            }
            const entry = unique.get(badge.id);
            entry.count += 1;
            if (awardedAt && (!entry.latestAwardedAt || new Date(awardedAt) > new Date(entry.latestAwardedAt))) {
                entry.latestAwardedAt = awardedAt;
            }
        }

        const earned = [...unique.values()].sort((a, b) => {
            const aTime = a.latestAwardedAt ? new Date(a.latestAwardedAt).getTime() : 0;
            const bTime = b.latestAwardedAt ? new Date(b.latestAwardedAt).getTime() : 0;
            return bTime - aTime;
        });
        const sectionStatus = PASSPORT_SECTIONS.map((section) => {
            const activeBadges = earned.filter((badge) => {
                const text = badgeText(badge);
                return section.match.some((term) => text.includes(term));
            });
            return { ...section, count: activeBadges.length };
        });

        return { earned, sectionStatus };
    }, [badges]);

    const totalStamps = passport.earned.length;
    const unlockedSections = passport.sectionStatus.filter(s => s.count > 0).length;
    const weeklyMinutes = stats?.weekly_minutes || 0;
    const weeklyTouches = stats?.weekly_touches || 0;
    const careerTouches = stats?.career_touches || 0;
    const displayName = (playerName || 'Player').split(' ')[0] || 'Player';
    const progressPct = Math.min(100, Math.round((unlockedSections / PASSPORT_SECTIONS.length) * 100));
    const recentStamps = passport.earned.slice(0, 6);

    return (
        <div className="glass-panel p-5 border-l-4 border-l-brand-gold overflow-hidden relative">
            <div className="absolute top-0 right-0 w-40 h-40 bg-brand-gold/5 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10">
                <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                        <h3 className="text-white font-display font-bold uppercase tracking-wider flex items-center gap-2">
                            <BookOpen className="w-5 h-5 text-brand-gold" />
                            Development Passport
                        </h3>
                        <p className="text-xs text-gray-400 mt-1">
                            {displayName}'s skill journey, stamps, touches, and consistency.
                        </p>
                    </div>
                    <div className="text-right shrink-0">
                        <div className="text-2xl font-display font-black text-brand-gold leading-none">{totalStamps}</div>
                        <div className="text-[10px] text-gray-500 uppercase tracking-wider">stamps</div>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="rounded-lg bg-white/[0.04] border border-white/10 p-2 text-center">
                        <Clock className="w-4 h-4 text-blue-400 mx-auto mb-1" />
                        <div className="text-sm text-white font-bold">{weeklyMinutes}</div>
                        <div className="text-[9px] text-gray-500 uppercase">min/week</div>
                    </div>
                    <div className="rounded-lg bg-white/[0.04] border border-white/10 p-2 text-center">
                        <Footprints className="w-4 h-4 text-brand-green mx-auto mb-1" />
                        <div className="text-sm text-white font-bold">{weeklyTouches.toLocaleString()}</div>
                        <div className="text-[9px] text-gray-500 uppercase">touches/week</div>
                    </div>
                    <div className="rounded-lg bg-white/[0.04] border border-white/10 p-2 text-center">
                        <Trophy className="w-4 h-4 text-brand-gold mx-auto mb-1" />
                        <div className="text-sm text-white font-bold">{careerTouches.toLocaleString()}</div>
                        <div className="text-[9px] text-gray-500 uppercase">career touches</div>
                    </div>
                </div>

                <div className="mb-4">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Passport Progress</span>
                        <span className="text-[10px] text-brand-gold uppercase tracking-wider font-bold">
                            {unlockedSections}/{PASSPORT_SECTIONS.length} sections
                        </span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-brand-green to-brand-gold rounded-full transition-all"
                            style={{ width: `${progressPct}%` }}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
                    {passport.sectionStatus.map((section) => {
                        const active = section.count > 0;
                        return (
                            <div
                                key={section.label}
                                className={`rounded-lg border px-2.5 py-2 flex items-center gap-2 ${
                                    active
                                        ? 'bg-brand-green/10 border-brand-green/30 text-white'
                                        : 'bg-white/[0.03] border-white/10 text-gray-500'
                                }`}
                            >
                                {active
                                    ? <CheckCircle className="w-4 h-4 text-brand-green shrink-0" />
                                    : <Target className="w-4 h-4 text-gray-600 shrink-0" />}
                                <div className="min-w-0">
                                    <div className="text-[11px] font-bold uppercase truncate">{section.label}</div>
                                    <div className="text-[9px] text-gray-500 uppercase">{section.count} stamp{section.count === 1 ? '' : 's'}</div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-2 flex items-center gap-1.5">
                        <Award className="w-3.5 h-3.5 text-brand-gold" />
                        Latest Stamps
                    </div>
                    {recentStamps.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                            {recentStamps.map((badge) => (
                                <div
                                    key={badge.id}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.05] border border-white/10"
                                    title={badge.description || badge.name}
                                >
                                    <span className="text-base leading-none">{badge.icon || '*'}</span>
                                    <span className="text-[11px] text-white font-bold">{badge.name}</span>
                                    {badge.count > 1 && <span className="text-[10px] text-brand-gold font-black">x{badge.count}</span>}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-xs text-gray-500">No stamps yet. Complete challenges and master skills to start filling the passport.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DevelopmentPassportCard;
