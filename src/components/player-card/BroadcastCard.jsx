import React, { useState, useEffect, useRef } from 'react';
import { Shield, TrendingUp, RotateCw, ChevronRight } from 'lucide-react';
import Tilt from 'react-parallax-tilt';
import NumberFlow from '@number-flow/react';
import { LazyMotion, domAnimation, m } from 'framer-motion';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import confetti from 'canvas-confetti';
import { flagUrl, countryName } from '../../constants/cardCountries';
import { useBranding } from '../../context/BrandingContext';
import AttributeHexagon from './AttributeHexagon';
import HoloFoil from './HoloFoil';
import useReducedMotion from './useReducedMotion';

// ---------------------------------------------------------------------------
// Broadcast XI card — the rebuilt hero. EA-Ultimate-Team × broadcast graphic:
// holographic gyro-tilt + foil, stat count-up, and an attribute hexagon on the
// back. Rendered by PlayerCard (which owns the public prop API + HERO_THEMES).
// Every animation degrades under prefers-reduced-motion and when no gyro exists
// (mouse tilt on desktop; static on touch without motion permission).
// ---------------------------------------------------------------------------

// Tilt shell: gyroscope + mouse parallax + glare when motion is allowed;
// a plain perspective wrapper (for the flip) when reduced.
function TiltShell({ reduced, cardRef, children }) {
  if (reduced) {
    return (
      <div className="w-full h-full" style={{ perspective: '1000px' }}>
        {children}
      </div>
    );
  }
  // react-parallax-tilt onMove → (tiltX, tiltY, tiltXPct, tiltYPct, glareAngle, glareOpacity, event)
  const onMove = (_tiltX, _tiltY, tiltXPct, tiltYPct) => {
    const el = cardRef.current;
    if (!el) return;
    const px = Math.max(0, Math.min(100, 50 + (tiltYPct ?? 0) / 2));
    const py = Math.max(0, Math.min(100, 50 + (tiltXPct ?? 0) / 2));
    el.style.setProperty('--bx-px', px.toFixed(1));
    el.style.setProperty('--bx-py', py.toFixed(1));
    el.style.setProperty('--bx-foil-o', '1');
  };
  const onLeave = () => {
    const el = cardRef.current;
    if (el) el.style.setProperty('--bx-foil-o', '0');
  };
  return (
    <Tilt
      className="w-full h-full"
      tiltMaxAngleX={9}
      tiltMaxAngleY={9}
      perspective={1000}
      scale={1.02}
      transitionSpeed={1400}
      gyroscope
      glareEnable
      glareMaxOpacity={0.22}
      glareColor="#ffffff"
      glarePosition="all"
      glareBorderRadius="24px"
      onMove={onMove}
      onLeave={onLeave}
    >
      {children}
    </Tilt>
  );
}

