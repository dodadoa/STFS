'use client';

import { useState, useRef, useEffect } from 'react';
import { SpinningTop } from '@/lib/SpinningTop';
import { initOSC, sendCollisionEvent, sendTopsData, sendSummaryData, sendSpawnEvent } from '@/lib/osc';
import { drawArena, drawTop, drawVelocityArrow } from '@/lib/renderer';

export default function Home() {
  const canvasRef = useRef(null);
  const topsRef = useRef([]); // Use ref for animation loop
  const [tops, setTops] = useState([]);
  const [selectedTop, setSelectedTop] = useState(null);
  const selectedTopRef = useRef(null);
  const arenaFlashRef = useRef(0); // Arena flash intensity (0-1)
  const lastOscSendRef = useRef(0); // Throttle OSC sends
  const arenaRadius = 300;
  const canvasSize = arenaRadius * 2 + 100;

  // Initialize OSC
  useEffect(() => {
    initOSC();
  }, []);

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
        sendCollisionEvent(1.0);
      } else {
        arenaFlashRef.current = Math.max(0, arenaFlashRef.current - 0.12); // Fade out
      }
      
      // Send OSC data for all tops (throttled)
      const now = Date.now();
      if (now - lastOscSendRef.current > 100 && currentTops.length > 0) { // 10Hz update rate
        lastOscSendRef.current = now;
        sendTopsData(currentTops, arenaRadius);
        sendSummaryData(currentTops.length, arenaFlashRef.current);
      }
      
      // Draw arena
      drawArena(ctx, arenaRadius, arenaFlashRef.current);
      
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
          drawVelocityArrow(ctx, top);
        });
        
        // Third pass: draw ALL tops
        topsToKeep.forEach((top) => {
          drawTop(ctx, top);
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
        sendSpawnEvent(x, y, arenaRadius);
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
