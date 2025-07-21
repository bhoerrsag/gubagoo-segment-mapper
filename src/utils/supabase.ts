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
    
    console.log('💾 Saving complete lead to database:', lead.leadId);
    
    const { data, error } = await supabase
      .from('gubagoo_leads')
      .insert({
        // Lead identification - REQUIRED FIELDS
        lead_id: lead.leadId,
        ajs_anonymous_id: lead.ajs_anonymous_id,
        gubagoo_visitor_uuid: lead.gubagoo_visitor_uuid || lead.gubagooVisitorUuid,
        
        // Customer information
        first_name: lead.firstName,
        last_name: lead.lastName,
        email: lead.email,
        phone: lead.phone,
        
        // Address
        street: lead.street,
        city: lead.city,
        state: lead.state,
        zip_code: lead.zipCode,
        
        // Primary vehicle information
        vehicle_year: lead.year,
        vehicle_make: lead.make,
        vehicle_model: lead.model,
        vehicle_vin: lead.vin,
        vehicle_stock: lead.stock,
        vehicle_status: lead.vehicleStatus, // new/used
        
        // Financial information
        monthly_payment: lead.monthlyPayment,
        down_payment: lead.downPayment,
        total_amount: lead.totalAmount,
        
        // Trade-in information
        trade_in_year: lead.tradeInYear,
        trade_in_make: lead.tradeInMake,
        trade_in_model: lead.tradeInModel,
        trade_in_vin: lead.tradeInVin,
        trade_in_value: lead.tradeInValue,
        trade_in_mileage: lead.tradeInMileage,
        
        // Attribution data from visitor mapping
        utm_source: lead.utm_source,
        utm_medium: lead.utm_medium,
        utm_campaign: lead.utm_campaign,
        utm_term: lead.utm_term,
        utm_content: lead.utm_content,
        gclid: lead.gclid,
        fbclid: lead.fbclid,
        
        // Lead metadata
        lead_type: lead.formType || 'Gubagoo - Virtual Retailing',
        lead_source: 'Gubagoo Virtual Retailing',
        request_date: lead.requestDate,
        
        // Supplementary data
        sd_session_id: lead.sdSessionId,
        
        // Processing metadata
        segment_sent: true,
        segment_sent_at: new Date().toISOString(),
        processed_at: new Date().toISOString(),
        
        // Raw data for debugging
        comments: 'ADF/XML processed successfully with enhanced parser'
      });
    
    if (error) {
      console.error('❌ Supabase error saving lead:', error);
      throw error;
    }
    
    console.log('✅ Lead saved to database successfully');
    return data;
  }

  static async savePendingLead(pendingLead: any) {
    const supabase = getSupabaseClient();
    
    console.log('⚠️ Saving pending lead:', pendingLead.lead_id);
    
    const { data, error } = await supabase
      .from('gubagoo_pending_leads')
      .insert({
        lead_id: pendingLead.lead_id,
        gubagoo_visitor_uuid: pendingLead.gubagoo_visitor_uuid,
        email_subject: pendingLead.email_subject,
        email_body: pendingLead.email_body,
        lead_data: pendingLead.lead_data,
        error_message: pendingLead.error_message || 'No gubagoo_visitor_uuid found',
        retry_count: 0
      });
    
    if (error) {
      console.error('Error saving pending lead:', error);
      throw error;
    }
    
    console.log('✅ Pending lead saved for manual review');
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

  // Additional helper methods for monitoring
  static async getLeadStats() {
    const supabase = getSupabaseClient();
    
    const { data: totalLeads, count: totalCount } = await supabase
      .from('gubagoo_leads')
      .select('id', { count: 'exact' });
      
    const { data: leadsWithAttribution, count: attributedCount } = await supabase
      .from('gubagoo_leads')
      .select('id', { count: 'exact' })
      .not('utm_source', 'is', null);
      
    const { data: pendingLeads, count: pendingCount } = await supabase
      .from('gubagoo_pending_leads')
      .select('id', { count: 'exact' });
    
    return {
      totalLeads: totalCount || 0,
      leadsWithAttribution: attributedCount || 0,
      pendingLeads: pendingCount || 0,
      attributionRate: totalCount ? 
        Math.round((attributedCount || 0) * 100 / totalCount) : 0
    };
  }

  static async getRecentLeads(limit: number = 10) {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('gubagoo_leads')
      .select(`
        lead_id,
        first_name,
        last_name,
        email,
        gubagoo_visitor_uuid,
        vehicle_year,
        vehicle_make,
        vehicle_model,
        monthly_payment,
        utm_source,
        utm_medium,
        utm_campaign,
        processed_at
      `)
      .order('processed_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('Error getting recent leads:', error);
      throw error;
    }
    
    return data;
  }

  // Log email processing
  static async logEmailProcessing(logData: any) {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('gubagoo_email_log')
      .insert({
        email_subject: logData.email_subject,
        email_from: logData.email_from,
        gubagoo_visitor_uuid: logData.gubagoo_visitor_uuid,
        lead_id: logData.lead_id,
        processing_status: logData.processing_status,
        error_message: logData.error_message
      });
    
    if (error) {
      console.error('Error logging email processing:', error);
    }
    
    return data;
  }
}