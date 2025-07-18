import { createClient } from '@supabase/supabase-js';
import { GubagooSegmentMapping, GubagooLead } from '../types';

// Create a function to get the Supabase client (lazy initialization)
function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables. Check your .env file.');
  }
  
  return createClient(supabaseUrl, supabaseKey);
}

export class SupabaseService {
  static async saveMapping(mapping: GubagooSegmentMapping) {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('gubagoo_segment_mapping')
      .upsert(mapping, { onConflict: 'gubagoo_visitor_uuid' });
    
    if (error) {
      console.error('Error saving mapping:', error);
      throw error;
    }
    
    return data;
  }

  static async getMappingByVisitorUuid(visitorUuid: string) {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('gubagoo_segment_mapping')
      .select('*')
      .eq('gubagoo_visitor_uuid', visitorUuid)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      console.error('Error getting mapping:', error);
      throw error;
    }
    
    return data;
  }

  static async saveLead(lead: GubagooLead) {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('gubagoo_leads')
      .insert(lead);
    
    if (error) {
      console.error('Error saving lead:', error);
      throw error;
    }
    
    return data;
  }
}