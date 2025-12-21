import React, { useRef, useState, useEffect, forwardRef } from 'react';
import { Bubble, BubbleType } from '../types.ts';
import { BubbleItem, BubbleItemHandle } from './BubbleItem.tsx';

interface CanvasAreaProps {
  image: { url: string; width: number; height: number } | null;
  bubbles: Bubble[];
  selectedBubbleId: string | null;
  onAddBubble: (x: number, y: number) => void;
  onSelectBubble: (id: string | null) => void;
  onUpdateBubble: (updatedBubble: Bubble) => void;
  onDeleteBubble: (id: string) => void;
  isSaving: boolean;
  canvasSize: { width: number; height: number };
  selectedBubbleRef: React.RefObject<BubbleItemHandle>;
}

export const CanvasArea = forwardRef<HTMLDivElement, CanvasAreaProps>(({
  image,
  bubbles,
  selectedBubbleId,
  onAddBubble,
  onSelectBubble,
  onUpdateBubble,
  onDeleteBubble,
  isSaving,
  canvasSize,
  selectedBubbleRef,
}, ref) => {
  const areaRef = useRef<HTMLDivElement>(null);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!image) return;
    // Check if click is on a bubble or its part/handle
    const target = e.target as HTMLElement;
    if (target.closest('.bubble-item-component')) { 
      // Selection is handled by BubbleItem's mousedown
      return;
    }

    if (areaRef.current) {
      const rect = areaRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      onAddBubble(x, y);
    }
  };
  
  // Deselect bubble if clicking outside all bubbles (but inside canvas area)
  useEffect(() => {
    const handleGlobalClick = (event: MouseEvent) => {
      if (areaRef.current && !areaRef.current.contains(event.target as Node)) {
        // Clicked outside canvas area
        onSelectBubble(null);
      } else if (areaRef.current && areaRef.current.contains(event.target as Node)) {
        // Clicked inside canvas area
        const target = event.target as HTMLElement;
        if (!target.closest('.bubble-item-component')) {
          // Clicked on canvas background, not on a bubble
          // If onAddBubble is not called (e.g. by direct click handler), deselect.
          // The current setup means handleClick on areaRef will add a bubble *and* select it.
          // If we want to deselect on background click without adding, this logic needs refinement.
          // For now, BubbleItem handles its own selection, and background click adds new.
        }
      }
    };

    document.addEventListener('mousedown', handleGlobalClick);
    return () => {
      document.removeEventListener('mousedown', handleGlobalClick);
    };
  }, [onSelectBubble]);


  return (
    <div 
      ref={ref} // Parent ref for html2canvas
      className="canvas-outer-container"
    >
        <div
            id="actual-canvas-content" // Target for html2canvas
            ref={areaRef}
            className="relative bg-white border border-gray-400 shadow-lg overflow-hidden"
            style={{ 
                width: image ? `${canvasSize.width}px` : '100%', 
                height: image ? `${canvasSize.height}px` : '400px',
                cursor: image ? 'crosshair' : 'default',
            }}
            onClick={handleClick}
        >
            {image ? (
                <img src={image.url} alt="Comic page" className="absolute top-0 left-0 w-full h-full object-contain pointer-events-none" />
            ) : (
                <div className="absolute inset-0 flex justify-center items-center text-gray-500">
                Veuillez télécharger une image pour commencer
                </div>
            )}

            {bubbles.sort((a, b) => a.zIndex - b.zIndex).map(bubble => (
                <BubbleItem
                key={bubble.id}
                ref={bubble.id === selectedBubbleId ? selectedBubbleRef : null}
                bubble={bubble}
                isSelected={bubble.id === selectedBubbleId}
                onSelect={onSelectBubble}
                onUpdate={onUpdateBubble}
                onDelete={onDeleteBubble}
                isSaving={isSaving}
                canvasBounds={areaRef.current?.getBoundingClientRect() || null}
                />
            ))}
        </div>
    </div>
  );
});