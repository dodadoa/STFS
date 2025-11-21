import { NextResponse } from 'next/server';
import { execSync } from 'child_process';
import fs from 'fs';

// Function to get Windows host IP from WSL2
function getWindowsHostIP() {
  try {
    // In WSL2, the Windows host IP is typically the first IP in the route to the default gateway
    // We can get it from the default route
    const result = execSync('ip route show | grep default', { encoding: 'utf8' });
    const match = result.match(/default via (\d+\.\d+\.\d+\.\d+)/);
    if (match && match[1]) {
      return match[1];
    }
  } catch (error) {
    console.warn('[OSC] Could not detect Windows host IP from route:', error.message);
  }
  
  // Fallback: try to get from /etc/resolv.conf (WSL2 stores host IP there)
  try {
    const resolv = fs.readFileSync('/etc/resolv.conf', 'utf8');
    const match = resolv.match(/nameserver\s+(\d+\.\d+\.\d+\.\d+)/);
    if (match && match[1]) {
      return match[1];
    }
  } catch (error) {
    console.warn('[OSC] Could not read /etc/resolv.conf:', error.message);
  }
  
  return null;
}

// Detect if we're in WSL2
function isWSL2() {
  try {
    const release = fs.readFileSync('/proc/version', 'utf8');
    return release.includes('microsoft') || release.includes('WSL');
  } catch {
    return false;
  }
}

// OSC configuration
// In WSL2, use Windows host IP; otherwise use localhost
let defaultHost = '127.0.0.1';
if (typeof window === 'undefined') {
  if (isWSL2()) {
    const hostIP = getWindowsHostIP();
    if (hostIP) {
      defaultHost = hostIP;
      console.log(`[OSC] Detected WSL2 environment, using Windows host IP: ${hostIP}`);
    } else {
      console.warn(`[OSC] WSL2 detected but could not find Windows host IP, using 127.0.0.1`);
      console.warn(`[OSC] You may need to set OSC_HOST environment variable to your Windows IP`);
    }
  }
}

const OSC_HOST = process.env.OSC_HOST || defaultHost;
const OSC_PORT = parseInt(process.env.OSC_PORT || '57120'); // PureData default

console.log(`[OSC] Configuration: HOST=${OSC_HOST}, PORT=${OSC_PORT}`);

let oscClient = null;
let OSC = null; // Store the OSC class for creating messages
let oscInitialized = false;
let oscInitError = null;
let initPromise = null;
let socketReady = false; // Track if socket is actually open

// Initialize OSC client
async function initOSC() {
  if (oscInitialized && socketReady) return;
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
      
      // Create plugin with remote address configuration
      const plugin = new OSC.DatagramPlugin({
        send: {
          host: OSC_HOST,
          port: OSC_PORT
        }
      });
      
      oscClient = new OSC({ plugin: plugin });
      
      // Wait for socket to open before marking as ready
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Socket open timeout'));
        }, 5000);
        
        oscClient.on('open', () => {
          clearTimeout(timeout);
          socketReady = true;
          console.log(`[OSC] Socket opened successfully, ready to send to ${OSC_HOST}:${OSC_PORT}`);
          resolve();
        });
        
        oscClient.on('error', (error) => {
          clearTimeout(timeout);
          console.error(`[OSC] Client error:`, error);
          reject(error);
        });
        
        console.log(`[OSC] Opening connection...`);
        // Open without specifying host/port - plugin handles remote address
        oscClient.open();
      });
      
      oscInitialized = true;
      console.log(`[OSC] Initialization complete`);
    } catch (error) {
      console.error('[OSC] Initialization error:', error);
      console.error('[OSC] Error stack:', error.stack);
      oscInitError = error.message;
      oscClient = null;
      OSC = null;
      socketReady = false;
      oscInitialized = true; // Mark as initialized so we don't keep retrying
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
    
    if (!oscClient || !socketReady) {
      console.error(`[OSC] Client not available or socket not ready`);
      return NextResponse.json({ 
        error: 'OSC not initialized', 
        details: oscInitError || 'OSC client failed to initialize or socket not ready'
      }, { status: 503 });
    }
    
    // Send OSC message using osc-js
    console.log(`[OSC] Creating OSC.Message with address="${address}" and args=`, args);
    try {
      // Create OSC.Message object - pass address as first arg, then all args
      const message = new OSC.Message(address, ...args);
      console.log(`[OSC] Message created, sending to ${OSC_HOST}:${OSC_PORT}...`);
      console.log(`[OSC] Socket ready: ${socketReady}, Client state:`, oscClient.state || 'unknown');
      
      // Send message - remote address is configured in the plugin
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
      socketReady: socketReady,
      error: oscInitError || null,
      firewallTest: `To test firewall, run: node test-udp.js ${OSC_HOST} ${OSC_PORT}`
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

