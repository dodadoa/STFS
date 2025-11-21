# Spinning Top Battle Arena

An interactive physics simulation of spinning tops in a circular arena. Watch tops spiral toward the center, collide with realistic physics. Includes **OSC (Open Sound Control)** support for integration with SuperCollider, PureData, and PuckData.

## Features

- **Interactive Spawning**: Click anywhere in the circular arena to spawn spinning tops
- **Realistic Physics**: 
  - Spiral movement toward center based on spin direction
  - Elastic collisions with momentum, spin, and gravitational energy
  - Velocity decay over time
  - Smooth boundary collisions
- **Visual Feedback**:
  - Direction arrows showing movement vector for each top
  - Arena-wide white strobe flash on collisions
  - Black and white minimalist design
- **Auto-Cleanup**: Tops automatically disappear when they exit the arena or stop moving
- **OSC Support**: Send real-time data to sound synthesis software

## Getting Started

First, install dependencies:

```bash
npm install
```

Then, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the simulation.

## How to Use

1. **Spawn Tops**: Click anywhere inside the circular arena to spawn a spinning top
2. **Multiple Tops**: Keep clicking to add more tops - they will interact with each other
3. **Select Top**: Click on an existing top to select it and view its details (position, velocity, direction vector)
4. **Watch the Battle**: Tops will spiral toward the center, collide with each other, and the arena will flash white on impacts

## OSC (Open Sound Control) Integration

The simulation sends OSC messages that can be received by SuperCollider, PureData, PuckData, or any OSC-compatible software.

### Configuration

Set environment variables to configure OSC (defaults to SuperCollider):

```bash
OSC_HOST=127.0.0.1  # OSC server host (default: 127.0.0.1)
OSC_PORT=57120      # OSC server port (default: 57120 - SuperCollider)
```

Or create a `.env.local` file:

```
OSC_HOST=127.0.0.1
OSC_PORT=57120
```

### OSC Messages

#### `/stfs/spawn` - Top Spawned
Sent when a new top is created.

**Arguments:**
- `x` (float): Normalized X position (-1 to 1)
- `y` (float): Normalized Y position (-1 to 1)

#### `/stfs/collision` - Collision Detected
Sent when tops collide (throttled to 20Hz).

**Arguments:**
- `intensity` (float): Collision intensity (0 to 1)

#### `/stfs/top/{index}` - Individual Top Data
Sent for each top at 10Hz update rate.

**Arguments:**
- `x` (float): Normalized X position (-1 to 1)
- `y` (float): Normalized Y position (-1 to 1)
- `distance` (float): Distance from center (0 to 1)
- `speed` (float): Normalized speed (0 to 1)
- `angularVelocity` (float): Angular velocity (spin rate)
- `collisionFlash` (float): Collision flash intensity (0 to 1)

#### `/stfs/summary` - Summary Data
Sent at 10Hz with overall simulation state.

**Arguments:**
- `topCount` (int): Number of active tops
- `arenaFlash` (float): Arena flash intensity (0 to 1)

### SuperCollider Example

```supercollider
// Receive OSC messages
OSCdef(\spawn, { |msg|
    var x = msg[1], y = msg[2];
    ("Top spawned at: " ++ x ++ ", " ++ y).postln;
}, '/stfs/spawn');

OSCdef(\collision, { |msg|
    var intensity = msg[1];
    // Trigger sound on collision
    { SinOsc.ar(440 * (1 + intensity), 0, 0.1) * EnvGen.kr(Env.perc(0.01, 0.1), doneAction: 2) }.play;
}, '/stfs/collision');

OSCdef(\top, { |msg|
    var x = msg[1], y = msg[2], distance = msg[3], speed = msg[4];
    // Map position to panning, distance to frequency
    var pan = x;
    var freq = 200 + (distance * 800);
    // Continuous sound based on top position
}, '/stfs/top/0');
```

### PureData Example

1. Create an `[udpreceive 57120]` object
2. Connect to `[route /stfs]` to route messages
3. Use `[unpack f f]` to unpack arguments
4. Map values to your synthesis parameters

### PuckData Example

```javascript
// In PuckData
OSC.listen(57120, (msg) => {
  if (msg.address === '/stfs/collision') {
    // Trigger sound on collision
    playSound(440, msg.args[0]);
  }
  
  if (msg.address.startsWith('/stfs/top/')) {
    const [x, y, distance, speed] = msg.args;
    // Map to synthesis parameters
    setPan(x);
    setFrequency(200 + distance * 800);
  }
});
```

## License
MIT license
