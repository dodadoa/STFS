import { NextResponse } from 'next/server';

// OSC configuration
const OSC_HOST = process.env.OSC_HOST || '127.0.0.1';
const OSC_PORT = parseInt(process.env.OSC_PORT || '57120'); // SuperCollider default

let oscClient = null;

// Initialize OSC client (server-side only)
if (typeof window === 'undefined') {
  try {
    const OSC = require('osc-js');
    oscClient = new OSC({ plugin: new OSC.DatagramPlugin() });
    oscClient.open({ host: OSC_HOST, port: OSC_PORT });
  } catch (error) {
    console.warn('OSC not available:', error.message);
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { address, args } = body;

    if (!oscClient) {
      return NextResponse.json({ error: 'OSC not initialized' }, { status: 500 });
    }

    // Send OSC message
    oscClient.send({
      address: address || '/stfs',
      args: args || []
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    oscEnabled: oscClient !== null,
    host: OSC_HOST,
    port: OSC_PORT
  });
}

