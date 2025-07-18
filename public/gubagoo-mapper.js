(function() {
    'use strict';
    
    // Configuration
    const CONFIG = {
        // This will be your Vercel URL later, for now it's localhost
        API_ENDPOINT: 'http://localhost:3000/api/gubagoo-mapping',
        GUBAGOO_DOMAIN: 'cbo-ui.gubagoo.io',
        DEBUG: true // Set to false in production
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
        // Try multiple ways to get Segment's anonymous ID
        if (window.analytics && window.analytics.user) {
            return window.analytics.user().anonymousId();
        }
        
        // Fallback: check localStorage for Segment's ajs_anonymous_id
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
            const maxAttempts = 50; // Try for 5 seconds
            
            function checkForUuid() {
                attempts++;
                
                try {
                    // Method 1: Check if Gubagoo iframe exists
                    const gubagooIframe = document.querySelector('iframe[src*="gubagoo"]');
                    if (gubagooIframe) {
                        log('Found Gubagoo iframe, but cannot access cross-domain localStorage');
                    }
                    
                    // Method 2: Check for Gubagoo global variables
                    if (window.GUBAGOO && window.GUBAGOO.visitorId) {
                        log('Found Gubagoo visitor ID via global variable');
                        resolve(window.GUBAGOO.visitorId);
                        return;
                    }
                    
                    // Method 3: Check for visitor UUID in page HTML/scripts
                    const scripts = document.querySelectorAll('script');
                    for (let script of scripts) {
                        if (script.textContent && script.textContent.includes('visitor_uuid')) {
                            const match = script.textContent.match(/visitor_uuid['":\s]*['"]([^'"]+)['"]/);
                            if (match) {
                                log('Found visitor UUID in script tag');
                                resolve(match[1]);
                                return;
                            }
                        }
                    }
                    
                    // Method 4: Listen for postMessage from Gubagoo iframe
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
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            log('Mapping data sent successfully:', result);
            return result;
            
        } catch (error) {
            log('Error sending mapping data:', error);
            throw error;
        }
    }
    
    // Main execution function
    async function initGubagooMapper() {
        log('Initializing Gubagoo Segment Mapper...');
        
        // Get URL parameters (UTM, etc.)
        const urlParams = getUrlParams();
        log('URL parameters:', urlParams);
        
        // Get Segment anonymous ID
        const segmentId = getSegmentAnonymousId();
        if (!segmentId) {
            log('Warning: Could not find Segment anonymous ID');
            return;
        }
        log('Segment anonymous ID:', segmentId);
        
        // Wait for Gubagoo visitor UUID
        log('Waiting for Gubagoo visitor UUID...');
        const gubagooUuid = await getGubagooVisitorUuid();
        
        if (!gubagooUuid) {
            log('Warning: Could not find Gubagoo visitor UUID - visitor may not have interacted with widget yet');
            return;
        }
        
        log('Gubagoo visitor UUID:', gubagooUuid);
        
        // Prepare mapping data
        const mappingData = {
            ajs_anonymous_id: segmentId,
            gubagoo_visitor_uuid: gubagooUuid,
            ...urlParams,
            referrer: document.referrer,
            landing_page: window.location.href,
            page_url: window.location.href
        };
        
        log('Sending mapping data:', mappingData);
        
        // Send to server
        try {
            await sendMappingData(mappingData);
            log('✅ Gubagoo mapping completed successfully!');
        } catch (error) {
            log('❌ Failed to send mapping data:', error);
        }
    }
    
    // Wait for page to load, then initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initGubagooMapper);
    } else {
        // DOM already loaded
        setTimeout(initGubagooMapper, 1000); // Give Segment time to load
    }
    
    // Also try again after a delay in case Gubagoo loads later
    setTimeout(initGubagooMapper, 5000);
    
    log('Gubagoo Segment Mapper script loaded');
})();