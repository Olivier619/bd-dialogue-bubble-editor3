import React, { useState, useRef, useEffect, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react';
import { Bubble, BubblePart, MIN_BUBBLE_WIDTH, MIN_BUBBLE_HEIGHT, FONT_FAMILY_MAP, BubbleType, FontName, SpeechTailPart, ThoughtDotPart } from '../types.ts';
import { generateBubblePaths, getOverallBbox } from '../utils/bubbleUtils';
import { detectTextOverflow, getTextBounds, SAFE_TEXT_ZONES, getLineHeightOffset } from '../utils/textAutoFit';


interface BubbleItemProps {
  bubble: Bubble;
  isSelected: boolean;
  onSelect: (id: string | null) => void;
  onUpdate: (updatedBubble: Bubble) => void;
  onDelete: (id: string) => void;
  isSaving: boolean;
  canvasBounds: DOMRect | null;
}

export type BubbleItemHandle = {
  applyStyleToSelection: (style: 'fontFamily' | 'fontSize', value: FontName | number) => boolean;
  enterEditMode: () => void;
};

const HANDLE_SIZE = 10;
const HANDLE_OFFSET = HANDLE_SIZE / 2;
const TAIL_TIP_HANDLE_RADIUS = 7;
const TAIL_BASE_HANDLE_RADIUS = 9;
const BUBBLE_BORDER_WIDTH = 2;
const MIN_FONT_SIZE = 5;
const MAX_FONT_SIZE = 40;

type InteractionMode = 'move' | 'resize' | 'move-part' | 'move-tail-tip' | 'move-tail-base' | null;
type ActiveHandle = 'tl' | 'tc' | 'tr' | 'ml' | 'mr' | 'bl' | 'bc' | 'br' | null;



export const BubbleItem = forwardRef<BubbleItemHandle, BubbleItemProps>(({ bubble, isSelected, onSelect, onUpdate, onDelete, isSaving, canvasBounds }, ref) => {
  const [isEditingText, setIsEditingText] = useState(false);
  const [isInitialEdit, setIsInitialEdit] = useState(false);
  const textEditRef = useRef<HTMLDivElement>(null);


  const [interaction, setInteraction] = useState<{
    mode: InteractionMode; activeHandle: ActiveHandle; activePartId: string | null;
    startX: number; startY: number; initialBubbleX: number; initialBubbleY: number;
    initialBubbleWidth: number; initialBubbleHeight: number;
    initialPartOffsetX?: number; initialPartOffsetY?: number; initialTipX?: number; initialTipY?: number;
    initialBaseCX?: number; initialBaseCY?: number;
  } | null>(null);

  const applyStyleToCurrentSelection = useCallback((style: 'fontFamily' | 'fontSize', value: number | FontName): boolean => {
    if (!isEditingText || !textEditRef.current) return false;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return false;

    const range = selection.getRangeAt(0);
    if (!textEditRef.current.contains(range.commonAncestorContainer)) return false;

    // Helper to calculate new style
    const getNewStyleValue = (currentVal: string, delta: number): string => {
      const currentSize = parseInt(currentVal) || bubble.fontSize;
      const newSize = Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, currentSize + delta));
      return `${newSize}px`;
    }

    // New approach: Wrap selection in span or update existing span
    // Since complex range manipulation is error prone, let's try a simpler approach if possible.
    // However, for precise selection styling, we need to handle the range.

    // Simplification: use execCommand for fontSize but manage the unexpected '1' size better.
    // The issue is likely that execCommand('fontSize', false, '7') maps to something huge, '1' maps to tiny.
    // We cannot pass pixels to execCommand fontSize.
    // So we MUST use the hack or write a custom wrapper.
    // Let's refine the hack first as it is less code change than a full rich text engine.

    // HACK IMPROVEMENT:
    // 1. Calculate the target size BEFORE calling execCommand (we were doing this in the caller usually, but let's centralize).
    // Actually the caller passes the exact value or the loop does.
    // In handleWheel: `applyStyleToCurrentSelection('fontSize', newSize)` - so value IS the target size in pixels.

    if (style === 'fontSize') {
      const sizePx = `${value}px`;
      // Use a unique marker
      const marker = '7'; // largest size, unlikely to be used by accident? or 1.
      document.execCommand('fontSize', false, marker);

      const fontElements = textEditRef.current.getElementsByTagName('font');
      let replaced = false;
      // Convert live list to array to avoid issues during modification
      Array.from(fontElements).forEach((element: Element) => {
        // Cast to any because font tag properties are not in standard types
        const fontEl = element as any;
        if (fontEl.getAttribute('size') === marker) {
          const span = document.createElement('span');
          span.style.fontSize = sizePx;
          span.innerHTML = fontEl.innerHTML;

          // Preserve other styles? font tag is deprecated so it only has color/face/size
          if (fontEl.face) span.style.fontFamily = fontEl.face;
          if (fontEl.color) span.style.color = fontEl.color;

          fontEl.parentNode?.replaceChild(span, fontEl);
          replaced = true;

          // Restore selection to the new span content so resizing continues smoothly
          const newRange = document.createRange();
          newRange.selectNodeContents(span);
          const selection = window.getSelection();
          if (selection) {
            selection.removeAllRanges();
            selection.addRange(newRange);
          }
        }
      });

      // If we failed to find the font tag but execCommand returned true, we might be in trouble.
      // But usually it works. The issue might be that `value` passed was wrong?
    } else {
      const styleValue = FONT_FAMILY_MAP[value as FontName];
      document.execCommand('fontName', false, styleValue);
    }

    // Clean up empty spans or merge? (Optional optimization)

    // DO NOT call onUpdate here. It triggers re-render which breaks selection in some browsers/react versions.
    // relying on onBlur to sync the text back to state.

    return true;
  }, [isEditingText, bubble]);

  const enterEditMode = useCallback(() => {
    if (!isEditingText && isSelected) {
      setIsEditingText(true);
      setIsInitialEdit(true);
    }
  }, [isEditingText, isSelected]);

  useImperativeHandle(ref, () => ({
    applyStyleToSelection: (style, value) => applyStyleToCurrentSelection(style, value),
    enterEditMode
  }), [applyStyleToCurrentSelection, enterEditMode]);

  useEffect(() => {
    const textDiv = textEditRef.current;
    if (textDiv && !isEditingText && textDiv.innerHTML !== bubble.text) textDiv.innerHTML = bubble.text;
  }, [isEditingText, bubble.text]);

  useEffect(() => {
    if (isSelected && isEditingText && textEditRef.current && isInitialEdit) {
      if (bubble.text === 'Votre texte ici') textEditRef.current.innerHTML = '';
      textEditRef.current.focus();

      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(textEditRef.current);
      if (bubble.text === 'Votre texte ici') range.collapse(false);
      selection?.removeAllRanges();
      selection?.addRange(range);

      setIsInitialEdit(false);
    }
  }, [isSelected, isEditingText, isInitialEdit, bubble.text]);



  useEffect(() => {
    const textDiv = textEditRef.current;
    if (isSelected && isEditingText && textDiv) {
      const handleWheel = (e: WheelEvent) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -2 : 2;

        const selection = window.getSelection();
        if (!selection || !textDiv.contains(selection.anchorNode)) return;

        // If no selection (collapsed), resize entire bubble font - this DOES need onUpdate
        if (selection.isCollapsed || selection.rangeCount === 0) {
          const newSize = Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, bubble.fontSize + delta));
          if (newSize !== bubble.fontSize) onUpdate({ ...bubble, fontSize: newSize });
          return;
        }

        // If selection exists, just modify the DOM (no onUpdate)
        let container = selection.getRangeAt(0).startContainer;
        if (container.nodeType === Node.TEXT_NODE) container = container.parentNode!;
        const currentSize = parseInt(window.getComputedStyle(container as Element).fontSize, 10) || bubble.fontSize;
        const newSize = Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, currentSize + delta));
        applyStyleToCurrentSelection('fontSize', newSize);
      };

      textDiv.addEventListener('wheel', handleWheel, { passive: false });
      return () => textDiv.removeEventListener('wheel', handleWheel);
    }
  }, [isSelected, isEditingText, bubble, onUpdate, applyStyleToCurrentSelection]);

  // Handle wheel for shape variation when NOT editing text
  useEffect(() => {
    if (isSelected && !isEditingText) {
      const handleShapeWheel = (e: WheelEvent) => {
        // Only for bubbles that support shape variation (Thought, Shout)
        if (bubble.type !== BubbleType.Thought && bubble.type !== BubbleType.Shout) return;

        e.preventDefault();
        e.stopPropagation();

        const delta = e.deltaY > 0 ? 1 : -1;
        const currentVariant = bubble.shapeVariant || 0;
        onUpdate({ ...bubble, shapeVariant: currentVariant + delta });
      };

      // Attach to the bubble element itself if possible, or document if selected
      // Using a ref for the main container would be better, but we can attach to the component root via a ref or just document with check
      // Since we don't have a direct ref to the root div exposed easily here (we forwardRef to handle), let's use a local ref for the div
      // Actually we can just use the existing logic structure or add a ref to the div.
      // Let's add a ref to the main div.
    }
  }, [isSelected, isEditingText, bubble, onUpdate]);


  useEffect(() => {
    const textDiv = textEditRef.current;
    if (isSelected && isEditingText && textDiv) {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.ctrlKey || e.metaKey) {
          let command: string | null = null;
          if (e.key.toLowerCase() === 'b') command = 'bold';
          if (e.key.toLowerCase() === 'i') command = 'italic';
          if (e.key.toLowerCase() === 'u') command = 'underline';
          if (e.shiftKey && e.key.toLowerCase() === 'x') command = 'strikethrough';

          if (command) {
            e.preventDefault();
            document.execCommand(command);
            return;
          }

          if (e.key === '+' || e.key === '=' || e.key === '-') {
            e.preventDefault();
            const change = (e.key === '-') ? -2 : 2;

            const selection = window.getSelection();
            if (!selection || !textDiv.contains(selection.anchorNode)) return;

            if (selection.isCollapsed) {
              const newSize = Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, bubble.fontSize + change));
              if (newSize !== bubble.fontSize) onUpdate({ ...bubble, fontSize: newSize });
              return;
            }

            let container = selection.getRangeAt(0).startContainer;
            if (container.nodeType === Node.TEXT_NODE) container = container.parentNode!;
            const currentSize = parseInt(window.getComputedStyle(container as Element).fontSize, 10) || bubble.fontSize;
            const newSize = Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, currentSize + change));
            applyStyleToCurrentSelection('fontSize', newSize);
          }
        }
      };

      textDiv.addEventListener('keydown', handleKeyDown);
      return () => textDiv.removeEventListener('keydown', handleKeyDown);
    }
  }, [isSelected, isEditingText, bubble, onUpdate, applyStyleToCurrentSelection]);



  const handleTextBlur = () => {
    setIsEditingText(false);
    const currentHTML = textEditRef.current?.innerHTML ?? '';
    if (currentHTML !== bubble.text) onUpdate({ ...bubble, text: currentHTML.trim() === '' || currentHTML === '<br>' ? 'Votre texte ici' : currentHTML });
  };

  const handleBubbleMouseDown = useCallback((e: React.MouseEvent | React.TouchEvent, mode: InteractionMode, handle?: ActiveHandle, partId?: string) => {
    if (isSaving) return;

    e.preventDefault();
    e.stopPropagation();

    if (!isSelected) {
      onSelect(bubble.id);
    }

    const isTouchEvent = 'touches' in e;
    const clientX = isTouchEvent ? e.touches[0].clientX : e.clientX;
    const clientY = isTouchEvent ? e.touches[0].clientY : e.clientY;

    let interactionData: any = {};

    if (mode === 'move-part' && partId) {
      const part = bubble.parts.find(p => p.id === partId) as ThoughtDotPart;
      interactionData.initialPartOffsetX = part.offsetX;
      interactionData.initialPartOffsetY = part.offsetY;
    } else if ((mode === 'move-tail-tip' || mode === 'move-tail-base') && partId) {
      const part = bubble.parts.find(p => p.id === partId) as SpeechTailPart;
      interactionData.initialTipX = part.tipX;
      interactionData.initialTipY = part.tipY;
      if (mode === 'move-tail-base') {
        interactionData.initialBaseCX = part.baseCX;
        interactionData.initialBaseCY = part.baseCY;
      }
    } else if (mode === 'resize') {
      // keep a copy of original parts so resizing calculations use stable originals
      interactionData.initialParts = bubble.parts.map(p => ({ ...p }));
    }

    setInteraction({
      mode,
      activeHandle: handle || null,
      activePartId: partId || null,
      startX: clientX,
      startY: clientY,
      initialBubbleX: bubble.x,
      initialBubbleY: bubble.y,
      initialBubbleWidth: bubble.width,
      initialBubbleHeight: bubble.height,
      ...interactionData
    });
  }, [bubble, onSelect, isSelected, isSaving]);

  const handleTextClick = useCallback((e: React.MouseEvent) => {
    if (isSaving || !isSelected) return;
    e.stopPropagation();

    if (!isEditingText) {
      enterEditMode();
    }
  }, [isSaving, isSelected, isEditingText, enterEditMode]);

  const handleBubbleBodyDoubleClick = useCallback((e: React.MouseEvent) => {
    if (isSaving) return;
    e.preventDefault();
    e.stopPropagation();
    onDelete(bubble.id);
  }, [isSaving, onDelete, bubble.id]);

  useEffect(() => {
    if (!interaction) return;

    const handleMouseMove = (e: MouseEvent | TouchEvent) => {
      const isTouchEvent = 'touches' in e;
      const clientX = isTouchEvent ? e.touches[0].clientX : e.clientX;
      const clientY = isTouchEvent ? e.touches[0].clientY : e.clientY;

      const deltaX = clientX - interaction.startX;
      const deltaY = clientY - interaction.startY;
      let newBubble = { ...bubble };

      switch (interaction.mode) {
        case 'move':
          newBubble.x = interaction.initialBubbleX + deltaX;
          newBubble.y = interaction.initialBubbleY + deltaY;
          break;

        case 'resize': {
          let dw = 0, dh = 0;
          if (interaction.activeHandle?.includes('l')) dw = -deltaX;
          if (interaction.activeHandle?.includes('r')) dw = deltaX;
          if (interaction.activeHandle?.includes('t')) dh = -deltaY;
          if (interaction.activeHandle?.includes('b')) dh = deltaY;

          let newWidth = Math.max(MIN_BUBBLE_WIDTH, interaction.initialBubbleWidth + dw);
          let newHeight = Math.max(MIN_BUBBLE_HEIGHT, interaction.initialBubbleHeight + dh);

          let newX = interaction.initialBubbleX;
          let newY = interaction.initialBubbleY;

          if (interaction.activeHandle?.includes('l')) newX = interaction.initialBubbleX + deltaX;
          if (interaction.activeHandle?.includes('t')) newY = interaction.initialBubbleY + deltaY;

          newBubble.width = newWidth;
          newBubble.height = newHeight;
          newBubble.x = newX;
          newBubble.y = newY;
          // Adjust parts so tails remain attached to edges (top/bottom/left/right)
          try {
            const scaleX = newWidth / interaction.initialBubbleWidth;
            const scaleY = newHeight / interaction.initialBubbleHeight;
            const origW = interaction.initialBubbleWidth;
            const origH = interaction.initialBubbleHeight;
            const eps = 0.0001;

            const origParts = (interaction as any).initialParts || bubble.parts;
            newBubble.parts = origParts.map(p => {
              if (p.type === 'speech-tail') {
                const partOrig = p as any;
                const part = { ...partOrig } as any;

                const anchoredBottom = Math.abs(partOrig.baseCY - origH) < eps;
                const anchoredTop = Math.abs(partOrig.baseCY) < eps;
                const anchoredRight = Math.abs(partOrig.baseCX - origW) < eps;
                const anchoredLeft = Math.abs(partOrig.baseCX) < eps;

                // Update base position: keep anchored edges exact, otherwise scale proportionally
                if (anchoredRight) part.baseCX = newWidth;
                else if (anchoredLeft) part.baseCX = 0;
                else part.baseCX = Math.max(0, Math.min(newWidth, partOrig.baseCX * scaleX));

                if (anchoredBottom) part.baseCY = newHeight;
                else if (anchoredTop) part.baseCY = 0;
                else part.baseCY = Math.max(0, Math.min(newHeight, partOrig.baseCY * scaleY));

                // Preserve tip relative vector to base (scale it)
                const dx = partOrig.tipX - partOrig.baseCX;
                const dy = partOrig.tipY - partOrig.baseCY;
                part.tipX = part.baseCX + dx * scaleX;
                part.tipY = part.baseCY + dy * scaleY;

                // Scale baseWidth and initial widths
                if (typeof part.baseWidth === 'number') {
                  part.baseWidth = Math.max(1, part.baseWidth * scaleX);
                }
                if (typeof part.initialBaseWidth === 'number') {
                  part.initialBaseWidth = Math.max(1, part.initialBaseWidth * scaleX);
                }

                return part;
              }

              if (p.type === 'thought-dot') {
                const partOrig = p as any;
                const part = { ...partOrig } as any;
                part.offsetX = Math.max(0, Math.min(newWidth, (partOrig.offsetX / origW) * newWidth));
                part.offsetY = Math.max(0, Math.min(newHeight, (partOrig.offsetY / origH) * newHeight));
                part.size = Math.max(2, partOrig.size * ((scaleX + scaleY) / 2));
                return part;
              }

              return p;
            });
          } catch (e) {
            // If anything fails, don't break resize — keep parts unchanged
          }

          break;
        }

        case 'move-part': {
          const partIndex = newBubble.parts.findIndex(p => p.id === interaction.activePartId);
          if (partIndex > -1 && newBubble.parts[partIndex].type === 'thought-dot') {
            const part = { ...newBubble.parts[partIndex] } as ThoughtDotPart;
            part.offsetX = interaction.initialPartOffsetX! + deltaX;
            part.offsetY = interaction.initialPartOffsetY! + deltaY;
            newBubble.parts = [...newBubble.parts];
            newBubble.parts[partIndex] = part;
          }
          break;
        }

        case 'move-tail-tip': {
          const partIndex = newBubble.parts.findIndex(p => p.id === interaction.activePartId);
          if (partIndex > -1 && newBubble.parts[partIndex].type === 'speech-tail') {
            const part = { ...newBubble.parts[partIndex] } as SpeechTailPart;
            part.tipX = interaction.initialTipX! + deltaX;
            part.tipY = interaction.initialTipY! + deltaY;
            newBubble.parts = [...newBubble.parts];
            newBubble.parts[partIndex] = part;
          }
          break;
        }

        case 'move-tail-base': {
          const partIndex = newBubble.parts.findIndex(p => p.id === interaction.activePartId);
          if (partIndex > -1 && newBubble.parts[partIndex].type === 'speech-tail') {
            const part = { ...newBubble.parts[partIndex] } as SpeechTailPart;
            const w = newBubble.width, h = newBubble.height;

            const localMouseX = interaction.initialBaseCX! + deltaX;
            const localMouseY = interaction.initialBaseCY! + deltaY;
            const dx = localMouseX - w / 2, dy = localMouseY - h / 2;

            const initBaseCX = interaction.initialBaseCX!;
            const initBaseCY = interaction.initialBaseCY!;
            const eps = 0.001;

            const anchoredBottom = Math.abs(initBaseCY - h) < eps;
            const anchoredTop = Math.abs(initBaseCY) < eps;
            const anchoredRight = Math.abs(initBaseCX - w) < eps;
            const anchoredLeft = Math.abs(initBaseCX) < eps;

            if (anchoredBottom || anchoredTop) {
              // move along top/bottom edge: update baseCX from mouse X, keep baseCY fixed
              part.baseCX = Math.max(0, Math.min(w, localMouseX));
              part.baseCY = anchoredBottom ? h : 0;
            } else if (anchoredLeft || anchoredRight) {
              // move along left/right edge: update baseCY from mouse Y, keep baseCX fixed
              part.baseCY = Math.max(0, Math.min(h, localMouseY));
              part.baseCX = anchoredRight ? w : 0;
            } else {
              // fallback to previous heuristic if base was not exactly on an edge
              if (Math.abs(dx / w) > Math.abs(dy / h)) {
                part.baseCX = dx > 0 ? w : 0;
                part.baseCY = h / 2 + dy * (w / (2 * Math.abs(dx || 1)));
              } else {
                part.baseCY = dy > 0 ? h : 0;
                part.baseCX = w / 2 + dx * (h / (2 * Math.abs(dy || 1)));
              }
            }

            // preserve tip vector relative to base
            const relDX = (interaction.initialTipX! - initBaseCX);
            const relDY = (interaction.initialTipY! - initBaseCY);
            part.tipX = part.baseCX + relDX;
            part.tipY = part.baseCY + relDY;

            part.baseCX = Math.max(0, Math.min(part.baseCX, w));
            part.baseCY = Math.max(0, Math.min(part.baseCY, h));
            newBubble.parts = [...newBubble.parts];
            newBubble.parts[partIndex] = part;
          }
          break;
        }
      }

      onUpdate(newBubble);
    };

    const handleMouseUp = () => setInteraction(null);

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('touchmove', handleMouseMove, { passive: true });
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchend', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('touchmove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchend', handleMouseUp);
    };
  }, [interaction, onUpdate, bubble]);

  const { bodyPath, partsCircles } = useMemo(() => generateBubblePaths(bubble), [bubble]);
  const bbox = useMemo(() => getOverallBbox(bubble), [bubble]);

  // Calculer les paddings dynamiques en fonction du type de bulle
  const safeZone = SAFE_TEXT_ZONES[bubble.type] || { widthFactor: 0.80, heightFactor: 0.75 };
  const paddingH = ((1 - safeZone.widthFactor) / 2) * 100;
  const paddingV = ((1 - safeZone.heightFactor) / 2) * 100;

  const bubbleStyle: React.CSSProperties = {
    position: 'absolute',
    left: `${bubble.x}px`,
    top: `${bubble.y}px`,
    width: `${bubble.width}px`,
    height: `${bubble.height}px`,
    zIndex: bubble.zIndex,
    fontFamily: FONT_FAMILY_MAP[bubble.fontFamily],
    fontSize: `${bubble.fontSize}px`,

    color: bubble.textColor,
    border: isSelected ? '2px solid #3b82f6' : '2px solid transparent',
    boxSizing: 'content-box',
  };

  const textContainerStyle: React.CSSProperties = {
    position: 'absolute',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxSizing: 'border-box',
    pointerEvents: 'auto',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    paddingTop: `${(bubble.height * (1 - safeZone.heightFactor)) / 2}px`,
    paddingBottom: `${(bubble.height * (1 - safeZone.heightFactor)) / 2}px`,
    paddingLeft: `${(bubble.width * (1 - safeZone.widthFactor)) / 2}px`,
    paddingRight: `${(bubble.width * (1 - safeZone.widthFactor)) / 2}px`,
    cursor: isEditingText ? 'text' : 'move',
    textAlign: 'center',
  };

  const svgStyle: React.CSSProperties = {
    position: 'absolute',
    pointerEvents: 'auto',
    left: `${bbox.x}px`,
    top: `${bbox.y}px`,
    width: `${bbox.width}px`,
    height: `${bbox.height}px`,
  };


  const textEditStyle: React.CSSProperties = {
    outline: 'none',
    cursor: isEditingText ? 'text' : 'move',
    width: '100%',
    lineHeight: `calc(1em + ${getLineHeightOffset(bubble.fontSize)}px)`,
    wordWrap: 'break-word',
    overflowWrap: 'break-word',
  };

  const hasBorder = ![BubbleType.TextOnly].includes(bubble.type);
  const strokeWidth = hasBorder ? BUBBLE_BORDER_WIDTH : 0;
  const strokeDasharray = bubble.type === BubbleType.Whisper ? '5,5' : 'none';

  const renderResizeHandles = () => {
    if (!isSelected || isEditingText) return null;
    const handles: { id: ActiveHandle; x: number; y: number }[] = [
      { id: 'tl', x: -HANDLE_OFFSET, y: -HANDLE_OFFSET },
      { id: 'tc', x: bubble.width / 2 - HANDLE_OFFSET, y: -HANDLE_OFFSET },
      { id: 'tr', x: bubble.width - HANDLE_OFFSET, y: -HANDLE_OFFSET },
      { id: 'ml', x: -HANDLE_OFFSET, y: bubble.height / 2 - HANDLE_OFFSET },
      { id: 'mr', x: bubble.width - HANDLE_OFFSET, y: bubble.height / 2 - HANDLE_OFFSET },
      { id: 'bl', x: -HANDLE_OFFSET, y: bubble.height - HANDLE_OFFSET },
      { id: 'bc', x: bubble.width / 2 - HANDLE_OFFSET, y: bubble.height - HANDLE_OFFSET },
      { id: 'br', x: bubble.width - HANDLE_OFFSET, y: bubble.height - HANDLE_OFFSET },
    ];

    return handles.map(h => (
      <div
        key={h.id}
        className="resize-handle"
        onMouseDown={(e) => handleBubbleMouseDown(e, 'resize', h.id)}
        onTouchStart={(e) => handleBubbleMouseDown(e, 'resize', h.id)}
        style={{
          position: 'absolute',
          left: `${h.x}px`,
          top: `${h.y}px`,
          width: `${HANDLE_SIZE}px`,
          height: `${HANDLE_SIZE}px`,
          backgroundColor: '#3b82f6',
          border: '1px solid white',
          cursor: getCursorForHandle(h.id),
          borderRadius: '2px',
          pointerEvents: 'auto',
          zIndex: 15,
        }}
      />
    ));
  };

  const getCursorForHandle = (handle: ActiveHandle): string => {
    switch (handle) {
      case 'tl': case 'br': return 'nwse-resize';
      case 'tr': case 'bl': return 'nesw-resize';
      case 'tc': case 'bc': return 'ns-resize';
      case 'ml': case 'mr': return 'ew-resize';
      default: return 'default';
    }
  };

  const renderParts = () => {
    return bubble.parts.map(part => {
      if (part.type === 'speech-tail') {
        const tail = part as SpeechTailPart;
        const offsetX = bbox.x;
        const offsetY = bbox.y;
        const worldTipX = tail.tipX + bubble.x;
        const worldTipY = tail.tipY + bubble.y;
        const worldBaseCX = tail.baseCX + bubble.x;
        const worldBaseCY = tail.baseCY + bubble.y;

        return (
          <g key={tail.id}>
            {isSelected && !isEditingText && (
              <>
                <circle
                  cx={worldTipX - bubble.x - offsetX}
                  cy={worldTipY - bubble.y - offsetY}
                  r={TAIL_TIP_HANDLE_RADIUS}
                  fill="orange"
                  stroke="white"
                  strokeWidth={2}
                  style={{ cursor: 'move', pointerEvents: 'auto' }}
                  onMouseDown={(e) => { e.stopPropagation(); handleBubbleMouseDown(e as any, 'move-tail-tip', undefined, tail.id); }}
                  onTouchStart={(e) => { e.stopPropagation(); handleBubbleMouseDown(e as any, 'move-tail-tip', undefined, tail.id); }}
                />
                <circle
                  cx={worldBaseCX - bubble.x - offsetX + 10}
                  cy={worldBaseCY - bubble.y - offsetY}
                  r={TAIL_BASE_HANDLE_RADIUS}
                  fill="purple"
                  stroke="white"
                  strokeWidth={2}
                  style={{ cursor: 'move', pointerEvents: 'auto' }}
                  onMouseDown={(e) => { e.stopPropagation(); handleBubbleMouseDown(e as any, 'move-tail-base', undefined, tail.id); }}
                  onTouchStart={(e) => { e.stopPropagation(); handleBubbleMouseDown(e as any, 'move-tail-base', undefined, tail.id); }}
                />
              </>
            )}
          </g>
        );
      } else if (part.type === 'thought-dot') {
        const dot = part as ThoughtDotPart;
        const offsetX = bbox.x;
        const offsetY = bbox.y;
        return (
          <circle
            key={dot.id}
            cx={dot.offsetX - offsetX}
            cy={dot.offsetY - offsetY}
            r={dot.size / 2}
            fill="white"
            stroke={bubble.borderColor}
            strokeWidth={strokeWidth}
            style={{ cursor: (isSelected && !isEditingText) ? 'move' : 'default', pointerEvents: (isSelected && !isEditingText) ? 'auto' : 'none' }}
            onMouseDown={(e) => { if (isSelected && !isEditingText) { e.stopPropagation(); handleBubbleMouseDown(e as any, 'move-part', undefined, dot.id); } }}
            onTouchStart={(e) => { if (isSelected && !isEditingText) { e.stopPropagation(); handleBubbleMouseDown(e as any, 'move-part', undefined, dot.id); } }}
          />
        );
      }
      return null;
    });
  };

  return (
    <div
      className="bubble-item-component"
      style={bubbleStyle}
      data-bubble-id={bubble.id}
      onMouseDown={(e) => {
        const target = e.target as HTMLElement;
        if (!target.closest('circle') && !target.closest('[style*="cursor: move"]') && target.closest('.bubble-text')) {
          return;
        }
        if (!isEditingText && target.closest('.bubble-item-component')) {
          handleBubbleMouseDown(e, 'move');
        }
      }}
      onWheel={(e) => {
        if (isSelected && !isEditingText && (bubble.type === BubbleType.Thought || bubble.type === BubbleType.Shout)) {
          e.preventDefault();
          e.stopPropagation();
          const delta = e.deltaY > 0 ? 1 : -1;
          const currentVariant = bubble.shapeVariant || 0;
          onUpdate({ ...bubble, shapeVariant: currentVariant + delta });
        }
      }}
      onDoubleClick={handleBubbleBodyDoubleClick}
    >


      <svg style={svgStyle}>
        {bodyPath && (
          <path
            d={bodyPath}
            fill="white"
            stroke={bubble.borderColor}
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray}
            strokeLinejoin="round"
            strokeLinecap="round"
            transform={`translate(${-bbox.x}, ${-bbox.y})`}
          />
        )}
        {renderParts()}
      </svg>

      <div
        style={textContainerStyle}
        onMouseDown={(e) => {
          if (!isEditingText) {
            handleBubbleMouseDown(e, 'move');
          }
        }}
        onClick={handleTextClick}
      >
        <div
          ref={textEditRef}
          contentEditable={isEditingText}
          suppressContentEditableWarning
          onBlur={handleTextBlur}
          className="bubble-text"
          style={textEditStyle}
        />
      </div>

      {renderResizeHandles()}
    </div>
  );
});
