import confetti from 'canvas-confetti';

export const triggerMessiMode = () => {
    // 1. Center Explosion
    confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#3b82f6', '#D4AF37', '#ffffff'] // Brand colors
    });

    // 2. Side Cannons
    var end = Date.now() + (1 * 1000);
    var colors = ['#3b82f6', '#D4AF37'];

    (function frame() {
        confetti({
            particleCount: 2,
            angle: 60,
            spread: 55,
            origin: { x: 0 },
            colors: colors
        });
        confetti({
            particleCount: 2,
            angle: 120,
            spread: 55,
            origin: { x: 1 },
            colors: colors
        });

        if (Date.now() < end) {
            requestAnimationFrame(frame);
        }
    }());
};