export default function BroadcastCard({
  name = 'Alex Morgan',
  position = 'ST',
  number = '13',
  rating = 88,
  pace = 92,
  shooting = 89,
  passing = 82,
  dribbling = 90,
  defending = 45,
  physical = 78,
  theme = null,          // HERO_THEMES entry (Messi / CR7) or null
  country = 'us',
  image = '',
  onClick = null,
  showBack = false,
  reveal = false,        // opt-in intro: face-down → flip → count-up + hex draw
}) {
  const reduced = useReducedMotion();
  const cardRef = useRef(null);
  const brand = useBranding();

  // When revealing we start face-down (back) and flip to the front; otherwise we
  // honor showBack exactly as the legacy card did.
  const [isFlipped, setIsFlipped] = useState(reveal && !reduced ? true : showBack);
  // "rolled" gates the count-up + hexagon draw. Off during reveal so numbers
  // start at 0 and roll; on immediately otherwise so existing mounts are static.
  const [rolled, setRolled] = useState(!(reveal && !reduced));

  const elite = rating >= 85;

  useEffect(() => {
    if (!reveal) return;
    if (reduced) { setIsFlipped(showBack); setRolled(true); return; }
    const t1 = setTimeout(() => setIsFlipped(false), 350);   // flip to front
    const t2 = setTimeout(() => setRolled(true), 750);       // then count up + draw
    let t3;
    if (elite) {
      // Confetti is gated to a rare moment: an elite (85+) reveal only.
      t3 = setTimeout(() => {
        confetti({ particleCount: 70, spread: 62, startVelocity: 32, scalar: 0.8,
          origin: { y: 0.4 }, colors: ['#e8c15a', '#3ddc84', '#ffffff'] });
      }, 820);
    }
    return () => { clearTimeout(t1); clearTimeout(t2); if (t3) clearTimeout(t3); };
  }, [reveal, reduced, showBack, elite]);

  const handleCardClick = () => setIsFlipped((f) => !f);
  const handleOpenProfile = (e) => { e.stopPropagation(); if (onClick) onClick(); };

  const val = (n) => (rolled ? n : 0);
  const heroAccent = theme?.accent || null;         // tailwind text-* class when hero mode
  const ovrColor = elite ? 'var(--bx-gold-400)' : 'var(--bx-green-400)';
  const frameBorder = theme ? theme.border
    : (elite ? 'border-[rgba(232,193,90,0.5)]' : 'border-[rgba(255,255,255,0.09)]');
  const frameGlow = theme ? theme.glow
    : (elite ? 'shadow-[0_0_34px_rgba(232,193,90,0.28)]' : '');

  // rounded shape identical to legacy card so dashboard layout is unchanged
  const shape = 'rounded-t-[2rem] rounded-br-[4rem] rounded-bl-[2rem]';
  const surfaceBase = `absolute inset-0 bg-gradient-to-br from-[#161d1a] via-[#101513] to-[#0a0d0c] p-1.5 bx-surface bx-glow border-2 ${shape}`;

  const [gridRef] = useAutoAnimate();

  const stats = [
    { label: 'PAC', val: pace },
    { label: 'DRI', val: dribbling },
    { label: 'SHO', val: shooting },
    { label: 'DEF', val: defending },
    { label: 'PAS', val: passing },
    { label: 'PHY', val: physical },
  ];

  return (
    <div
      onClick={handleCardClick}
      className="relative w-full max-w-80 h-[480px] mx-auto group bx-body select-none cursor-pointer"
    >
      {/* Hero Mode badge — unchanged behavior */}
      {theme && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-50">
          <span className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider shadow-lg whitespace-nowrap ${theme.badgeCls}`}>
            {theme.emoji} {theme.badge}
          </span>
        </div>
      )}

      <TiltShell reduced={reduced} cardRef={cardRef}>
        <LazyMotion features={domAnimation}>
          <m.div
            className="relative w-full h-full"
            style={{ transformStyle: 'preserve-3d' }}
            animate={{ rotateY: isFlipped ? 180 : 0 }}
            transition={{ duration: reduced ? 0 : 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* ============ FRONT ============ */}
            <div className="absolute inset-0 w-full h-full" style={{ backfaceVisibility: 'hidden' }}>
              <div ref={cardRef} className={`${surfaceBase} ${frameBorder} ${frameGlow}`}>
                <HoloFoil />
                {/* inner hairline frame */}
                <div className={`absolute top-2 bottom-2 left-2 right-2 border-[1.5px] border-[rgba(232,193,90,0.18)] rounded-t-[1.8rem] rounded-br-[3.8rem] rounded-bl-[1.8rem] pointer-events-none z-10`} />

                <div className="relative w-full h-full flex flex-col overflow-visible z-20">
                  {/* Top: OVR/info + image */}
                  <div className="h-[65%] w-full relative flex">
                    <div className="w-[30%] pt-10 pl-6 flex flex-col items-center">
                      <span
                        className={`bx-anton bx-nums text-[3.4rem] leading-none tracking-tight drop-shadow-[0_2px_6px_rgba(0,0,0,0.55)] ${heroAccent || ''}`}
                        style={heroAccent ? undefined : { color: ovrColor }}
                      >
                        <NumberFlow value={val(rating)} />
                      </span>
                      <span className="bx-anton text-xl text-white uppercase leading-none mb-3">{position}</span>

                      <div className="w-full h-[1px] bg-brand-gold/30 mb-3" />

                      <div className="w-8 h-6 relative shadow-md mb-2 overflow-hidden rounded border border-brand-gold/30" title={countryName(country)}>
                        <img src={flagUrl(country, 80)} alt={countryName(country)} className="absolute inset-0 w-full h-full object-cover" />
                      </div>

                      <div className="w-12 h-12 flex items-center justify-center drop-shadow">
                        <img src={brand?.logoUrl || '/branding/logo.png'} alt={brand?.shortName || 'Club'} className="w-full h-full object-contain" />
                      </div>
                    </div>

                    <div className="w-[70%] h-full relative">
                      {image && (
                        <img
                          src={image}
                          alt={name}
                          className="absolute right-[-10px] top-6 w-[220px] h-[260px] object-contain filter drop-shadow-[0_8px_16px_rgba(0,0,0,0.4)] transition-transform group-hover:scale-105"
                        />
                      )}
                    </div>
                  </div>

                  {/* Name bar */}
                  <div className="relative w-full -mt-2">
                    {number && number !== '??' && (
                      <div className="absolute -top-10 right-8 text-brand-gold bx-anton text-6xl opacity-20 select-none z-0">
                        {number}
                      </div>
                    )}
                    <h2 className="relative z-10 bx-display text-3xl text-white uppercase font-black text-center py-1 border-t border-b border-brand-gold/20 bg-gradient-to-r from-transparent via-brand-gold/5 to-transparent">
                      {name}
                    </h2>
                  </div>

                  {/* Stats grid — count-up + tabular numerals */}
                  <div ref={gridRef} className="w-full px-6 pt-3 grid grid-cols-2 gap-x-1 gap-y-0 bx-display">
                    {stats.map((s) => (
                      <div key={s.label} className="flex items-center justify-start gap-4 hover:scale-105 transition-transform origin-left">
                        <span className="bx-anton bx-nums text-xl w-8 text-right text-brand-gold">
                          <NumberFlow value={val(s.val)} />
                        </span>
                        <span className="text-sm uppercase font-bold tracking-widest text-[var(--bx-ink-1)]">{s.label}</span>
                      </div>
                    ))}
                  </div>

                  <div className="absolute bottom-6 w-full flex justify-center opacity-60">
                    <div className="w-6 h-6 border-2 border-brand-gold/50 rounded-full flex items-center justify-center bg-brand-gold/10">
                      <Shield className="w-3 h-3 text-brand-gold fill-current" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ============ BACK ============ */}
            <div className="absolute inset-0 w-full h-full" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
              <div className={`${surfaceBase} ${theme ? theme.border : 'border-[rgba(255,255,255,0.09)]'} overflow-hidden`}>
                <div className="absolute top-2 bottom-2 left-2 right-2 border-[1.5px] border-[rgba(232,193,90,0.18)] rounded-t-[1.8rem] rounded-br-[3.8rem] rounded-bl-[1.8rem] pointer-events-none z-10" />

                <div className="relative w-full h-full flex flex-col p-6 z-20">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-widest text-brand-gold font-bold mb-1">Player Card</p>
                      <h3 className="bx-display text-2xl text-white font-black uppercase truncate leading-tight">{name}</h3>
                      <p className="text-brand-green text-xs uppercase tracking-wider mt-1">{position} · #{number}</p>
                    </div>
                    <div className="flex flex-col items-center shrink-0 ml-3">
                      <span className="bx-anton bx-nums text-4xl leading-none" style={heroAccent ? undefined : { color: ovrColor }}>
                        <NumberFlow value={val(rating)} />
                      </span>
                      <span className="text-[10px] uppercase tracking-widest text-gray-400 mt-1">Overall</span>
                    </div>
                  </div>

                  <div className="h-[1px] bg-brand-gold/30 mb-2" />

                  {/* Attribute hexagon */}
                  <div className="flex-1 flex flex-col items-center justify-center min-h-0">
                    <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-1 flex items-center gap-1.5 self-start">
                      <TrendingUp className="w-3 h-3 text-brand-green" />
                      Attributes
                    </p>
                    <AttributeHexagon
                      size={176}
                      draw={!isFlipped ? false : rolled}
                      reduced={reduced}
                      values={{ PAC: pace, SHO: shooting, PAS: passing, DRI: dribbling, DEF: defending, PHY: physical }}
                    />
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2 mt-2">
                    {onClick && (
                      <button
                        onClick={handleOpenProfile}
                        className="flex-1 bg-brand-green text-brand-dark font-bold uppercase tracking-wider text-xs py-2.5 px-3 rounded-lg flex items-center justify-center gap-1.5 hover:bg-white transition-colors"
                      >
                        Full Profile <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); setIsFlipped(false); }}
                      className="bg-white/5 border border-white/10 text-gray-300 font-bold uppercase tracking-wider text-xs py-2.5 px-3 rounded-lg flex items-center justify-center gap-1.5 hover:bg-white/10 transition-colors"
                    >
                      <RotateCw className="w-3.5 h-3.5" /> Flip
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </m.div>
        </LazyMotion>
      </TiltShell>
    </div>
  );
}
