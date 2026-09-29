// Public Supabase client configuration.
// IMPORTANT: Never put a Supabase secret/service-role key or Gemini API key in this file.
const SUPABASE_URL = 'https://yfjvzxrvhprewifxjsyn.supabase.co';
const SUPABASE_PUBLIC_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlmanZ6eHJ2aHByZXdpZnhqc3luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2NTExOTYsImV4cCI6MjEwNjIyNzE5Nn0.Wtod9qloN4ygsz6281MRwBwVpn3Zwn1JnRDkkSZk9zk';

window.opsSupabase = { enabled: false, client: null };
if (window.supabase && SUPABASE_URL && SUPABASE_PUBLIC_KEY) {
  window.opsSupabase.client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY);
  // Enable only after Auth + SQL migration are deployed.
  window.opsSupabase.enabled = true;
}
