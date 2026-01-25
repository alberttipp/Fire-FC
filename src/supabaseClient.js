import { createClient } from '@supabase/supabase-js'

// Albert's Fire FC project - Rockford Fire FC
const supabaseUrl = 'https://nycprdmatvcprfujicoh.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55Y3ByZG1hdHZjcHJmdWppY29oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1ODI4OTIsImV4cCI6MjA4NDE1ODg5Mn0.iFlqm2O1nG7euTiSljjHLx4fhswfph_CWWWhskyJa0o'

export const supabase = createClient(supabaseUrl, supabaseKey)
