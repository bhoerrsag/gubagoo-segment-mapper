export interface GubagooSegmentMapping {
  id?: number;
  ajs_anonymous_id: string;
  gubagoo_visitor_uuid: string;
  sd_session_id?: string; 
  gubagoo_user_id?: string;
  gubagoo_session_id?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  referrer?: string;
  landing_page?: string;
  gclid?: string;
  fbclid?: string;
  page_url?: string;
  user_agent?: string;
  ip_address?: string;
  created_at?: string;
  updated_at?: string;
}

export interface GubagooLead {
  id?: number;
  lead_id: string;
  ajs_anonymous_id: string;
  gubagoo_visitor_uuid: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  street?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  vehicle_year?: number;
  vehicle_make?: string;
  vehicle_model?: string;
  vehicle_trim?: string;
  vehicle_vin?: string;
  vehicle_stock?: string;
  vehicle_color?: string;
  vehicle_mileage?: number;
  vehicle_price?: number;
  monthly_payment?: number;
  down_payment?: number;
  total_amount?: number;
  trade_in_value?: number;
  financing_term?: number;
  request_date?: string;
  dealer_code?: string;
  lead_type?: string;
  lead_source?: string;
  comments?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  gclid?: string;
  fbclid?: string;
  segment_sent?: boolean;
  segment_sent_at?: string;
  processed_at?: string;
  created_at?: string;
}

export interface UTMParams {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  gclid?: string;
  fbclid?: string;
}

export interface GubagooEmailLog {
  id?: number;
  email_subject?: string;
  email_from?: string;
  gubagoo_visitor_uuid?: string;
  lead_id?: string;
  processing_status?: string;
  error_message?: string;
  processed_at?: string;
}