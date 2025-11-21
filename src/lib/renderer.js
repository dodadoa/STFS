/**
 * Rendering utilities for the spinning top simulation
 * Handles all canvas drawing operations
 */

/**
 * Draw a spinning top
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {SpinningTop} top - Top to draw
 */
export function drawTop(ctx, top) {
  ctx.save();
  ctx.translate(top.x, top.y);
  ctx.rotate(top.angle);

  // Draw main circle with normal color
  ctx.fillStyle = top.color.primary;
  ctx.beginPath();
  ctx.arc(0, 0, top.radius, 0, Math.PI * 2);
  ctx.fill();

  // Draw outer ring with opposite color (strong contrast)
  ctx.strokeStyle = top.color.accent;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, 0, top.radius, 0, Math.PI * 2);
  ctx.stroke();

  // Draw inner circle with accent color (strong contrast)
  ctx.fillStyle = top.color.accent;
  ctx.beginPath();
  ctx.arc(0, 0, top.radius * 0.6, 0, Math.PI * 2);
  ctx.fill();

  // Draw white border
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, 0, top.radius, 0, Math.PI * 2);
  ctx.stroke();

  // Draw spinning effect with black and white (strong contrast)
  ctx.lineWidth = 1;
  const numSpokes = 6;
  for (let i = 0; i < numSpokes; i++) {
    const angle = (top.angle * 2 + (i * Math.PI * 2) / numSpokes) % (Math.PI * 2);
    // Alternate between white and opposite of primary color
    ctx.strokeStyle = i % 2 === 0 ? '#ffffff' : (top.color.primary === '#000000' ? '#ffffff' : '#000000');
    ctx.beginPath();
    ctx.moveTo(
      Math.cos(angle) * top.radius * 0.3,
      Math.sin(angle) * top.radius * 0.3
    );
    ctx.lineTo(
      Math.cos(angle) * top.radius * 0.9,
      Math.sin(angle) * top.radius * 0.9
    );
    ctx.stroke();
  }

  // Draw center dot
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, 0, 3, 0, Math.PI * 2);
  ctx.fill();

  // Draw selection indicator (outer ring in white)
  if (top.selected) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, top.radius + 4, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Draw velocity arrow for a top
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {SpinningTop} top - Top to draw arrow for
 */
export function drawVelocityArrow(ctx, top) {
  // Always draw arrow, even if speed is very low
  const speed = Math.sqrt(top.vx ** 2 + top.vy ** 2);
  
  // Get direction vector, use default direction if speed is zero
  let vector;
  if (speed < 0.01) {
    // If no velocity, point in a default direction (e.g., right)
    vector = { x: 1, y: 0 };
  } else {
    vector = top.getDirectionVector();
  }
  
  // Smaller arrow length, scale with speed
  const baseLength = 25;
  const speedLength = Math.min(speed * 8, 40);
  const arrowLength = Math.max(baseLength, speedLength);
  
  ctx.save();
  // Use black/white for arrow (strong contrast)
  ctx.strokeStyle = top.selected ? '#ffffff' : (top.color.primary === '#000000' ? '#ffffff' : '#000000');
  ctx.lineWidth = 1;
  ctx.shadowBlur = 0;
  
  ctx.beginPath();
  ctx.moveTo(top.x, top.y);
  ctx.lineTo(
    top.x + vector.x * arrowLength,
    top.y + vector.y * arrowLength
  );
  ctx.stroke();

  // Draw smaller arrowhead
  const arrowAngle = Math.atan2(vector.y, vector.x);
  const arrowHeadLength = 8;
  ctx.beginPath();
  ctx.moveTo(
    top.x + vector.x * arrowLength,
    top.y + vector.y * arrowLength
  );
  ctx.lineTo(
    top.x + vector.x * arrowLength - arrowHeadLength * Math.cos(arrowAngle - Math.PI / 6),
    top.y + vector.y * arrowLength - arrowHeadLength * Math.sin(arrowAngle - Math.PI / 6)
  );
  ctx.moveTo(
    top.x + vector.x * arrowLength,
    top.y + vector.y * arrowLength
  );
  ctx.lineTo(
    top.x + vector.x * arrowLength - arrowHeadLength * Math.cos(arrowAngle + Math.PI / 6),
    top.y + vector.y * arrowLength - arrowHeadLength * Math.sin(arrowAngle + Math.PI / 6)
  );
  ctx.stroke();
  ctx.restore();
}

/**
 * Draw arena background and boundaries
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} arenaRadius - Arena radius
 * @param {number} flashIntensity - Arena flash intensity (0-1)
 */
export function drawArena(ctx, arenaRadius, flashIntensity) {
  // Clear canvas - flash white on collision, otherwise dark gray
  if (flashIntensity > 0) {
    ctx.fillStyle = '#ffffff'; // White flash
  } else {
    ctx.fillStyle = '#1a1a1a'; // Normal dark background
  }
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

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
}

