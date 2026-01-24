import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';

const DebugStatus = () => {
    const { user } = useAuth();
    const [logs, setLogs] = useState([]);

    const log = (msg, type = 'info') => {
        setLogs(prev => [...prev, { msg, type, time: new Date().toLocaleTimeString() }]);
    };

    useEffect(() => {
        const runDiagnostics = async () => {
            log("🚀 Starting Diagnostics...", 'info');

            // 1. Check Auth
            if (user) {
                log(`Auth User: ${user.email} (ID: ${user.id})`, 'success');
            } else {
                log("Auth User: Not Logged In", 'warning');
            }

            // 2. Check Connection & RLS on Profiles
            try {
                const { data, error, count } = await supabase
                    .from('profiles')
                    .select('*', { count: 'exact' })
                    .limit(5);

                if (error) {
                    log(`❌ Profiles Read Error: ${error.message} (Code: ${error.code})`, 'error');
                    log(`   -> Hint: If code is 42501, RLS Policy is blocking access.`, 'info');
                } else {
                    log(`✅ Profiles Read Success! Found ${count} total rows.`, 'success');
                    log(`   -> Sample retrieved: ${data.length} rows.`, 'info');
                    if (data.length > 0) {
                        log(`   -> First User: ${data[0].full_name} (${data[0].role})`, 'info');
                    } else {
                        log(`   ⚠️ Returns 0 rows. RLS might be "Using (false)" or DB is empty.`, 'warning');
                    }
                }
            } catch (err) {
                log(`❌ Network/Client Error: ${err.message}`, 'error');
            }

            // 3. Check Teams
            try {
                const { data: teams, error } = await supabase.from('teams').select('*');
                if (error) log(`❌ Teams Read Error: ${error.message}`, 'error');
                else log(`✅ Teams Read Success: Found ${teams.length} teams.`, 'success');
            } catch (err) { }

        };

        runDiagnostics();
    }, [user]);

    return (
        <div className="min-h-screen bg-black text-white p-8 font-mono">
            <h1 className="text-2xl font-bold mb-4 text-brand-green">System Diagnostics</h1>
            <div className="bg-gray-900 p-4 rounded border border-gray-700 h-[600px] overflow-y-auto">
                {logs.map((l, i) => (
                    <div key={i} className={`mb-2 ${l.type === 'error' ? 'text-red-400 font-bold' :
                            l.type === 'success' ? 'text-green-400' :
                                l.type === 'warning' ? 'text-yellow-400' : 'text-gray-300'
                        }`}>
                        <span className="text-gray-600 mr-2">[{l.time}]</span>
                        {l.msg}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default DebugStatus;
