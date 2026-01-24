
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
    console.error("Missing keys");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function updateBo() {
    console.log("Only updating Bo Tipp's image...");

    // Find Bo
    const { data: users, error: userError } = await supabase.from('profiles').select('id').eq('email', 'bo@firefc.com').single();
    if (userError) { console.error("Could not find Bo", userError); return; }

    const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: '/players/bo_official.png' })
        .eq('id', users.id);

    if (error) console.error("Error updating Bo:", error);
    else console.log("✅ Bo Tipp image updated to /players/bo_tipp_real.png");
}

updateBo();
