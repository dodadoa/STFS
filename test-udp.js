#!/usr/bin/env node
/**
 * Simple UDP test script to verify connectivity from WSL2 to Windows
 * Usage: node test-udp.js [host] [port]
 */

const dgram = require('dgram');
const { execSync } = require('child_process');

// Get Windows host IP from WSL2
function getWindowsHostIP() {
  try {
    const result = execSync('ip route show | grep default', { encoding: 'utf8' });
    const match = result.match(/default via (\d+\.\d+\.\d+\.\d+)/);
    if (match && match[1]) {
      return match[1];
    }
  } catch (error) {
    console.warn('Could not detect Windows host IP from route:', error.message);
  }
  
  try {
    const fs = require('fs');
    const resolv = fs.readFileSync('/etc/resolv.conf', 'utf8');
    const match = resolv.match(/nameserver\s+(\d+\.\d+\.\d+\.\d+)/);
    if (match && match[1]) {
      return match[1];
    }
  } catch (error) {
    console.warn('Could not read /etc/resolv.conf:', error.message);
  }
  
  return null;
}

const HOST = process.argv[2] || getWindowsHostIP() || '127.0.0.1';
const PORT = parseInt(process.argv[3] || '57120');

console.log(`\n=== UDP Connectivity Test ===`);
console.log(`Target: ${HOST}:${PORT}`);
console.log(`From: WSL2`);
console.log(`\nTesting UDP connectivity...\n`);

const client = dgram.createSocket('udp4');

// Test message
const testMessage = Buffer.from('UDP_TEST_MESSAGE_FROM_WSL2');

let messagesSent = 0;
let messagesReceived = 0;

// Listen for responses (if the server responds)
client.on('message', (msg, rinfo) => {
  messagesReceived++;
  console.log(`✓ Received response from ${rinfo.address}:${rinfo.port}:`);
  console.log(`  Message: ${msg.toString()}`);
});

client.on('error', (err) => {
  console.error(`✗ Socket error: ${err.message}`);
  client.close();
  process.exit(1);
});

// Send test messages
function sendTest() {
  client.send(testMessage, PORT, HOST, (err) => {
    if (err) {
      console.error(`✗ Send error: ${err.message}`);
      client.close();
      process.exit(1);
    } else {
      messagesSent++;
      console.log(`✓ Message ${messagesSent} sent successfully to ${HOST}:${PORT}`);
    }
  });
}

// Send multiple test messages
console.log('Sending test messages...\n');
for (let i = 0; i < 5; i++) {
  setTimeout(() => {
    sendTest();
  }, i * 200);
}

// Wait a bit then close
setTimeout(() => {
  console.log(`\n=== Test Results ===`);
  console.log(`Messages sent: ${messagesSent}`);
  console.log(`Responses received: ${messagesReceived}`);
  console.log(`\nNote: If messages were sent but not received, check:`);
  console.log(`  1. Windows Firewall allows UDP on port ${PORT}`);
  console.log(`  2. The receiving program is actually listening on ${HOST}:${PORT}`);
  console.log(`  3. The receiving program is bound to 0.0.0.0 (all interfaces)`);
  console.log(`\nTo allow UDP in Windows Firewall, run in PowerShell (as Admin):`);
  console.log(`  New-NetFirewallRule -DisplayName "Allow UDP ${PORT}" -Direction Inbound -Protocol UDP -LocalPort ${PORT} -Action Allow\n`);
  
  client.close();
  process.exit(0);
}, 3000);

