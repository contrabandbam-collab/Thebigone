import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(url && anonKey);
export const supabase = isSupabaseConfigured
  ? createClient(url!, anonKey!, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: true,
      },
    })
  : null;

export type PublicBusiness = {
  id: string;
  public_id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string | null;
  subcategory: string | null;
  city: string | null;
  state: string | null;
  service_area: string | null;
  public_phone: string | null;
  public_email: string | null;
  website_url: string | null;
  profile_image_url: string | null;
  rating_average: number | null;
  rating_count: number;
};