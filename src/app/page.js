'use client';

import { useState, useRef, useEffect } from 'react';

// Black and white color palette only
const TOP_COLORS = [
  { primary: '#000000', secondary: '#000000', accent: '#ffffff' }, // Black with white accent
  { primary: '#ffffff', secondary: '#ffffff', accent: '#000000' }, // White with black accent
];

let topColorIndex = 0;

class SpinningTop {
  constructor(x, y, arenaRadius) {
    this.x = x;
    this.y = y;
    this.vx = (Math.random() - 0.5) * 2; // Random initial velocity (slower)
    this.vy = (Math.random() - 0.5) * 2;
    this.angle = Math.random() * Math.PI * 2; // Rotation angle
    this.angularVelocity = (Math.random() - 0.5) * 1; // Spinning speed (strong)
    this.radius = 12; // Top size (smaller)
    this.mass = 1; // Mass for collision physics
    this.arenaRadius = arenaRadius;
    this.gravityStrength = 0.001; // How strong the center gravity is (less gravitating)
    this.friction = 0.98; // Friction coefficient
    this.velocityDecay = 0.995; // Cumulative velocity loss per frame
    this.restitution = 0.8; // Bounciness (0-1, 1 = perfectly elastic)
    this.selected = false;
    this.shouldRemove = false; // Flag to mark top for removal
    this.collisionFlash = 0; // Flash intensity when colliding (0-1)
    // Assign a distinct color to each top
    this.color = TOP_COLORS[topColorIndex % TOP_COLORS.length];
    topColorIndex++;
  }

  checkCollision(other) {
    const dx = other.x - this.x;
    const dy = other.y - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const minDistance = this.radius + other.radius;
    
    return distance < minDistance;
  }

  resolveCollision(other) {
    // Calculate collision normal
    const dx = other.x - this.x;
    const dy = other.y - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance === 0) return; // Avoid division by zero
    
    const normalX = dx / distance;
    const normalY = dy / distance;
    
    // Separate overlapping tops
    const overlap = (this.radius + other.radius) - distance;
    if (overlap > 0) {
      const separationX = normalX * overlap * 0.5;
      const separationY = normalY * overlap * 0.5;
      this.x -= separationX;
      this.y -= separationY;
      other.x += separationX;
      other.y += separationY;
    }
    
    // Calculate relative velocity
    const relativeVx = other.vx - this.vx;
    const relativeVy = other.vy - this.vy;
    
    // Calculate relative velocity along collision normal
    const relativeSpeed = relativeVx * normalX + relativeVy * normalY;
    
    // Don't resolve if objects are separating too fast
    if (relativeSpeed > 0.1) return;
    
    // Calculate spin contribution to collision force (stronger)
    // Spinning tops transfer angular momentum to linear momentum
    const spinForce1 = this.angularVelocity * this.radius * 0.5;
    const spinForce2 = other.angularVelocity * other.radius * 0.5;
    const totalSpinForce = (spinForce1 + spinForce2) * 1.5;
    
    // Calculate direction-based force (momentum from movement) - stronger
    const thisSpeed = Math.sqrt(this.vx ** 2 + this.vy ** 2);
    const otherSpeed = Math.sqrt(other.vx ** 2 + other.vy ** 2);
    const directionForce = (thisSpeed + otherSpeed) * 1.2;
    
    // Calculate gravitational contribution (tops closer to center have more energy) - stronger
    const centerX = this.arenaRadius;
    const centerY = this.arenaRadius;
    const thisDistFromCenter = Math.sqrt((this.x - centerX) ** 2 + (this.y - centerY) ** 2);
    const otherDistFromCenter = Math.sqrt((other.x - centerX) ** 2 + (other.y - centerY) ** 2);
    const avgDistFromCenter = (thisDistFromCenter + otherDistFromCenter) / 2;
    const gravityForce = this.gravityStrength * avgDistFromCenter * 200; // Scale gravity contribution (stronger)
    
