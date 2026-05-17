import { useCallback, useRef } from 'react';

// Long-press detector. Returns a bag of handlers to spread onto the
// target element. Fires `onLongPress` after `ms` of held pointerdown
// (default 450ms). Cancels if pointer is released or leaves the element
// before the threshold, so a normal tap doesn't trigger it.
//
// Usage:
//   const lp = useLongPress(() => setPickerOpen(id));
//   <div {...lp} />
export default function useLongPress(onLongPress, ms = 450) {
    const timerRef = useRef(null);
    const firedRef = useRef(false);

    const clear = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    const onPointerDown = useCallback((e) => {
        firedRef.current = false;
        clear();
        timerRef.current = setTimeout(() => {
            firedRef.current = true;
            timerRef.current = null;
            onLongPress?.(e);
        }, ms);
    }, [onLongPress, ms, clear]);

    const onPointerUp = useCallback(() => { clear(); }, [clear]);
    const onPointerLeave = useCallback(() => { clear(); }, [clear]);
    const onPointerCancel = useCallback(() => { clear(); }, [clear]);

    return { onPointerDown, onPointerUp, onPointerLeave, onPointerCancel };
}
