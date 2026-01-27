/**
 * Build Info - Vercel Environment Variables
 * Auto-populated during build time
 */

export const BUILD_INFO = {
    // Vercel Git integration
    commitSha: import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA || 'local-dev',
    commitMessage: import.meta.env.VITE_VERCEL_GIT_COMMIT_MESSAGE || 'Local development',
    commitAuthor: import.meta.env.VITE_VERCEL_GIT_COMMIT_AUTHOR_NAME || 'Developer',
    branch: import.meta.env.VITE_VERCEL_GIT_COMMIT_REF || 'local',

    // Deployment info
    deploymentUrl: import.meta.env.VITE_VERCEL_URL || 'localhost',
    environment: import.meta.env.VITE_VERCEL_ENV || 'development',

    // Build timestamp
    buildTime: import.meta.env.VITE_BUILD_TIME || new Date().toISOString(),

    // Supabase
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL || 'not-configured',

    // Computed
    get shortSha() {
        return this.commitSha.substring(0, 7);
    },

    get projectRef() {
        const match = this.supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
        return match ? match[1] : 'unknown';
    },

    get isProduction() {
        return this.environment === 'production';
    },

    get isDevelopment() {
        return this.environment === 'development';
    }
};

/**
 * Log build info to console on app load
 */
export function logBuildInfo() {
    const styles = {
        header: 'background: #16a34a; color: white; padding: 4px 8px; border-radius: 3px; font-weight: bold;',
        key: 'color: #16a34a; font-weight: bold;',
        value: 'color: #666;'
    };

    console.log('%c🚀 Fire FC Build Info', styles.header);
    console.log(`%c📦 Commit:%c ${BUILD_INFO.shortSha} (${BUILD_INFO.commitMessage})`, styles.key, styles.value);
    console.log(`%c🌿 Branch:%c ${BUILD_INFO.branch}`, styles.key, styles.value);
    console.log(`%c👤 Author:%c ${BUILD_INFO.commitAuthor}`, styles.key, styles.value);
    console.log(`%c⏰ Built:%c ${new Date(BUILD_INFO.buildTime).toLocaleString()}`, styles.key, styles.value);
    console.log(`%c🌍 Environment:%c ${BUILD_INFO.environment}`, styles.key, styles.value);
    console.log(`%c🔗 Deployment:%c ${BUILD_INFO.deploymentUrl}`, styles.key, styles.value);
    console.log(`%c🗄️ Supabase Project:%c ${BUILD_INFO.projectRef}`, styles.key, styles.value);
    console.log('');
}