    // Combine all forces for realistic collision with stronger push
    const totalMass = this.mass + other.mass;
    const baseImpulse = (2 * Math.abs(relativeSpeed) * this.restitution * 2) / totalMass; // 2x base impulse
    const enhancedImpulse = baseImpulse + totalSpinForce + directionForce + gravityForce;
    
    // Apply impulse to velocities (always push away)
    const impulseX = enhancedImpulse * normalX;
    const impulseY = enhancedImpulse * normalY;
    
    this.vx -= impulseX * other.mass / totalMass;
    this.vy -= impulseY * other.mass / totalMass;
    other.vx += impulseX * this.mass / totalMass;
    other.vy += impulseY * this.mass / totalMass;
    
    // Transfer spin between tops based on collision (stronger)
    const spinTransfer = Math.abs(relativeSpeed) * 0.3;
    const spinDirection = Math.sign(this.angularVelocity - other.angularVelocity);
    this.angularVelocity -= spinDirection * spinTransfer * 0.8;
    other.angularVelocity += spinDirection * spinTransfer * 0.8;
    
    // Add spin change from collision impact (stronger)
    const impactSpin = Math.abs(relativeSpeed) * 0.5;
    this.angularVelocity += (Math.random() - 0.5) * impactSpin;
    other.angularVelocity += (Math.random() - 0.5) * impactSpin;
    
