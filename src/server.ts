import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';

dotenv.config();

// DEBUG: Check if env vars are loading
console.log('🔍 Debug Environment Variables:');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'Found' : 'MISSING');
console.log('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? 'Found' : 'MISSING');
console.log('SEGMENT_WRITE_KEY:', process.env.SEGMENT_WRITE_KEY ? 'Found' : 'MISSING');
console.log('ENABLE_SEGMENT:', process.env.ENABLE_SEGMENT || 'false');

import { SupabaseService } from './utils/supabase';
import { GubagooSegmentMapping } from './types';

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Segment Analytics if enabled
let analytics: any = null;
if (process.env.ENABLE_SEGMENT === 'true' && process.env.SEGMENT_WRITE_KEY) {
  try {
    const { Analytics } = require('@segment/analytics-node');
    analytics = new Analytics({ writeKey: process.env.SEGMENT_WRITE_KEY });
    console.log('✅ Segment Analytics initialized');
  } catch (error) {
    console.error('❌ Failed to initialize Segment Analytics:', error);
  }
}

// Middleware
app.use(cors({
  origin: ['https://sportsubarusouth.com', 'https://www.sportsubarusouth.com', 'http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Configure multer for multipart/form-data (SendGrid emails)
const upload = multer();

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    segment_enabled: process.env.ENABLE_SEGMENT === 'true',
    segment_initialized: !!analytics
  });
});

// Serve the gubagoo-mapper.js script directly
app.get('/gubagoo-mapper.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  
  const scriptContent = `
(function() {
    'use strict';
    
    // Configuration
    const CONFIG = {
        API_ENDPOINT: 'https://centricattribute.vercel.app/api/gubagoo-mapping',
        GUBAGOO_DOMAIN: 'cbo-ui.gubagoo.io',
        DEBUG: true
    };
    
    // Utility functions
    function log(message, data = null) {
        if (CONFIG.DEBUG) {
            console.log('[Gubagoo Mapper]', message, data || '');
        }
    }
    
    function getUrlParams() {
        const params = new URLSearchParams(window.location.search);
        return {
            utm_source: params.get('utm_source'),
            utm_medium: params.get('utm_medium'),
            utm_campaign: params.get('utm_campaign'),
            utm_term: params.get('utm_term'),
            utm_content: params.get('utm_content'),
            gclid: params.get('gclid'),
            fbclid: params.get('fbclid')
        };
    }
    
    function getSegmentAnonymousId() {
        if (window.analytics && window.analytics.user) {
            return window.analytics.user().anonymousId();
        }
        
        try {
            const ajsUser = localStorage.getItem('ajs_anonymous_id');
            if (ajsUser) {
                return JSON.parse(ajsUser);
            }
        } catch (e) {
            log('Error getting Segment ID from localStorage:', e);
        }
        
        return null;
    }
    
    function getShiftDigitalSessionId() {
        try {
            const containerHistory = JSON.parse(localStorage.getItem('SD:ContainerHistory') || '[]');
            const latestEntry = containerHistory.slice(-1)[0];
            const sessionId = latestEntry?.actionValues?.sessionId;
            
            if (sessionId) {
                log('Found ShiftDigital sessionId from localStorage');
                return sessionId;
            }
        } catch (e) {
            log('Error getting ShiftDigital sessionId:', e);
        }
        return null;
    }
    
    function getGubagooVisitorUuid() {
        return new Promise((resolve) => {
            let attempts = 0;
            const maxAttempts = 50;
            
            function checkForUuid() {
                attempts++;
                
                try {
                    // Method 1: Check iframe src for visitor_uuid parameter
                    const gubagooIframes = document.querySelectorAll('iframe[src*="gubagoo"], iframe[src*="cbo-ui"]');
                    for (let iframe of gubagooIframes) {
                        if (iframe.src && iframe.src.includes('visitor_uuid')) {
                            const match = iframe.src.match(/visitor_uuid=([^&]+)/);
                            if (match) {
                                log('Found visitor UUID in iframe src');
                                resolve(match[1]);
                                return;
                            }
                        }
                    }
                    
                    // Method 2: Check global data layer objects
                    if (window.sdDataLayer && window.sdDataLayer.chatSessionId) {
                        log('Found visitor UUID in sdDataLayer.chatSessionId');
                        resolve(window.sdDataLayer.chatSessionId);
                        return;
                    }
                    
                    if (window.sdaDataLayer && window.sdaDataLayer.chatsessionid) {
                        log('Found visitor UUID in sdaDataLayer.chatsessionid');
                        resolve(window.sdaDataLayer.chatsessionid);
                        return;
                    }
                    
                    if (window.sdAdobe && window.sdAdobe.chatsessionid) {
                        log('Found visitor UUID in sdAdobe.chatsessionid');
                        resolve(window.sdAdobe.chatsessionid);
                        return;
                    }
                    
                    // Method 3: Check for GUBAGOO global variable
                    if (window.GUBAGOO && window.GUBAGOO.visitorId) {
                        log('Found Gubagoo visitor ID via global variable');
                        resolve(window.GUBAGOO.visitorId);
                        return;
                    }
                    
                    // Method 4: Check script tags for visitor_uuid
                    const scripts = document.querySelectorAll('script');
                    for (let script of scripts) {
                        if (script.textContent && script.textContent.includes('visitor_uuid')) {
                            const match = script.textContent.match(/visitor_uuid['":\\s]*['"]([^'"]+)['"]/);
                            if (match) {
                                log('Found visitor UUID in script tag');
                                resolve(match[1]);
                                return;
                            }
                        }
                    }
                    
                } catch (e) {
                    log('Error checking for Gubagoo UUID:', e);
                }
                
                if (attempts < maxAttempts) {
                    setTimeout(checkForUuid, 100);
                } else {
                    log('Could not find Gubagoo visitor UUID after maximum attempts');
                    resolve(null);
                }
            }
            
            checkForUuid();
        });
    }
    
    async function sendMappingData(data) {
        try {
            const response = await fetch(CONFIG.API_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });
            
            if (!response.ok) {
                throw new Error(\`HTTP error! status: \${response.status}\`);
            }
            
            const result = await response.json();
            log('Mapping data sent successfully:', result);
            return result;
            
        } catch (error) {
            log('Error sending mapping data:', error);
            throw error;
        }
    }
    
    async function initGubagooMapper() {
        log('Initializing Gubagoo Segment Mapper...');
        
        const urlParams = getUrlParams();
        log('URL parameters:', urlParams);
        
        const segmentId = getSegmentAnonymousId();
        if (!segmentId) {
            log('Warning: Could not find Segment anonymous ID');
            return;
        }
        log('Segment anonymous ID:', segmentId);
        
        // Get ShiftDigital session ID for ADF matching
        const sdSessionId = getShiftDigitalSessionId();
        log('ShiftDigital session ID:', sdSessionId);
        
        log('Waiting for Gubagoo visitor UUID...');
        const gubagooUuid = await getGubagooVisitorUuid();
        
        if (!gubagooUuid) {
            log('Warning: Could not find Gubagoo visitor UUID - visitor may not have interacted with widget yet');
            return;
        }
        
        log('Gubagoo visitor UUID:', gubagooUuid);
        
        const mappingData = {
            ajs_anonymous_id: segmentId,
            gubagoo_visitor_uuid: gubagooUuid,
            sd_session_id: sdSessionId,
            ...urlParams,
            referrer: document.referrer,
            landing_page: window.location.href,
            page_url: window.location.href
        };
        
        log('Sending mapping data:', mappingData);
        
        try {
            await sendMappingData(mappingData);
            log('✅ Gubagoo mapping completed successfully!');
        } catch (error) {
            log('❌ Failed to send mapping data:', error);
        }
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initGubagooMapper);
    } else {
        setTimeout(initGubagooMapper, 1000);
    }
    
    setTimeout(initGubagooMapper, 5000);
    
    log('Gubagoo Segment Mapper script loaded');
})();
`;
  
  res.send(scriptContent);
});

