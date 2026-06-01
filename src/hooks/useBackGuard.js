import { useEffect, useRef } from 'react';

// Make the phone/browser BACK button behave like in-app "back" instead of
// leaving the app (which, with our state-based views, dumped users on the
// login screen). Mount ONE of these per page.
//
// `onBack()` should close the topmost open overlay or step back one in-app
// screen and return `true` if it handled the press. Return `false` to let the
// back proceed (e.g. at the home screen → exit the app). We keep a "guard"
// history entry armed so there's always something to pop, and re-arm it after
// every handled press so the user stays put.
export default function useBackGuard(onBack) {
    const onBackRef = useRef(onBack);
    onBackRef.current = onBack;

    useEffect(() => {
        // Arm the guard.
        window.history.pushState({ _bbGuard: true }, '');

        const handler = () => {
            const handled = onBackRef.current?.();
            if (handled) {
                // Re-arm so the user remains in the app.
                window.history.pushState({ _bbGuard: true }, '');
            }
            // If not handled, the browser already navigated back — let it go
            // (login has been replaced out of history, so this exits the app).
        };

        window.addEventListener('popstate', handler);
        return () => window.removeEventListener('popstate', handler);
    }, []);
}
