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
  sd_session_id?: string;
  
  // Customer information
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  
  // Address
  street?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  
  // Primary vehicle information
  vehicle_year?: number;
  vehicle_make?: string;
  vehicle_model?: string;
  vehicle_trim?: string;
  vehicle_vin?: string;
  vehicle_stock?: string;
  vehicle_color?: string;
  vehicle_mileage?: number;
  vehicle_price?: number;
  vehicle_status?: string; // new/used
  
  // Financial information
  monthly_payment?: number;
  down_payment?: number;
  total_amount?: number;
  financing_term?: number;
  
  // Trade-in information
  trade_in_year?: number;
  trade_in_make?: string;
  trade_in_model?: string;
  trade_in_vin?: string;
  trade_in_value?: number;
  trade_in_mileage?: number;
  
  // Attribution data
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  gclid?: string;
  fbclid?: string;
  
  // Lead metadata
  request_date?: string;
  dealer_code?: string;
  lead_type?: string;
  lead_source?: string;
  comments?: string;
  
  // Processing metadata
  segment_sent?: boolean;
  segment_sent_at?: string;
  processed_at?: string;
  created_at?: string;
}

export interface GubagooPendingLead {
  id?: number;
  lead_id: string;
  sd_session_id?: string;
  email_subject?: string;
  email_body?: string;
  lead_data?: any;
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

export interface ParsedADFData {
  leadId: string;
  sdSessionId?: string;
  formType?: string;
  
  // Customer info
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  
  // Address
  street?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  
  // Primary vehicle
  year?: number;
  make?: string;
  model?: string;
  vin?: string;
  stock?: string;
  vehicleStatus?: string; // new/used
  
  // Financial info
  monthlyPayment?: number;
  totalAmount?: number;
  downPayment?: number;
  
  // Trade-in info
  tradeInYear?: number;
  tradeInMake?: string;
  tradeInModel?: string;
  tradeInVin?: string;
  tradeInValue?: number;
  tradeInMileage?: number;
  
  requestDate: string;
  rawXml: string;
}