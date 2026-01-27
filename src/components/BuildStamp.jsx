import React from 'react';
import { BUILD_INFO } from '../utils/buildInfo';
import { GitCommit } from 'lucide-react';

/**
 * Build Stamp - Visible indicator of deployed version
 * Shows commit SHA and build time in footer
 */
const BuildStamp = () => {
    return (
        <div className="fixed bottom-2 right-2 z-50 flex items-center gap-2 px-3 py-1.5 bg-gray-900/90 border border-gray-700 rounded-lg text-xs backdrop-blur-sm">
            <GitCommit className="w-3 h-3 text-brand-green" />
            <span className="text-gray-400">Build:</span>
            <a
                href="/debug"
                className="text-brand-green font-mono font-bold hover:text-brand-gold transition-colors"
                title="Click to view full build info"
            >
                {BUILD_INFO.shortSha}
            </a>
            <span className="text-gray-500">|</span>
            <span className="text-gray-400">{new Date(BUILD_INFO.buildTime).toLocaleTimeString()}</span>
        </div>
    );
};

export default BuildStamp;
