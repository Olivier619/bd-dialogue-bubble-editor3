import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Toolbar } from './components/Toolbar.tsx';
import { CanvasArea } from './components/CanvasArea.tsx';
import { Bubble, BubblePart, BubbleType, FontName, ToolSettings, MIN_BUBBLE_WIDTH, MIN_BUBBLE_HEIGHT, MIN_TAIL_LENGTH, MIN_TAIL_BASE_WIDTH, MIN_DOT_COUNT, MIN_DOT_SIZE, BUBBLE_REQUIRES_PARTS, SpeechTailPart, ThoughtDotPart } from './types.ts';
import { BubbleItemHandle } from './components/BubbleItem.tsx';
import { generateBubblePaths } from './utils/bubbleUtils';

const App: React.FC = () => {
  const [uploadedImage, setUploadedImage] = useState<{ url: string; width: number; height: number } | null>(null);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [selectedBubbleId, setSelectedBubbleId] = useState<string | null>(null);
  const [toolSettings, setToolSettings] = useState<ToolSettings>({
    activeBubbleType: BubbleType.SpeechDown,
    activeFontFamily: FontName.Comic,
    activeFontSize: 12,
    activeTextColor: '#000000',
    activeBorderColor: '#000000',
    defaultTailLength: 30,
    defaultTailBaseWidth: 20,
    defaultDotCount: 4,
    defaultDotSize: 15,

  });
  const [isSaving, setIsSaving] = useState(false);
  const [canvasSize, setCanvasSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const nextZIndex = useRef(10);
  const selectedBubbleRef = useRef<BubbleItemHandle>(null);

  const bubblesRef = useRef(bubbles);
  useEffect(() => {
    bubblesRef.current = bubbles;
  }, [bubbles]);

  useEffect(() => {
    if (uploadedImage) {
      // Smart scaling to fit screen
      const maxWidth = window.innerWidth * 0.9; // 90% of screen width
      const maxHeight = window.innerHeight * 0.8; // 80% of screen height (account for headers)

      const scaleX = maxWidth / uploadedImage.width;
      const scaleY = maxHeight / uploadedImage.height;

      // Use the smaller scale to ensure it fits both dimensions, but limit to 1.0 (don't upscale) or allow zoom? 
      // Usually reducing huge images is the goal.
      // Let's cap max scale at 1.0 to avoid blurry upscaling of small images, but usually comic pages are huge.
      const scale = Math.min(scaleX, scaleY, 1.0); // Remove 1.0 cap if you want to zoom up small images

      setCanvasSize({
        width: Math.floor(uploadedImage.width * scale),
        height: Math.floor(uploadedImage.height * scale)
      });
    } else {
      setCanvasSize({ width: 800, height: 600 });
    }
  }, [uploadedImage]);

  useEffect(() => {
    if (selectedBubbleId) {
      const selectedBubble = bubbles.find(b => b.id === selectedBubbleId);
      if (selectedBubble) {
        setToolSettings(prev => ({
          ...prev,
          activeFontFamily: selectedBubble.fontFamily,
          activeFontSize: selectedBubble.fontSize,
          activeTextColor: selectedBubble.textColor,
          activeBorderColor: selectedBubble.borderColor,
        }));
      }
    }
  }, [selectedBubbleId, bubbles]);

  const handleImageUpload = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        setUploadedImage({ url: e.target?.result as string, width: img.width, height: img.height });
        setBubbles([]);
        setSelectedBubbleId(null);
        nextZIndex.current = 10;
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }, []);

  const handleAddBubble = useCallback((x: number, y: number) => {
    if (!uploadedImage) return;

    const newBubbleId = `bubble-${Date.now()}`;
    const initialWidth = 150;
    const initialHeight = initialWidth * 0.6;

    const bubbleX = Math.max(0, Math.min(x - initialWidth / 2, canvasSize.width - initialWidth));
    const bubbleY = Math.max(0, Math.min(y - initialHeight / 2, canvasSize.height - initialHeight));

    const newParts: BubblePart[] = [];
    if (BUBBLE_REQUIRES_PARTS.includes(toolSettings.activeBubbleType)) {
      const baseCX = initialWidth / 2;
      const currentDefaultTailBaseWidth = Math.max(MIN_TAIL_BASE_WIDTH, toolSettings.defaultTailBaseWidth);
      const currentDefaultTailLength = Math.max(MIN_TAIL_LENGTH, toolSettings.defaultTailLength);

      if (toolSettings.activeBubbleType === BubbleType.SpeechDown || toolSettings.activeBubbleType === BubbleType.Whisper) {
        const baseCY = initialHeight;
        newParts.push({
          id: `part-${Date.now()}`, type: 'speech-tail',
          baseCX: baseCX,
          baseCY: baseCY,
          baseWidth: currentDefaultTailBaseWidth,
          tipX: baseCX,
          tipY: baseCY + currentDefaultTailLength,
          initialLength: currentDefaultTailLength,
          initialBaseWidth: currentDefaultTailBaseWidth,
        } as SpeechTailPart);
      } else if (toolSettings.activeBubbleType === BubbleType.SpeechUp) {
        const baseCY = 0;
        newParts.push({
          id: `part-${Date.now()}`, type: 'speech-tail',
          baseCX: baseCX,
          baseCY: baseCY,
          baseWidth: currentDefaultTailBaseWidth,
          tipX: baseCX,
          tipY: baseCY - currentDefaultTailLength,
          initialLength: currentDefaultTailLength,
          initialBaseWidth: currentDefaultTailBaseWidth,
        } as SpeechTailPart);
      } else if (toolSettings.activeBubbleType === BubbleType.Thought) {
        const numDots = Math.max(MIN_DOT_COUNT, toolSettings.defaultDotCount);
        const baseDotSize = Math.max(MIN_DOT_SIZE, toolSettings.defaultDotSize);
        const startOffsetX = initialWidth / 2;
        const startOffsetY = initialHeight;
        for (let i = 0; i < numDots; i++) {
          const size = Math.max(MIN_DOT_SIZE, baseDotSize - i * (baseDotSize / Math.max(1, numDots - 1) * 0.5));
          newParts.push({
            id: `part-${Date.now()}-${i}`, type: 'thought-dot',
            offsetX: startOffsetX - (numDots * (size + 5)) / 2 + i * (size + 5) + size / 2,
            offsetY: startOffsetY + i * (size / 2 + 2) + 10 + size / 2,
            size
          } as ThoughtDotPart);
        }
      }
    }

    const newBubble: Bubble = {
      id: newBubbleId,
      type: toolSettings.activeBubbleType,
      text: 'Votre texte ici',
      x: bubbleX,
      y: bubbleY,
      width: initialWidth,
      height: initialHeight,
      fontFamily: toolSettings.activeFontFamily,
      fontSize: toolSettings.activeFontSize,
      textColor: toolSettings.activeTextColor,
      borderColor: toolSettings.activeBorderColor,
      zIndex: nextZIndex.current++,
      parts: newParts,
    };
    setBubbles(prev => [...prev, newBubble]);
    setSelectedBubbleId(newBubbleId);
  }, [uploadedImage, toolSettings, canvasSize, nextZIndex]);

  const handleSelectBubble = useCallback((id: string | null) => {
    if (id) {
      setBubbles(prevBubbles =>
        prevBubbles.map(b =>
          b.id === id ? { ...b, zIndex: nextZIndex.current++ } : b
        )
      );
    }
    setSelectedBubbleId(id);
  }, []);

  const handleUpdateBubble = useCallback((updatedBubble: Bubble) => {
    setBubbles(prev => prev.map(b => b.id === updatedBubble.id ? updatedBubble : b));
    if (updatedBubble.id === selectedBubbleId) {
      setToolSettings(prev => ({
        ...prev,
        activeFontFamily: updatedBubble.fontFamily,
        activeFontSize: updatedBubble.fontSize,
        activeTextColor: updatedBubble.textColor,
        activeBorderColor: updatedBubble.borderColor,
      }));
    }
  }, [selectedBubbleId]);

  const handleDeleteBubble = useCallback((id: string) => {
    setBubbles(prev => prev.filter(b => b.id !== id));
    if (selectedBubbleId === id) {
      setSelectedBubbleId(null);
    }
  }, [selectedBubbleId]);

  const handleUpdateToolSettings = useCallback((newSettings: Partial<ToolSettings>) => {
    setToolSettings(prev => ({ ...prev, ...newSettings }));
    if (selectedBubbleId) {
      let appliedToSelection = false;
      if (selectedBubbleRef.current) {
        if (newSettings.activeFontFamily) {
          appliedToSelection = selectedBubbleRef.current.applyStyleToSelection('fontFamily', newSettings.activeFontFamily);
        }
        if (newSettings.activeFontSize) {
          appliedToSelection = selectedBubbleRef.current.applyStyleToSelection('fontSize', newSettings.activeFontSize);
        }
      }

      if (!appliedToSelection) {
        const updates: Partial<Bubble> = {};
        if (newSettings.activeFontFamily) updates.fontFamily = newSettings.activeFontFamily;
        if (newSettings.activeFontSize) updates.fontSize = newSettings.activeFontSize;
        if (newSettings.activeTextColor) updates.textColor = newSettings.activeTextColor;
        if (newSettings.activeBorderColor) updates.borderColor = newSettings.activeBorderColor;

        if (Object.keys(updates).length > 0) {
          setBubbles(prev => prev.map(b => b.id === selectedBubbleId ? { ...b, ...updates } : b));
        }
      }
    }
  }, [selectedBubbleId]);

  const handleClearAll = useCallback(() => {
    setUploadedImage(null);
    setBubbles([]);
    setSelectedBubbleId(null);
    nextZIndex.current = 10;
  }, []);

  const canvasAreaRef = useRef<HTMLDivElement>(null);

  const handleSaveImage = useCallback(async (format: 'png' | 'jpeg') => {
    if (!canvasAreaRef.current || !uploadedImage) {
      alert("Veuillez télécharger une image de BD d'abord !");
      return;
    }

    const previousSelectedId = selectedBubbleId;
    setSelectedBubbleId(null);
    setIsSaving(true);

    await new Promise(resolve => setTimeout(resolve, 300));

    try {
      await document.fonts.ready;

      const canvasElement = canvasAreaRef.current.querySelector('#actual-canvas-content') as HTMLElement;
      if (!canvasElement) {
        alert("Erreur: Impossible de trouver le contenu du canvas.");
        setIsSaving(false);
        setSelectedBubbleId(previousSelectedId);
        return;
      }

      // Créer un canvas temporaire
      const tempCanvas = document.createElement('canvas');
      const ctx = tempCanvas.getContext('2d');
      if (!ctx) throw new Error("Impossible de créer le contexte canvas");

      tempCanvas.width = canvasSize.width * 2;
      tempCanvas.height = canvasSize.height * 2;
      ctx.scale(2, 2);

      // Dessiner l'image de fond
      const img = new Image();
      img.src = uploadedImage.url;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });
      ctx.drawImage(img, 0, 0, canvasSize.width, canvasSize.height);

      // Dessiner chaque bulle manuellement
      for (const bubble of bubblesRef.current.sort((a, b) => a.zIndex - b.zIndex)) {
        // Récupérer le texte actuel
        const bubbleElement = document.querySelector(`[data-bubble-id="${bubble.id}"]`);
        const textElement = bubbleElement?.querySelector('.bubble-text') as HTMLDivElement | null;
        const currentText = textElement ? textElement.innerHTML : bubble.text;

        // Dessiner la bulle et son contenu
        await drawBubbleToCanvas(ctx, bubble, currentText);
      }

      const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
      const quality = format === 'jpeg' ? 0.92 : undefined;
      const imgData = tempCanvas.toDataURL(mimeType, quality);

      const link = document.createElement('a');
      link.download = `planche_bd_modifiee.${format}`;
      link.href = imgData;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Error saving image:", error);
      alert("Erreur lors de l'enregistrement de l'image. Vérifiez la console.");
    } finally {
      setIsSaving(false);
      setSelectedBubbleId(previousSelectedId);
    }
  }, [uploadedImage, selectedBubbleId, canvasSize]);

  // Fonction pour dessiner une bulle sur canvas
  const drawBubbleToCanvas = async (ctx: CanvasRenderingContext2D, bubble: Bubble, text: string) => {
    const { x, y, width, height, type, borderColor, textColor, fontSize, parts } = bubble;

    ctx.save();
    ctx.translate(x, y);

    // Dessiner le corps de la bulle
    if (type !== BubbleType.TextOnly) {
      const { bodyPath, partsCircles } = generateBubblePaths(bubble);

      const path = new Path2D(bodyPath);
      ctx.fillStyle = 'white';
      ctx.fill(path);
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 2;
      if (type === BubbleType.Whisper) {
        ctx.setLineDash([5, 5]);
      }
      ctx.stroke(path);
      ctx.setLineDash([]);

      // Dessiner les parties supplémentaires (comme les points de pensée)
      partsCircles.forEach(part => {
        ctx.beginPath();
        ctx.arc(part.cx, part.cy, part.r, 0, 2 * Math.PI);
        ctx.fillStyle = 'white';
        ctx.fill();
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 2;
        ctx.stroke();
      });
    }

    // Dessiner le texte en utilisant le rendu riche
    const fontMap: Record<string, string> = {
      'font-comic': 'Comic Neue',
      'font-bangers': 'Bangers',
      'font-indie': 'Indie Flower',
      'font-marker': 'Permanent Marker',
      'font-arial': 'Arial',
    };

    // Import the text bounds calculator
    const { calculateTextBounds } = await import('./utils/textBoundsCalculator');

    // Calculate dynamic text bounds based on actual bubble shape
    const getMaxWidthAtY = calculateTextBounds(bubble);

    const { drawRichText } = await import('./utils/richTextRenderer');
    await drawRichText(
      ctx,
      text, // This text is now HTML
      0, // x is handled by ctx.translate
      0, // y is handled by ctx.translate
      width,
      height,
      {
        fontFamily: bubble.fontFamily,
        fontSize: bubble.fontSize,
        textColor: textColor,
        isBold: false,
        isItalic: false,
        isUnderline: false,
        isStrikethrough: false
      },
      fontMap,
      getMaxWidthAtY // Pass the dynamic width function
    );
  } catch (e) {
    console.error("Failed to load or use richTextRenderer", e);
  }

  ctx.restore();
};

