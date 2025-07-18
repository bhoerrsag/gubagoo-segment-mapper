import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

// DEBUG: Check if env vars are loading
console.log('🔍 Debug Environment Variables:');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'Found' : 'MISSING');
console.log('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? 'Found' : 'MISSING');
console.log('Current working directory:', process.cwd());

import { SupabaseService } from './utils/supabase';
import { GubagooSegmentMapping } from './types';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: ['https://sportsubarusouth.com', 'http://localhost:3000', 'http://localhost:3001'],
  credentials: true
}));
app.use(express.json());
app.use(express.static('public'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Serve the gubagoo-mapper.js script directly
app.get('/gubagoo-mapper.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
  
  const scriptContent = `
(function() {
    'use strict';
    
    // Configuration
    const CONFIG = {
        API_ENDPOINT: 'https://gubagoo-segment-mapper.vercel.app/api/gubagoo-mapping',
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
    
    function getGubagooVisitorUuid() {
        return new Promise((resolve) => {
            let attempts = 0;
            const maxAttempts = 50;
            
            function checkForUuid() {
                attempts++;
                
                try {
                    const gubagooIframe = document.querySelector('iframe[src*="gubagoo"]');
                    if (gubagooIframe) {
                        log('Found Gubagoo iframe, but cannot access cross-domain localStorage');
                    }
                    
                    if (window.GUBAGOO && window.GUBAGOO.visitorId) {
                        log('Found Gubagoo visitor ID via global variable');
                        resolve(window.GUBAGOO.visitorId);
                        return;
                    }
                    
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
                    
                    window.addEventListener('message', function(event) {
                        if (event.origin.includes('gubagoo') && event.data && event.data.visitor_uuid) {
                            log('Received visitor UUID via postMessage');
                            resolve(event.data.visitor_uuid);
                            return;
                        }
                    });
                    
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

// Stats endpoint (optional - for monitoring)
app.get('/api/stats', async (req, res) => {
  try {
    // You can add database queries here to get stats
    res.json({ 
      status: 'Server running',
      timestamp: new Date().toISOString(),
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