// Main endpoint to receive visitor mapping data
app.post('/api/gubagoo-mapping', async (req, res) => {
  try {
    const mappingData: GubagooSegmentMapping = {
      ajs_anonymous_id: req.body.ajs_anonymous_id,
      gubagoo_visitor_uuid: req.body.gubagoo_visitor_uuid,
      sd_session_id: req.body.sd_session_id,
      gubagoo_user_id: req.body.gubagoo_user_id,
      gubagoo_session_id: req.body.gubagoo_session_id,
      utm_source: req.body.utm_source,
      utm_medium: req.body.utm_medium,
      utm_campaign: req.body.utm_campaign,
      utm_term: req.body.utm_term,
      utm_content: req.body.utm_content,
      referrer: req.body.referrer,
      landing_page: req.body.landing_page,
      gclid: req.body.gclid,
      fbclid: req.body.fbclid,
      page_url: req.body.page_url,
      user_agent: req.headers['user-agent'],
      ip_address: req.ip || req.connection.remoteAddress
    };

    // Validate required fields
    if (!mappingData.ajs_anonymous_id || !mappingData.gubagoo_visitor_uuid) {
      return res.status(400).json({ 
        error: 'Missing required fields: ajs_anonymous_id and gubagoo_visitor_uuid' 
      });
    }

    await SupabaseService.saveMapping(mappingData);
    
    res.json({ 
      success: true, 
      message: 'Mapping saved successfully',
      visitor_uuid: mappingData.gubagoo_visitor_uuid
    });

  } catch (error) {
    console.error('Error saving mapping:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Endpoint to get mapping by visitor UUID (for testing)
app.get('/api/gubagoo-mapping/:visitorUuid', async (req, res) => {
  try {
    const { visitorUuid } = req.params;
    const mapping = await SupabaseService.getMappingByVisitorUuid(visitorUuid);
    
    if (!mapping) {
      return res.status(404).json({ error: 'Mapping not found' });
    }
    
    res.json(mapping);
  } catch (error) {
    console.error('Error getting mapping:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// IMPROVED ADF/XML PARSER - Handles exact Gubagoo format
async function parseADFEmail(emailBody: string) {
  try {
    console.log('🔍 Parsing email body...');
    
    if (!emailBody) {
      console.log('❌ No email body provided');
      return null;
    }
    
    // Extract XML from email body - handle HTML encoding
    let xmlContent = emailBody;
    if (emailBody.includes('&lt;adf&gt;') || emailBody.includes('&amp;')) {
      xmlContent = emailBody
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
    }
    
    // Extract the ADF XML block
    const adfMatch = xmlContent.match(/<adf>[\s\S]*?<\/adf>/i);
    if (!adfMatch) {
      console.log('❌ No ADF XML found in email body');
      return null;
    }
    
    const adfXml = adfMatch[0];
    console.log('📋 Extracted ADF XML length:', adfXml.length);
    
    // Parse prospect-level IDs
    const leadId = extractIdBySource(adfXml, 'LeadId');
    const sdSessionId = extractIdBySource(adfXml, 'sdSessionId');
    const formType = extractIdBySource(adfXml, 'FormType');
    
    // Parse request date
    const requestDateStr = extractSimpleField(adfXml, 'requestdate');
    const requestDate = requestDateStr ? new Date(requestDateStr).toISOString() : new Date().toISOString();
    
    // Parse customer information
    const firstName = extractNameField(adfXml, 'first');
    const lastName = extractNameField(adfXml, 'last');
    const email = extractSimpleField(adfXml, 'email');
    const phone = extractSimpleField(adfXml, 'phone');
    
    // Parse address
    const street = extractAddressField(adfXml, 'street');
    const city = extractAddressField(adfXml, 'city');
    const state = extractAddressField(adfXml, 'regioncode');
    const zipCode = extractAddressField(adfXml, 'postalcode');
    
    // Parse primary vehicle (interest="buy")
    const primaryVehicle = extractPrimaryVehicle(adfXml);
    
    // Parse trade-in vehicle info
    const tradeInInfo = extractTradeInVehicle(adfXml);
    
    const parsedData = {
      leadId,
      sdSessionId,
      formType,
      
      // Customer info
      firstName: firstName || null,
      lastName: lastName || null,
      email: email || null,
      phone: phone || null,
      
      // Address
      street: street || null,
      city: city || null,
      state: state || null,
      zipCode: zipCode || null,
      
      // Primary vehicle
      year: primaryVehicle?.year ? parseInt(primaryVehicle.year) : null,
      make: primaryVehicle?.make || null,
      model: primaryVehicle?.model || null,
      vin: primaryVehicle?.vin || null,
      stock: primaryVehicle?.stock || null,
      vehicleStatus: primaryVehicle?.status || null, // new/used
      
      // Financial info
      monthlyPayment: primaryVehicle?.monthlyPayment ? parseFloat(primaryVehicle.monthlyPayment) : null,
      totalAmount: primaryVehicle?.totalAmount ? parseFloat(primaryVehicle.totalAmount) : null,
      downPayment: primaryVehicle?.downPayment ? parseFloat(primaryVehicle.downPayment) : null,
      
      // Trade-in info
      tradeInYear: tradeInInfo?.year ? parseInt(tradeInInfo.year) : null,
      tradeInMake: tradeInInfo?.make || null,
      tradeInModel: tradeInInfo?.model || null,
      tradeInVin: tradeInInfo?.vin || null,
      tradeInValue: tradeInInfo?.value ? parseFloat(tradeInInfo.value) : null,
      tradeInMileage: tradeInInfo?.mileage ? parseInt(tradeInInfo.mileage) : null,
      
      requestDate,
      rawXml: adfXml
    };
    
    console.log('✅ Parsed lead data:', {
      leadId: parsedData.leadId,
      sdSessionId: parsedData.sdSessionId,
      customer: `${parsedData.firstName} ${parsedData.lastName}`,
      vehicle: `${parsedData.year} ${parsedData.make} ${parsedData.model}`,
      payment: parsedData.monthlyPayment
    });
    
    return parsedData;
    
  } catch (error) {
    console.error('❌ Error parsing ADF email:', error);
    return null;
  }
}

// Helper functions for parsing specific ADF fields
function extractIdBySource(xml: string, source: string): string | null {
  const pattern = new RegExp(`<id[^>]+source="${source}"[^>]*>([^<]+)<\\/id>`, 'i');
  const match = xml.match(pattern);
  return match ? match[1].trim() : null;
}

function extractSimpleField(xml: string, tagName: string): string | null {
  const pattern = new RegExp(
    `<${tagName}[^>]*>\\s*(?:<!\\[CDATA\\[([^\\]]+)\\]\\]>|([^<]+))\\s*<\\/${tagName}>`,
    'i'
  );
  const match = xml.match(pattern);
  return match ? (match[1] || match[2] || '').trim() : null;
}

function extractNameField(xml: string, part: string): string | null {
  const pattern = new RegExp(
    `<name[^>]+part="${part}"[^>]*>\\s*<!\\[CDATA\\[([^\\]]+)\\]\\]>\\s*<\\/name>`,
    'i'
  );
  const match = xml.match(pattern);
  return match ? match[1].trim() : null;
}

function extractAddressField(xml: string, fieldName: string): string | null {
  const pattern = new RegExp(
    `<${fieldName}[^>]*>\\s*<!\\[CDATA\\[([^\\]]+)\\]\\]>\\s*<\\/${fieldName}>`,
    'i'
  );
  const match = xml.match(pattern);
  return match ? match[1].trim() : null;
}

function extractPrimaryVehicle(xml: string): any {
  const vehiclePattern = /<vehicle[^>]+interest="buy"[^>]*>([\s\S]*?)<\/vehicle>/i;
  const vehicleMatch = xml.match(vehiclePattern);
  
  if (!vehicleMatch) return null;
  
  const vehicleXml = vehicleMatch[1];
  
  // Extract vehicle fields
  const year = extractSimpleField(vehicleXml, 'year');
  const make = extractSimpleField(vehicleXml, 'make');
  const model = extractSimpleField(vehicleXml, 'model');
  const vin = extractSimpleField(vehicleXml, 'vin');
  const stock = extractSimpleField(vehicleXml, 'stock');
  
  // Extract status from vehicle tag
  const statusMatch = xml.match(/<vehicle[^>]+status="([^"]+)"/i);
  const status = statusMatch ? statusMatch[1] : null;
  
  // Extract finance amounts
  const monthlyPayment = extractFinanceAmount(vehicleXml, 'monthly');
  const totalAmount = extractFinanceAmount(vehicleXml, 'total');
  const downPayment = extractFinanceAmount(vehicleXml, 'downpayment');
  
  return {
    year,
    make,
    model,
    vin,
    stock,
    status,
    monthlyPayment,
    totalAmount,
    downPayment
  };
}

function extractTradeInVehicle(xml: string): any {
  const tradePattern = /<vehicle[^>]+interest="trade-in"[^>]*>([\s\S]*?)<\/vehicle>/i;
  const tradeMatch = xml.match(tradePattern);
  
  if (!tradeMatch) return null;
  
  const tradeXml = tradeMatch[1];
  
  const year = extractSimpleField(tradeXml, 'year');
  const make = extractSimpleField(tradeXml, 'make');
  const model = extractSimpleField(tradeXml, 'model');
  const vin = extractSimpleField(tradeXml, 'vin');
  const mileage = extractSimpleField(tradeXml, 'odometer');
  
  // Extract trade value from price tag
  const valuePattern = /<price[^>]+type="appraisal"[^>]*>([^<]+)<\/price>/i;
  const valueMatch = tradeXml.match(valuePattern);
  const value = valueMatch ? valueMatch[1].replace(/[^\d.-]/g, '') : null;
  
  return {
    year,
    make,
    model,
    vin,
    mileage,
    value
  };
}

function extractFinanceAmount(xml: string, type: string): string | null {
  const pattern = new RegExp(`<amount[^>]+type="${type}"[^>]*>([^<]+)<\\/amount>`, 'i');
  const match = xml.match(pattern);
  return match ? match[1].replace(/[^\d.-]/g, '') : null;
}

// Helper function to send lead to Segment
async function sendLeadToSegment(leadData: any) {
  try {
    console.log('📊 Sending lead to Segment:', leadData.leadId);
    
    if (!analytics) {
      console.log('⚠️ Segment not enabled, skipping Segment event');
      return true;
    }
    
    const segmentEvent = {
      anonymousId: leadData.ajs_anonymous_id,
      event: 'Lead Submitted',
      properties: {
        // Source identification
        source: 'Gubagoo Virtual Retailing',
        leadId: leadData.leadId,
        leadType: leadData.formType,
        
        // Customer information (for profile matching)
        email: leadData.email,
        phone: leadData.phone,
        firstName: leadData.firstName,
        lastName: leadData.lastName,
        
        // Address
        street: leadData.street,
        city: leadData.city,
        state: leadData.state,
        zipCode: leadData.zipCode,
        
        // Attribution data
        utm_source: leadData.utm_source,
        utm_medium: leadData.utm_medium,
        utm_campaign: leadData.utm_campaign,
        utm_term: leadData.utm_term,
        utm_content: leadData.utm_content,
        gclid: leadData.gclid,
        fbclid: leadData.fbclid,
        referrer: leadData.referrer,
        landing_page: leadData.landing_page,
        
        // Vehicle information
        vehicle_year: leadData.year,
        vehicle_make: leadData.make,
        vehicle_model: leadData.model,
        vehicle_vin: leadData.vin,
        vehicle_stock: leadData.stock,
        vehicle_status: leadData.vehicleStatus,
        
        // Financial information
        monthly_payment: leadData.monthlyPayment,
        down_payment: leadData.downPayment,
        total_amount: leadData.totalAmount,
        
        // Trade-in information
        trade_in_year: leadData.tradeInYear,
        trade_in_make: leadData.tradeInMake,
        trade_in_model: leadData.tradeInModel,
        trade_in_vin: leadData.tradeInVin,
        trade_in_value: leadData.tradeInValue,
        trade_in_mileage: leadData.tradeInMileage,
        
        // Timing
        request_date: leadData.requestDate
      }
    };
    
    await analytics.track(segmentEvent);
    console.log('✅ Segment event sent successfully');
    
    return true;
  } catch (error) {
    console.error('❌ Error sending to Segment:', error);
    throw error;
  }
}

// Email processing endpoint for ADF/XML leads
app.post('/api/process-lead-email', upload.none(), async (req, res) => {
  try {
    console.log('📧 Received lead email for processing');
    console.log('📋 Content-Type:', req.headers['content-type']);
    
    // Extract email content (SendGrid format)
    const emailSubject = req.body.subject;
    const emailFrom = req.body.from;
    const emailTo = req.body.to;
    
    // Handle both direct JSON and raw email formats
    let emailBody = '';
    if (req.body.text) {
      // Direct text content (like your Gmail test)
      emailBody = req.body.text;
    } else if (req.body.email) {
      // Raw MIME email from SendGrid
      const rawEmail = req.body.email;
      const textMatch = rawEmail.match(/Content-Type: text\/plain[^]*?\r?\n\r?\n([^]*?)(?=\r?\n--|\r?\n\r?\nContent-Type|\r?\n$)/);
      if (textMatch) {
        emailBody = textMatch[1].trim();
      } else {
        const htmlMatch = rawEmail.match(/Content-Type: text\/html[^]*?\r?\n\r?\n([^]*?)(?=\r?\n--|\r?\n\r?\nContent-Type|\r?\n$)/);
        if (htmlMatch) {
          emailBody = htmlMatch[1].trim();
        }
      }
    }
    
    console.log('Email from:', emailFrom);
    console.log('Email subject:', emailSubject);
    console.log('Email body length:', emailBody ? emailBody.length : 0);
    
    // Parse ADF/XML from email body
    const leadData = await parseADFEmail(emailBody);
    
    if (!leadData) {
      return res.status(400).json({ error: 'Could not parse ADF/XML from email' });
    }
    
    if (!leadData.sdSessionId) {
      console.log('⚠️ No sdSessionId found in ADF data');
      await SupabaseService.savePendingLead({
        lead_id: leadData.leadId,
        sd_session_id: null,
        email_subject: emailSubject,
        email_body: emailBody.substring(0, 1000),
        lead_data: leadData
      });
      
      return res.json({ 
        success: true, 
        message: 'Lead saved as pending - no sdSessionId found',
        leadId: leadData.leadId 
      });
    }
    
    console.log('✅ Parsed lead data:', leadData);
    
    // Look up visitor data using session ID
    const visitorData = await SupabaseService.getMappingBySessionId(leadData.sdSessionId);
    
    if (!visitorData) {
      console.log('⚠️ No visitor data found for session ID:', leadData.sdSessionId);
      await SupabaseService.savePendingLead({
        lead_id: leadData.leadId,
        sd_session_id: leadData.sdSessionId,
        email_subject: emailSubject,
        email_body: emailBody.substring(0, 1000),
        lead_data: leadData
      });
      
      return res.json({ 
        success: true, 
        message: 'Lead saved as pending - no visitor data found',
        leadId: leadData.leadId 
      });
    }
    
    console.log('🎯 Found matching visitor data:', visitorData);
    
    // Combine lead data with visitor attribution
    const completeLeadData = {
      ...leadData,
      ajs_anonymous_id: visitorData.ajs_anonymous_id,
      gubagoo_visitor_uuid: visitorData.gubagoo_visitor_uuid,
      utm_source: visitorData.utm_source,
      utm_medium: visitorData.utm_medium,
      utm_campaign: visitorData.utm_campaign,
      utm_term: visitorData.utm_term,
      utm_content: visitorData.utm_content,
      gclid: visitorData.gclid,
      fbclid: visitorData.fbclid,
      referrer: visitorData.referrer,
      landing_page: visitorData.landing_page
    };
    
    // Save complete lead to database
    await SupabaseService.saveCompleteLead(completeLeadData);
    
    // Send to Segment with full attribution
    await sendLeadToSegment(completeLeadData);
    
    res.json({ 
      success: true, 
      message: 'Lead processed successfully with full attribution',
      leadId: leadData.leadId,
      attribution: {
        utm_source: visitorData.utm_source,
        utm_medium: visitorData.utm_medium,
        utm_campaign: visitorData.utm_campaign
      }
    });
    
  } catch (error) {
    console.error('❌ Error processing lead email:', error);
    res.status(500).json({ 
      error: 'Internal server error processing lead',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Stats endpoint (optional - for monitoring)
app.get('/api/stats', async (req, res) => {
  try {
    res.json({ 
      status: 'Server running',
      timestamp: new Date().toISOString(),
      segment_enabled: process.env.ENABLE_SEGMENT === 'true',
      segment_initialized: !!analytics,
      message: 'Stats endpoint ready for implementation'
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Serve test.html for testing
app.get('/test.html', (req, res) => {
  res.sendFile('test.html', { root: process.cwd() });
});

app.listen(PORT, () => {
  console.log(`🚀 Gubagoo Segment Mapper server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 Mapping endpoint: http://localhost:${PORT}/api/gubagoo-mapping`);
  console.log(`🧪 Test page: http://localhost:${PORT}/test.html`);
});