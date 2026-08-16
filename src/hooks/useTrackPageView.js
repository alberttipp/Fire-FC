// Records a page_view whenever the route changes. Must be rendered inside the
// Router (it reads useLocation).
//
// Route-level views are the coarse baseline — this app keeps most of its
// navigation in local state under /dashboard, so trackScreen() in the dashboards
// is what carries the real detail.

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackEvent } from '../utils/analytics';

export const useTrackPageView = () => {
    const location = useLocation();

    useEffect(() => {
        trackEvent('page_view', {}, { path: location.pathname });
    }, [location.pathname]);
};

export default useTrackPageView;
