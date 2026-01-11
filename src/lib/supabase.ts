import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);

export interface SensorReading {
  id: number;
  device_id: string;
  moisture: number;
  temperature: number;
  light_lux: number;
  timestamp: number;
  created_at: string;
}