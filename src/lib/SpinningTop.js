// Black and white color palette only
const TOP_COLORS = [
  { primary: '#000000', secondary: '#000000', accent: '#ffffff' }, // Black with white accent
  { primary: '#ffffff', secondary: '#ffffff', accent: '#000000' }, // White with black accent
];

let topColorIndex = 0;

export class SpinningTop {
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