    // Trigger arena flash - this will be set in the draw loop
    this.collisionFlash = 1.0;
    other.collisionFlash = 1.0;
  }

  update(allTops, myIndex) {
    // Calculate distance from center (arena center is at arenaRadius + 50)
    const centerX = this.arenaRadius + 50;
    const centerY = this.arenaRadius + 50;
    const dx = centerX - this.x;
    const dy = centerY - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Create spiral movement: combine spin direction with gravity
    // The top moves in a spiral because it's spinning while being pulled toward center
    if (distance > 0) {
      // Normalized direction to center
      const toCenterX = dx / distance;
      const toCenterY = dy / distance;
      
      // Tangential direction (perpendicular to center direction) based on spin
      // This creates the spiral effect
      const tangentialX = -toCenterY; // Perpendicular to radial direction
      const tangentialY = toCenterX;
      
      // Spin direction affects the tangential movement
      const spinDirection = Math.sign(this.angularVelocity); // Clockwise or counterclockwise
      const tangentialForce = Math.abs(this.angularVelocity) * 0.2; // Spiral strength
      
      // Apply tangential force smoothly (creates spiral)
      const smoothFactor = 0.8; // Smoothing factor for gradual changes
      this.vx += tangentialX * tangentialForce * spinDirection * smoothFactor;
      this.vy += tangentialY * tangentialForce * spinDirection * smoothFactor;
      
      // Apply gravity toward center (radial force) smoothly
      const gravityForce = this.gravityStrength * distance;
      this.vx += toCenterX * gravityForce * smoothFactor;
      this.vy += toCenterY * gravityForce * smoothFactor;
    }

    // Apply friction (smoother)
    this.vx *= this.friction;
    this.vy *= this.friction;
    
    // Cumulative velocity loss - gradually slow down over time
    this.vx *= this.velocityDecay;
    this.vy *= this.velocityDecay;
    
    // Also reduce angular velocity over time (spinning slows down)
    this.angularVelocity *= this.velocityDecay;
    
    // Fade collision flash over time
    this.collisionFlash = Math.max(0, this.collisionFlash - 0.15); // Fade out over ~7 frames

    // Check if velocity is near zero - if so, mark for removal
    const speed = Math.sqrt(this.vx ** 2 + this.vy ** 2);
    const minSpeed = 0.1; // Minimum speed threshold
    if (speed < minSpeed && Math.abs(this.angularVelocity) < 0.01) {
      this.shouldRemove = true;
      return;
    }

    // Update position smoothly
    this.x += this.vx;
    this.y += this.vy;

    // Check if top is outside circular arena - if so, mark for removal
    const distanceFromCenter = Math.sqrt(
      (this.x - centerX) ** 2 + (this.y - centerY) ** 2
    );
    
    // If top is completely outside the circular arena boundary, mark it for removal
    if (distanceFromCenter > this.arenaRadius + this.radius) {
      this.shouldRemove = true;
      return;
    }
    
    // Smooth boundary collision - soft bounce off arena walls
    const boundaryDistance = distanceFromCenter + this.radius;
    const boundaryThreshold = this.arenaRadius;
    
    if (boundaryDistance > boundaryThreshold) {
      // Create a soft boundary zone for smoother collision
      const penetration = boundaryDistance - boundaryThreshold;
      const softZone = this.radius * 2; // Soft zone size
      const softness = Math.min(penetration / softZone, 1); // 0 to 1
      
      // Gradually push back toward arena
      const angle = Math.atan2(this.y - centerY, this.x - centerX);
      const pushBackForce = softness * 0.3; // Gentle push back
      this.x -= Math.cos(angle) * pushBackForce;
      this.y -= Math.sin(angle) * pushBackForce;
      
      // Smooth velocity reflection (less bouncy, more gradual)
      const normalAngle = angle;
      const speed = Math.sqrt(this.vx ** 2 + this.vy ** 2);
      
      // Calculate velocity component toward wall
      const towardWall = this.vx * Math.cos(normalAngle) + this.vy * Math.sin(normalAngle);
      
      // Only reflect if moving toward wall (smooth reflection)
      if (towardWall > 0) {
        const reflectionDamping = 0.85; // Less bouncy, smoother
        const reflectedVx = this.vx - 2 * towardWall * Math.cos(normalAngle) * reflectionDamping;
        const reflectedVy = this.vy - 2 * towardWall * Math.sin(normalAngle) * reflectionDamping;
        
        // Smoothly transition to reflected velocity
        const transitionSpeed = 0.3; // Gradual transition
        this.vx = this.vx * (1 - transitionSpeed) + reflectedVx * transitionSpeed;
        this.vy = this.vy * (1 - transitionSpeed) + reflectedVy * transitionSpeed;
      }
      
      // Ensure top stays within bounds
      if (distanceFromCenter > this.arenaRadius - this.radius) {
        this.x = centerX + Math.cos(angle) * (this.arenaRadius - this.radius);
        this.y = centerY + Math.sin(angle) * (this.arenaRadius - this.radius);
      }
    }

    // Check collisions with other tops (only check tops after this one to avoid double-processing)
    if (allTops && myIndex !== undefined) {
      for (let i = myIndex + 1; i < allTops.length; i++) {
        const other = allTops[i];
        if (other !== this && this.checkCollision(other)) {
          this.resolveCollision(other);
        }
      }
    }

    // Update rotation
    this.angle += this.angularVelocity;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    // Draw main circle with normal color
    ctx.fillStyle = this.color.primary;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fill();

    // Draw outer ring with opposite color (strong contrast)
    ctx.strokeStyle = this.color.accent;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.stroke();

    // Draw inner circle with accent color (strong contrast)
    ctx.fillStyle = this.color.accent;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius * 0.6, 0, Math.PI * 2);
    ctx.fill();

    // Draw white border
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.stroke();

    // Draw spinning effect with black and white (strong contrast)
    ctx.lineWidth = 1;
    const numSpokes = 6;
    for (let i = 0; i < numSpokes; i++) {
      const angle = (this.angle * 2 + (i * Math.PI * 2) / numSpokes) % (Math.PI * 2);
      // Alternate between white and opposite of primary color
      ctx.strokeStyle = i % 2 === 0 ? '#ffffff' : (this.color.primary === '#000000' ? '#ffffff' : '#000000');
      ctx.beginPath();
      ctx.moveTo(
        Math.cos(angle) * this.radius * 0.3,
        Math.sin(angle) * this.radius * 0.3
      );
      ctx.lineTo(
        Math.cos(angle) * this.radius * 0.9,
        Math.sin(angle) * this.radius * 0.9
      );
      ctx.stroke();
    }

    // Draw center dot
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, Math.PI * 2);
    ctx.fill();

    // Draw selection indicator (outer ring in white)
    if (this.selected) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + 4, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  drawVelocityArrow(ctx) {
    // Always draw arrow, even if speed is very low
    const speed = Math.sqrt(this.vx ** 2 + this.vy ** 2);
    
    // Get direction vector, use default direction if speed is zero
    let vector;
    if (speed < 0.01) {
      // If no velocity, point in a default direction (e.g., right)
      vector = { x: 1, y: 0 };
    } else {
      vector = this.getDirectionVector();
    }
    
    // Smaller arrow length, scale with speed
    const baseLength = 25;
    const speedLength = Math.min(speed * 8, 40);
    const arrowLength = Math.max(baseLength, speedLength);
    
    ctx.save();
    // Use black/white for arrow (strong contrast)
    ctx.strokeStyle = this.selected ? '#ffffff' : (this.color.primary === '#000000' ? '#ffffff' : '#000000');
    ctx.lineWidth = 1;
    ctx.shadowBlur = 0;
    
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(
      this.x + vector.x * arrowLength,
      this.y + vector.y * arrowLength
    );
    ctx.stroke();

    // Draw smaller arrowhead
    const arrowAngle = Math.atan2(vector.y, vector.x);
    const arrowHeadLength = 8;
    ctx.beginPath();
    ctx.moveTo(
      this.x + vector.x * arrowLength,
      this.y + vector.y * arrowLength
    );
    ctx.lineTo(
      this.x + vector.x * arrowLength - arrowHeadLength * Math.cos(arrowAngle - Math.PI / 6),
      this.y + vector.y * arrowLength - arrowHeadLength * Math.sin(arrowAngle - Math.PI / 6)
    );
    ctx.moveTo(
      this.x + vector.x * arrowLength,
      this.y + vector.y * arrowLength
    );
    ctx.lineTo(
      this.x + vector.x * arrowLength - arrowHeadLength * Math.cos(arrowAngle + Math.PI / 6),
      this.y + vector.y * arrowLength - arrowHeadLength * Math.sin(arrowAngle + Math.PI / 6)
    );
    ctx.stroke();
    ctx.restore();
  }

  getDirectionVector() {
    const speed = Math.sqrt(this.vx ** 2 + this.vy ** 2);
    if (speed === 0) return { x: 0, y: 0 };
    return {
      x: this.vx / speed,
      y: this.vy / speed,
      magnitude: speed
    };
  }
}

