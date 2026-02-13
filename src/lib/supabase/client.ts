// src/lib/supabase/client.ts
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// IMPORTANT:
// This prevents "supabaseUrl is required" from crashing static export builds.
export const supabase = url && key ? createClient(url, key) : null;

// Optional helper (nice for debugging / UI messages)
export const supabaseConfigured = Boolean(url && key);
