import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { SupabaseService } from './utils/supabase';
import { GubagooSegmentMapping } from './types';

dotenv.config();

console.log('🔍 Debug Environment Variables:');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'Found' : 'MISSING');
console.log('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? 'Found' : 'MISSING');
console.log('Current working directory:', process.cwd());


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

app.get('/test.html', (req, res) => {
  res.sendFile('test.html', { root: process.cwd() });
});

app.listen(PORT, () => {
  console.log(`🚀 Gubagoo Segment Mapper server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 Mapping endpoint: http://localhost:${PORT}/api/gubagoo-mapping`);
});