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

  static async getMappingBySessionId(sessionId: string) {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('gubagoo_segment_mapping')
      .select('*')
      .eq('sd_session_id', sessionId)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      console.error('Error getting mapping by session ID:', error);
      throw error;
    }
    
    return data;
  }

  static async saveCompleteLead(lead: any) {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('gubagoo_leads')
      .insert({
        lead_id: lead.leadId,
        ajs_anonymous_id: lead.ajs_anonymous_id,
        gubagoo_visitor_uuid: lead.gubagoo_visitor_uuid,
        first_name: lead.firstName,
        last_name: lead.lastName,
        email: lead.email,
        phone: lead.phone,
        vehicle_year: lead.year,
        vehicle_make: lead.make,
        vehicle_model: lead.model,
        vehicle_vin: lead.vin,
        vehicle_stock: lead.stock,
        utm_source: lead.utm_source,
        utm_medium: lead.utm_medium,
        utm_campaign: lead.utm_campaign,
        utm_term: lead.utm_term,
        utm_content: lead.utm_content,
        gclid: lead.gclid,
        fbclid: lead.fbclid,
        request_date: lead.requestDate,
        segment_sent: true,
        segment_sent_at: new Date().toISOString()
      });
    
    if (error) {
      console.error('Error saving complete lead:', error);
      throw error;
    }
    
    return data;
  }

  static async savePendingLead(pendingLead: any) {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('gubagoo_pending_leads')
      .insert(pendingLead);
    
    if (error) {
      console.error('Error saving pending lead:', error);
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