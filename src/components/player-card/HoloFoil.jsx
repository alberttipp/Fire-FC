import React from 'react';

// Holographic foil overlay for the Broadcast XI card. Purely presentational:
// the visible effect is driven by the CSS custom props --bx-px/--bx-py/--bx-foil-o
// that the tilt handler writes onto the card element (see index.css .bx-foil*).
// Reduced-motion is handled in CSS (.bx-foil forced to opacity:0), so nothing
// here animates when the user opts out.
export default function HoloFoil() {
  return (
    <div className="bx-foil" aria-hidden="true">
      <div className="bx-foil__color" />
      <div className="bx-foil__sheen" />
    </div>
  );
}