const handleSaveProject = useCallback(() => {
  if (!uploadedImage) {
    alert("Veuillez télécharger une image avant de sauvegarder le projet.");
    return;
  }

  const bubblesWithLatestText = bubblesRef.current.map(bubble => {
    const bubbleElement = document.querySelector(`[data-bubble-id="${bubble.id}"]`);
    const textElement = bubbleElement?.querySelector('.bubble-text') as HTMLDivElement | null;

    const currentText = textElement ? textElement.innerHTML : bubble.text;

    return { ...bubble, text: currentText };
  });

  const projectState = {
    image: uploadedImage,
    bubbles: bubblesWithLatestText,
    toolSettings: toolSettings,
    nextZIndex: nextZIndex.current,
    canvasSize: canvasSize,
    version: "1.1"
  };

  const jsonString = JSON.stringify(projectState, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = 'projet-bd.json';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  alert("Projet sauvegardé sous `projet-bd.json` !");
}, [uploadedImage, toolSettings, canvasSize]);

const handleLoadProject = useCallback((file: File) => {
  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const projectState = JSON.parse(event.target?.result as string);

      if (!projectState.image || !projectState.bubbles || !projectState.nextZIndex) {
        throw new Error("Fichier de projet invalide ou corrompu.");
      }

      const defaultBubbleProps = { textColor: '#000000', borderColor: '#000000' };

      setUploadedImage(projectState.image);
      setBubbles(projectState.bubbles.map((b: Bubble) => ({ ...defaultBubbleProps, ...b })));
      setToolSettings(prev => ({ ...prev, ...projectState.toolSettings }));
      nextZIndex.current = projectState.nextZIndex;
      setCanvasSize(projectState.canvasSize || { width: projectState.image.width / 2, height: projectState.image.height / 2 });
      setSelectedBubbleId(null);

      alert("Projet chargé avec succès !");

    } catch (error) {
      console.error("Erreur lors du chargement du projet:", error);
      alert(`Erreur lors du chargement du projet: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    }
  };
  reader.onerror = () => {
    alert("Impossible de lire le fichier de projet.");
  };
  reader.readAsText(file);
}, []);

return (
  <div className="flex flex-col h-screen bg-gray-200">
    <header className="bg-white shadow-md z-10 flex-shrink-0">
      <h1 className="text-2xl sm:text-3xl font-bold py-3 text-center text-gray-800 font-['Bangers'] tracking-wide">
        Éditeur de Bulles de Dialogue
      </h1>
    </header>

    <div className="flex flex-1 overflow-hidden">
      <aside className="w-[420px] flex-shrink-0 overflow-y-auto p-4 bg-gray-50 border-r border-gray-300">
        <Toolbar
          settings={toolSettings}
          onImageUpload={handleImageUpload}
          onSave={handleSaveImage}
          isSaving={isSaving}
          onClear={handleClearAll}
          onSettingChange={handleUpdateToolSettings}
          selectedBubble={bubbles.find(b => b.id === selectedBubbleId) || null}
          onSaveProject={handleSaveProject}
          onLoadProject={handleLoadProject}
          isProjectLoaded={!!uploadedImage}
        />

        <div className="mt-6 p-4 border border-yellow-300 rounded bg-yellow-50 text-yellow-700 text-sm">
          <h2 className="text-lg font-semibold mb-2 font-['Bangers']">Instructions Rapides</h2>
          <ol className="list-decimal pl-5 space-y-1">
            <li><span className="font-semibold">Téléchargez</span> votre planche ou <span className="font-semibold">Ouvrez</span> un projet existant.</li>
            <li><span className="font-semibold">Sélectionnez type de bulle</span> et options (police, taille texte, couleurs, etc.).</li>
            <li><span className="font-semibold">Cliquez sur l'image</span> pour placer une bulle.</li>
            <li><span className="font-semibold">Cliquez sur une bulle</span> pour la sélectionner (bordure bleue).</li>
            <li><span className="font-semibold">Glissez</span> une bulle sélectionnée pour la déplacer.</li>
            <li><span className="font-semibold">Glissez les poignées bleues</span> pour redimensionner.</li>
            <li><span className="font-semibold">Poignées Orange/Violette</span> sur la queue pour l'ajuster (pointe et base).</li>
            <li><span className="font-semibold">Cliquez dans le texte</span> pour éditer. <span className="font-semibold">Molette souris</span> pour changer la taille (sélectionnez une partie pour redimensionner localement).</li>
            <li><span className="font-semibold">Double-cliquez sur la bordure</span> d'une bulle pour la supprimer.</li>
            <li><span className="font-semibold">Sauvegardez</span> le projet (.json) ou <span className="font-semibold">Exportez</span> en PNG/JPG.</li>
          </ol>
        </div>
      </aside>

      <main className="flex-1 flex justify-center items-start p-6 overflow-auto bg-gray-300">
        <CanvasArea
          ref={canvasAreaRef}
          image={uploadedImage}
          bubbles={bubbles}
          selectedBubbleId={selectedBubbleId}
          onAddBubble={handleAddBubble}
          onSelectBubble={handleSelectBubble}
          onUpdateBubble={handleUpdateBubble}
          onDeleteBubble={handleDeleteBubble}
          isSaving={isSaving}
          canvasSize={canvasSize}
          selectedBubbleRef={selectedBubbleRef}
        />
      </main>
    </div>
  </div>
);
};

export default App;