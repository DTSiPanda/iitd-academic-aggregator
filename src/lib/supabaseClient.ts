import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xkyrqufbvaiqrhljkcus.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhreXJxdWZidmFpcXJobGprY3VzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU2NzM2NDAsImV4cCI6MjEwMTI0OTY0MH0.SI13PGWIekj0D_8EYtOPG1n30We5cXRfdYSqJUtYLs0';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
