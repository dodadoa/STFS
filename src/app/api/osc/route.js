import { NextResponse } from 'next/server';
import dgram from 'dgram';

// OSC configuration
const OSC_HOST = process.env.OSC_HOST || '127.0.0.1';
const OSC_PORT = parseInt(process.env.OSC_PORT || '57120'); // PureData default

// Simple UDP socket for sending OSC messages
let udpSocket = null;

function initSocket() {
  if (udpSocket) return udpSocket;
  
  console.log(`[OSC] Initializing UDP socket to ${OSC_HOST}:${OSC_PORT}`);
  udpSocket = dgram.createSocket('udp4');
  
  udpSocket.on('error', (err) => {
    console.error('[OSC] Socket error:', err);
  });
  
  console.log('[OSC] Socket created successfully');
  return udpSocket;
}

// Simple OSC message encoder (minimal implementation)
function encodeOSC(address, args) {
  const parts = [];
  
  // Encode address (null-terminated, padded to 4 bytes)
  const addressBytes = Buffer.from(address + '\0', 'utf8');
  const addressPadded = Buffer.alloc(Math.ceil((addressBytes.length) / 4) * 4);
  addressBytes.copy(addressPadded);
  parts.push(addressPadded);
  
  // Type tag string (starts with comma, then types, null-terminated, padded to 4 bytes)
  let typeTag = ',';
  const argBuffers = [];
  
  for (const arg of args) {
    if (typeof arg === 'number') {
      if (Number.isInteger(arg)) {
        typeTag += 'i'; // integer
        const buf = Buffer.alloc(4);
        buf.writeInt32BE(arg, 0);
        argBuffers.push(buf);
      } else {
        typeTag += 'f'; // float
        const buf = Buffer.alloc(4);
        buf.writeFloatBE(arg, 0);
        argBuffers.push(buf);
      }
    } else if (typeof arg === 'string') {
      typeTag += 's';
      const strBytes = Buffer.from(arg + '\0', 'utf8');
      const strPadded = Buffer.alloc(Math.ceil((strBytes.length) / 4) * 4);
      strBytes.copy(strPadded);
      argBuffers.push(strPadded);
    }
  }
  
  // Encode type tag
  const typeTagBytes = Buffer.from(typeTag + '\0', 'utf8');
  const typeTagPadded = Buffer.alloc(Math.ceil((typeTagBytes.length) / 4) * 4);
  typeTagBytes.copy(typeTagPadded);
  parts.push(typeTagPadded);
  
  // Add argument buffers
  parts.push(...argBuffers);
  
  return Buffer.concat(parts);
}

export async function POST(request) {
  const startTime = Date.now();
  console.log(`[OSC] POST request received at ${new Date().toISOString()}`);
  
  try {
    const body = await request.json();
    const { address, args } = body;
    
    console.log(`[OSC] Message: address="${address || '/stfs'}", args=`, args || []);
    
    const socket = initSocket();
    const messageAddress = address || '/stfs';
    const messageArgs = args || [];
    
    // Encode OSC message
    const oscMessage = encodeOSC(messageAddress, messageArgs);
    console.log(`[OSC] Encoded message length: ${oscMessage.length} bytes`);
    
    // Send via UDP
    socket.send(oscMessage, OSC_PORT, OSC_HOST, (err) => {
      if (err) {
        console.error(`[OSC] Send error:`, err);
      } else {
        console.log(`[OSC] Message sent successfully to ${OSC_HOST}:${OSC_PORT}`);
      }
    });
    
    const duration = Date.now() - startTime;
    console.log(`[OSC] Request processed in ${duration}ms`);
    
    return NextResponse.json({ 
      success: true,
      address: messageAddress,
      args: messageArgs,
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
  return NextResponse.json({
    oscEnabled: true,
    host: OSC_HOST,
    port: OSC_PORT,
    socketCreated: udpSocket !== null
  });
}

