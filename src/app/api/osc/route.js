import { NextResponse } from 'next/server';

// OSC configuration
const OSC_HOST = process.env.OSC_HOST || '127.0.0.1';
const OSC_PORT = parseInt(process.env.OSC_PORT || '57120'); // PureData default

let oscClient = null;
let OSC = null; // Store the OSC class for creating messages
let oscInitialized = false;
let oscInitError = null;
let initPromise = null;

// Initialize OSC client
async function initOSC() {
  if (oscInitialized) return;
  if (typeof window !== 'undefined') return;
  
  if (initPromise) {
    return initPromise;
  }
  
  initPromise = (async () => {
    try {
      console.log(`[OSC] Loading osc-js module...`);
      const oscModule = await import('osc-js');
      OSC = oscModule.default || oscModule;
      
      console.log(`[OSC] Creating OSC client with DatagramPlugin`);
      console.log(`[OSC] Target: ${OSC_HOST}:${OSC_PORT}`);
      
      oscClient = new OSC({ plugin: new OSC.DatagramPlugin() });
      
      // Set up event listeners for debugging
      oscClient.on('open', () => {
        console.log(`[OSC] Socket opened successfully`);
      });
      
      oscClient.on('error', (error) => {
        console.error(`[OSC] Client error:`, error);
      });
      
      console.log(`[OSC] Opening connection...`);
      oscClient.open({ 
        host: OSC_HOST, 
        port: OSC_PORT,
        metadata: true 
      });
      
      oscInitialized = true;
      console.log(`[OSC] Initialization complete`);
    } catch (error) {
      console.error('[OSC] Initialization error:', error);
      console.error('[OSC] Error stack:', error.stack);
      oscInitError = error.message;
      oscClient = null;
      OSC = null;
      oscInitialized = true;
    } finally {
      initPromise = null;
    }
  })();
  
  return initPromise;
}

export async function POST(request) {
  const startTime = Date.now();
  console.log(`[OSC] POST request received at ${new Date().toISOString()}`);
  
  try {
    // Check if request has a body
    const contentType = request.headers.get('content-type');
    console.log(`[OSC] Content-Type: ${contentType}`);
    
    let body = {};
    let address = '/stfs';
    let args = [];
    
    // Only try to parse JSON if content-type indicates JSON
    if (contentType && contentType.includes('application/json')) {
      try {
        const text = await request.text();
        console.log(`[OSC] Request body text: "${text}"`);
        
        if (text && text.trim().length > 0) {
          body = JSON.parse(text);
          address = body.address || '/stfs';
          args = body.args || [];
        } else {
          console.log(`[OSC] Empty body, using defaults`);
        }
      } catch (parseError) {
        console.error(`[OSC] JSON parse error:`, parseError.message);
        return NextResponse.json({ 
          error: 'Invalid JSON in request body',
          details: parseError.message
        }, { status: 400 });
      }
    } else {
      console.log(`[OSC] No JSON content-type, using defaults`);
    }
    
    console.log(`[OSC] Message: address="${address}", args=`, args);
    
    // Initialize OSC client
    await initOSC();
    
    if (!oscClient) {
      console.error(`[OSC] Client not available`);
      return NextResponse.json({ 
        error: 'OSC not initialized', 
        details: oscInitError || 'OSC client failed to initialize'
      }, { status: 503 });
    }
    
    // Send OSC message using osc-js
    console.log(`[OSC] Creating OSC.Message with address="${address}" and args=`, args);
    try {
      // Create OSC.Message object - pass address as first arg, then all args
      const message = new OSC.Message(address, ...args);
      console.log(`[OSC] Message created, sending...`);
      
      oscClient.send(message);
      console.log(`[OSC] Message sent successfully to ${OSC_HOST}:${OSC_PORT}`);
    } catch (sendError) {
      console.error(`[OSC] Send error:`, sendError);
      console.error(`[OSC] Send error stack:`, sendError.stack);
      throw sendError;
    }
    
    const duration = Date.now() - startTime;
    console.log(`[OSC] Request processed in ${duration}ms`);
    
    return NextResponse.json({ 
      success: true,
      address: address,
      args: args,
      sentTo: `${OSC_HOST}:${OSC_PORT}`
    });
  } catch (error) {
    console.error('[OSC] POST error:', error);
    console.error('[OSC] Error stack:', error.stack);
    return NextResponse.json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}

export async function GET() {
  console.log(`[OSC] GET request received`);
  try {
    await initOSC();
    
    return NextResponse.json({
      oscEnabled: oscClient !== null,
      host: OSC_HOST,
      port: OSC_PORT,
      initialized: oscInitialized,
      error: oscInitError || null
    });
  } catch (error) {
    console.error('[OSC] GET error:', error);
    return NextResponse.json({
      oscEnabled: false,
      host: OSC_HOST,
      port: OSC_PORT,
      error: error.message
    }, { status: 500 });
  }
}

