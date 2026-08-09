import React from 'react';
import { DEFAULT_CARD_COUNTRY } from '../../constants/cardCountries';
import BroadcastCard from '../player-card/BroadcastCard';

// Unlockable hero card themes (earned via play; see set_player_hero_mode).
// Kept here (and re-exported) because HeroProgress / HeroModeModal import it.
export const HERO_THEMES = {
    messi:   { border: 'border-pink-400/70',   accent: 'text-pink-300',   glow: 'shadow-[0_0_35px_rgba(244,114,182,0.35)]', badge: 'MESSI MODE', emoji: '🐐', badgeCls: 'bg-gradient-to-r from-pink-500 to-rose-500 text-white' },
    ronaldo: { border: 'border-yellow-400/80', accent: 'text-yellow-300', glow: 'shadow-[0_0_35px_rgba(250,204,21,0.40)]',  badge: 'CR7 · SIUU', emoji: '🤫', badgeCls: 'bg-gradient-to-r from-yellow-400 to-amber-500 text-black' },
};

// Thin adapter: the public API is unchanged (player object + onClick + showBack),
// but the visuals are now the "Broadcast XI" card (holographic gyro-tilt + foil,
// stat count-up, attribute hexagon). Pass reveal to opt into the pack-open intro.
const PlayerCard = ({ player, onClick, showBack = false, reveal = false }) => {
    const {
        name = 'Alex Morgan', position = 'ST', number = '13', rating = 88,
        pace = 92, shooting = 89, passing = 82, dribbling = 90, defending = 45, physical = 78,
        heroMode = null, country = DEFAULT_CARD_COUNTRY, image = '',
    } = player || {};

    return (
        <BroadcastCard
            name={name} position={position} number={number} rating={rating}
            pace={pace} shooting={shooting} passing={passing} dribbling={dribbling}
            defending={defending} physical={physical}
            theme={HERO_THEMES[heroMode] || null}
            country={country} image={image}
            onClick={onClick} showBack={showBack} reveal={reveal}
        />
    );
};

export default PlayerCard;
