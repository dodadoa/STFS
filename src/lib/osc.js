/**
 * OSC (Open Sound Control) utility functions
 * Handles sending OSC messages to sound synthesis software
 */

let oscEnabled = false;
let lastOscSendTime = 0;

/**
 * Initialize OSC connection
 */
export async function initOSC() {
  try {
    const response = await fetch('/api/osc');
    const data = await response.json();
    oscEnabled = data.oscEnabled;
    if (data.oscEnabled) {
      console.log(`OSC enabled: ${data.host}:${data.port}`);
    }
    return data;
  } catch (error) {
    console.warn('OSC check failed:', error);
    oscEnabled = false;
    return { oscEnabled: false };
  }
}

/**
 * Send OSC message
 * @param {string} address - OSC address path
 * @param {Array} args - OSC message arguments
 */
export async function sendOSC(address, args) {
  if (!oscEnabled) return;
  
  try {
    await fetch('/api/osc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, args })
    });
  } catch (error) {
    console.warn('OSC send failed:', error);
  }
}

/**
 * Send collision event
 * @param {number} intensity - Collision intensity (0-1)
 * @param {number} throttleMs - Minimum time between sends (default: 50ms = 20Hz)
 */
export function sendCollisionEvent(intensity, throttleMs = 50) {
  const now = Date.now();
  if (now - lastOscSendTime > throttleMs) {
    lastOscSendTime = now;
    sendOSC('/stfs/collision', [intensity]);
  }
}

/**
 * Send top data for all tops
 * @param {Array} tops - Array of SpinningTop instances
 * @param {number} arenaRadius - Arena radius
 * @param {number} throttleMs - Minimum time between sends (default: 100ms = 10Hz)
 */
export function sendTopsData(tops, arenaRadius, throttleMs = 100) {
  const now = Date.now();
  if (now - lastOscSendTime > throttleMs && tops.length > 0) {
    lastOscSendTime = now;
    
    const centerX = arenaRadius + 50;
    const centerY = arenaRadius + 50;
    
    // Send individual top data
    tops.forEach((top, index) => {
      const distanceFromCenter = Math.sqrt(
        (top.x - centerX) ** 2 + (top.y - centerY) ** 2
      );
      const normalizedX = (top.x - centerX) / arenaRadius; // -1 to 1
      const normalizedY = (top.y - centerY) / arenaRadius; // -1 to 1
      const normalizedDistance = distanceFromCenter / arenaRadius; // 0 to 1
      const speed = Math.sqrt(top.vx ** 2 + top.vy ** 2);
      const normalizedSpeed = Math.min(speed / 10, 1.0); // Normalize speed
      
      sendOSC(`/stfs/top/${index}`, [
        normalizedX,           // X position (-1 to 1)
        normalizedY,           // Y position (-1 to 1)
        normalizedDistance,    // Distance from center (0 to 1)
        normalizedSpeed,       // Speed (0 to 1)
        top.angularVelocity,   // Angular velocity
        top.collisionFlash     // Collision flash intensity
      ]);
    });
  }
}

/**
 * Send summary data
 * @param {number} topCount - Number of active tops
 * @param {number} arenaFlash - Arena flash intensity (0-1)
 */
export function sendSummaryData(topCount, arenaFlash) {
  sendOSC('/stfs/summary', [
    topCount,      // Number of tops
    arenaFlash     // Arena flash intensity
  ]);
}

/**
 * Send spawn event
 * @param {number} x - Click X position
 * @param {number} y - Click Y position
 * @param {number} arenaRadius - Arena radius
 */
export function sendSpawnEvent(x, y, arenaRadius) {
  const normalizedX = (x - (arenaRadius + 50)) / arenaRadius;
  const normalizedY = (y - (arenaRadius + 50)) / arenaRadius;
  sendOSC('/stfs/spawn', [normalizedX, normalizedY]);
}

