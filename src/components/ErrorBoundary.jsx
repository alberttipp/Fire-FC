import React from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        // Log to console in development
        console.error('ErrorBoundary caught:', error, errorInfo);
        
        // In production, you could send this to an error tracking service
        // Example: Sentry.captureException(error);
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-brand-dark flex items-center justify-center p-4">
                    <div className="glass-panel p-8 max-w-md w-full text-center">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
                            <AlertTriangle className="w-8 h-8 text-red-500" />
                        </div>
                        
                        <h2 className="text-xl font-display font-bold text-white uppercase tracking-wider mb-2">
                            Something Went Wrong
                        </h2>
                        
                        <p className="text-gray-400 text-sm mb-6">
                            Don't worry — your data is safe. Try refreshing the page.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-3 justify-center">
                            <button
                                onClick={this.handleRetry}
                                className="btn-primary px-6 py-2 flex items-center justify-center gap-2"
                            >
                                <RefreshCw className="w-4 h-4" />
                                Try Again
                            </button>
                            
                            <button
                                onClick={() => window.location.href = '/login'}
                                className="px-6 py-2 border border-white/20 text-white rounded hover:bg-white/5 transition-colors"
                            >
                                Go to Login
                            </button>
                        </div>

                        {/* Show error details in development */}
                        {import.meta.env.DEV && this.state.error && (
                            <details className="mt-6 text-left">
                                <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-400">
                                    Developer Details
                                </summary>
                                <pre className="mt-2 p-3 bg-black/50 rounded text-xs text-red-400 overflow-auto max-h-32">
                                    {this.state.error.toString()}
                                </pre>
                            </details>
                        )}
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
