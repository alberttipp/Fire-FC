#!/bin/bash
# Quick fix for manager role - run this now

npx supabase db execute --project-ref bcfemytoburctssnemwn << 'EOF'
UPDATE team_memberships
SET role = 'manager'
WHERE user_id = '45fcd04b-26b2-4c9c-9e7f-fc84db624d1c'
  AND team_id = 'd02aba3e-3c30-430f-9377-3b334cffcd04';
EOF

echo "✅ Role updated to manager. Logout and login again."