export default function Home() {
  const canvasRef = useRef(null);
  const topsRef = useRef([]); // Use ref for animation loop
  const [tops, setTops] = useState([]);
  const [selectedTop, setSelectedTop] = useState(null);
  const selectedTopRef = useRef(null);
  const arenaFlashRef = useRef(0); // Arena flash intensity (0-1)
  const oscEnabledRef = useRef(false); // OSC enabled state
  const lastOscSendRef = useRef(0); // Throttle OSC sends
  const arenaRadius = 300;
  const canvasSize = arenaRadius * 2 + 100;

  // Check OSC availability
  useEffect(() => {
    fetch('/api/osc')
      .then(res => res.json())
      .then(data => {
        oscEnabledRef.current = data.oscEnabled;
        if (data.oscEnabled) {
          console.log(`OSC enabled: ${data.host}:${data.port}`);
        }
      })
      .catch(err => console.warn('OSC check failed:', err));
  }, []);

  // Send OSC message
  const sendOSC = async (address, args) => {
    if (!oscEnabledRef.current) return;
    
    try {
      await fetch('/api/osc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, args })
      });
    } catch (error) {
      console.warn('OSC send failed:', error);
    }
  };

  // Sync state to ref
  useEffect(() => {
    topsRef.current = tops;
  }, [tops]);

  useEffect(() => {
    selectedTopRef.current = selectedTop;
  }, [selectedTop]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let animationFrameId;

    const draw = () => {
      // Get current tops from ref
      const currentTops = topsRef.current;
      
      // Check for collisions and update arena flash
      let hasCollision = false;
      if (currentTops.length > 0) {
        currentTops.forEach((top) => {
          if (top.collisionFlash > 0) {
            hasCollision = true;
          }
        });
      }
      
      // Update arena flash - trigger on collision, fade out
      if (hasCollision) {
        arenaFlashRef.current = 1.0; // Full white flash
        
        // Send OSC collision event
        const now = Date.now();
        if (now - lastOscSendRef.current > 50) { // Throttle to 20Hz max
          lastOscSendRef.current = now;
          sendOSC('/stfs/collision', [1.0]);
        }
      } else {
        arenaFlashRef.current = Math.max(0, arenaFlashRef.current - 0.12); // Fade out
      }
      
      // Send OSC data for all tops (throttled)
      const now = Date.now();
      if (now - lastOscSendRef.current > 100 && currentTops.length > 0) { // 10Hz update rate
        lastOscSendRef.current = now;
        
        // Send individual top data
        currentTops.forEach((top, index) => {
          const centerX = arenaRadius + 50;
          const centerY = arenaRadius + 50;
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
        
        // Send summary data
        sendOSC('/stfs/summary', [
          currentTops.length,      // Number of tops
          arenaFlashRef.current     // Arena flash intensity
        ]);
      }
      
      // Clear canvas - flash white on collision, otherwise dark gray
      const flashIntensity = arenaFlashRef.current;
      if (flashIntensity > 0) {
        ctx.fillStyle = '#ffffff'; // White flash
      } else {
        ctx.fillStyle = '#1a1a1a'; // Normal dark background
      }
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw arena circle - black on white flash, white on dark background
      ctx.strokeStyle = flashIntensity > 0 ? '#000000' : '#ffffff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(arenaRadius + 50, arenaRadius + 50, arenaRadius, 0, Math.PI * 2);
      ctx.stroke();

      // Draw center point - black on white flash, white on dark background
      ctx.fillStyle = flashIntensity > 0 ? '#000000' : '#ffffff';
      ctx.beginPath();
      ctx.arc(arenaRadius + 50, arenaRadius + 50, 4, 0, Math.PI * 2);
      ctx.fill();
      
      if (currentTops.length > 0) {
        // First pass: update positions and handle collisions
        currentTops.forEach((top, index) => {
          top.update(currentTops, index);
        });
        
        // Remove tops that are outside the arena
        const topsToKeep = currentTops.filter((top) => !top.shouldRemove);
        if (topsToKeep.length !== currentTops.length) {
          setTops(topsToKeep);
          // If selected top was removed, deselect it
          if (selectedTopRef.current && selectedTopRef.current.shouldRemove) {
            setSelectedTop(null);
          }
        }
        
        // Second pass: draw velocity arrows for ALL tops (before drawing tops)
        topsToKeep.forEach((top) => {
          top.drawVelocityArrow(ctx);
        });
        
        // Third pass: draw ALL tops
        topsToKeep.forEach((top) => {
          top.draw(ctx);
        });
      }

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [arenaRadius]);

  const handleCanvasClick = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if click is within arena
    const centerX = arenaRadius + 50;
    const centerY = arenaRadius + 50;
    const distance = Math.sqrt(
      (x - centerX) ** 2 + (y - centerY) ** 2
    );

    if (distance <= arenaRadius) {
      // Check if clicking on existing top (for selection)
      let clickedTop = null;
      setTops((prevTops) => {
        return prevTops.map((top) => {
          const topDistance = Math.sqrt((x - top.x) ** 2 + (y - top.y) ** 2);
          if (topDistance <= top.radius) {
            clickedTop = top;
            // Toggle selection
            top.selected = !top.selected;
            return top;
          }
          // Don't deselect others when clicking empty space
          return top;
        });
      });

      if (clickedTop) {
        // If clicking on a top, just toggle selection
        setSelectedTop(clickedTop.selected ? clickedTop : null);
      } else {
        // Always spawn a new top when clicking empty space
        const newTop = new SpinningTop(x, y, arenaRadius);
        setTops((prevTops) => {
          // Deselect all previous tops
          prevTops.forEach((top) => {
            top.selected = false;
          });
          return [...prevTops, newTop];
        });
        setSelectedTop(newTop);
        newTop.selected = true;
        
        // Send OSC spawn event
        const normalizedX = (x - (arenaRadius + 50)) / arenaRadius;
        const normalizedY = (y - (arenaRadius + 50)) / arenaRadius;
        sendOSC('/stfs/spawn', [normalizedX, normalizedY]);
      }
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black p-8">
      <div className="flex flex-col items-center gap-6">
        <h1 className="text-3xl font-bold text-black dark:text-zinc-50">
          Spinning Top Battle Arena
        </h1>
        <div className="relative">
          <canvas
            ref={canvasRef}
            width={canvasSize}
            height={canvasSize}
            onClick={handleCanvasClick}
            className="border-2 border-zinc-300 dark:border-zinc-700 rounded-lg cursor-crosshair"
          />
        </div>
        <div className="w-full max-w-[700px] bg-white dark:bg-zinc-900 p-6 rounded-lg border border-zinc-200 dark:border-zinc-800">
          <h2 className="text-xl font-semibold mb-4 text-black dark:text-zinc-50">
            Instructions
          </h2>
          <ul className="space-y-2 text-zinc-600 dark:text-zinc-400">
            <li>• <strong>Click anywhere in the circle to spawn a spinning top</strong></li>
            <li>• <strong>Keep clicking to add more tops</strong> - they will collide with realistic physics</li>
            <li>• Click on an existing top to select it and see its details</li>
            <li>• Tops gravitate toward the center</li>
            <li>• Blue arrow shows the direction vector of selected top</li>
            <li>• Tops bounce off each other with elastic collisions</li>
          </ul>
          {selectedTop && (
            <div className="mt-6 p-4 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
              <h3 className="text-lg font-semibold mb-3 text-black dark:text-zinc-50">
                Selected Top Information
              </h3>
              <div className="space-y-2 text-sm font-mono text-zinc-700 dark:text-zinc-300">
                <div>
                  <span className="font-semibold">Position:</span> (
                  {selectedTop.x.toFixed(2)}, {selectedTop.y.toFixed(2)})
                </div>
                <div>
                  <span className="font-semibold">Velocity:</span> (
                  {selectedTop.vx.toFixed(3)}, {selectedTop.vy.toFixed(3)})
                </div>
                <div>
                  <span className="font-semibold">Speed:</span>{' '}
                  {Math.sqrt(selectedTop.vx ** 2 + selectedTop.vy ** 2).toFixed(3)} px/frame
                </div>
                <div>
                  <span className="font-semibold">Direction Vector:</span> (
                  {selectedTop.getDirectionVector().x.toFixed(3)},{' '}
                  {selectedTop.getDirectionVector().y.toFixed(3)})
                </div>
                <div>
                  <span className="font-semibold">Distance from Center:</span>{' '}
                  {(
                    Math.sqrt(
                      (selectedTop.x - (arenaRadius + 50)) ** 2 +
                        (selectedTop.y - (arenaRadius + 50)) ** 2
                    ) / arenaRadius
                  ).toFixed(2)}{' '}
                  × radius
                </div>
                <div>
                  <span className="font-semibold">Rotation Angle:</span>{' '}
                  {((selectedTop.angle * 180) / Math.PI).toFixed(1)}°
                </div>
              </div>
            </div>
          )}
          {tops.length > 0 && (
            <div className="mt-4 text-sm text-zinc-500 dark:text-zinc-500">
              Total Tops: {tops.length}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
