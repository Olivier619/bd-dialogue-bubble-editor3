import { Bubble, BubbleType } from '../types';

/**
 * Zones de sécurité optimisées pour chaque type de bulle
 * Ces valeurs garantissent que le texte reste toujours dans la zone blanche
 * widthFactor: pourcentage de la largeur totale utilisable pour le texte
 * heightFactor: pourcentage de la hauteur totale utilisable pour le texte
 */
export const SAFE_TEXT_ZONES: Record<BubbleType, { widthFactor: number; heightFactor: number }> = {
  [BubbleType.Shout]: { widthFactor: 0.50, heightFactor: 0.775 },       // Bulles éclair - réduit marge verticale par 2
  [BubbleType.Thought]: { widthFactor: 0.50, heightFactor: 0.825 },     // Nuages de pensée - réduit marge verticale par 2
  [BubbleType.SpeechDown]: { widthFactor: 0.83, heightFactor: 0.915 }, // Dialogue classique - réduit marge verticale par 2
  [BubbleType.SpeechUp]: { widthFactor: 0.83, heightFactor: 0.915 },   // Dialogue vers le haut - réduit marge verticale par 2
  [BubbleType.Whisper]: { widthFactor: 0.80, heightFactor: 0.90 },    // Chuchotement - réduit marge verticale par 2
  [BubbleType.Descriptive]: { widthFactor: 0.90, heightFactor: 0.925 }, // Rectangulaire - réduit marge verticale par 2
  [BubbleType.TextOnly]: { widthFactor: 0.95, heightFactor: 0.95 },    // Texte seul - réduit marge verticale par 2
};

/**
 * Calcule l'interligne (l'espace supplémentaire entre les lignes) dynamiquement
 * selon le barème de l'utilisateur :
 * 5px: -20% (gap=4px), 10px: -30% (gap=7px), ..., 40px: -60% (gap=16px)
 */
export function getLineHeightOffset(size: number): number {
  let reduction: number;
  if (size < 10) {
    // Entre 5px (0.2) et 10px (0.3)
    reduction = 0.2 + (size - 5) * 0.02;
  } else {
    // Entre 10px (0.3) et 40px (0.6) avec 1% d'augmentation par pixel
    reduction = 0.3 + (size - 10) * 0.01;
  }
  // L'offset est le gap entre les lignes
  return size * (1 - Math.min(0.8, reduction));
}

/**
 * Interface pour les résultats du calcul d'auto-ajustement
 */
export interface TextFitResult {
  fontSize: number;
  textWidth: number;
  textHeight: number;
  fits: boolean;
  scaleFactor: number;
}

/**
 * Calcule les dimensions de la zone de texte utilisable dans une bulle
 */
export function getTextBounds(bubble: Bubble): { width: number; height: number; x: number; y: number } {
  const safeZone = SAFE_TEXT_ZONES[bubble.type] || { widthFactor: 0.80, heightFactor: 0.75 };

  const width = bubble.width * safeZone.widthFactor;
  const height = bubble.height * safeZone.heightFactor;
  const x = (bubble.width - width) / 2;
  const y = (bubble.height - height) / 2;

  return { width, height, x, y };
}

/**
 * Mesure les dimensions du texte avec une taille de police donnée
 * Utilise un canvas temporaire pour une mesure précise
 */
export function measureText(
  text: string,
  fontFamily: string,
  fontSize: number,
  maxWidth: number
): { width: number; height: number; lines: number } {
  // Créer un canvas temporaire pour mesurer
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return { width: maxWidth, height: fontSize * 1.4, lines: 1 };
  }

  ctx.font = `${fontSize}px ${fontFamily}`;

  // Enlever les balises HTML pour mesurer le texte pur
  const plainText = text.replace(/<[^>]*>/g, '');
  const words = plainText.split(/\s+/);

  let lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);

    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  const lineHeight = fontSize + getLineHeightOffset(fontSize);
  const totalHeight = lines.length * lineHeight;
  const maxLineWidth = Math.max(...lines.map(line => ctx.measureText(line).width));

  return {
    width: maxLineWidth,
    height: totalHeight,
    lines: lines.length
  };
}

/**
 * Calcule la taille de police optimale pour qu'un texte s'ajuste dans une bulle
 * Réduit progressivement la taille jusqu'à ce que le texte rentre
 */
export function calculateOptimalFontSize(
  text: string,
  bubble: Bubble,
  fontFamily: string,
  minFontSize: number = 8,
  maxFontSize: number = 40
): TextFitResult {
  const textBounds = getTextBounds(bubble);
  const targetFontSize = bubble.fontSize;

  // Commencer avec la taille souhaitée
  let fontSize = Math.min(targetFontSize, maxFontSize);
  let iterations = 0;
  const maxIterations = 20;

  while (fontSize >= minFontSize && iterations < maxIterations) {
    const dimensions = measureText(text, fontFamily, fontSize, textBounds.width);

    // Vérifier si le texte rentre dans les limites
    if (dimensions.height <= textBounds.height && dimensions.width <= textBounds.width) {
      return {
        fontSize,
        textWidth: dimensions.width,
        textHeight: dimensions.height,
        fits: true,
        scaleFactor: fontSize / targetFontSize
      };
    }

    // Réduire la taille de police
    fontSize = Math.max(minFontSize, fontSize - 1);
    iterations++;
  }

  // Si on n'a pas trouvé de taille qui convient, retourner la taille minimale
  const dimensions = measureText(text, fontFamily, minFontSize, textBounds.width);

  return {
    fontSize: minFontSize,
    textWidth: dimensions.width,
    textHeight: dimensions.height,
    fits: dimensions.height <= textBounds.height,
    scaleFactor: minFontSize / targetFontSize
  };
}

/**
 * Détecte si un texte déborde de sa bulle
 */
export function detectTextOverflow(text: string, bubble: Bubble, fontFamily: string): boolean {
  const textBounds = getTextBounds(bubble);
  const dimensions = measureText(text, fontFamily, bubble.fontSize, textBounds.width);

  return dimensions.height > textBounds.height || dimensions.width > textBounds.width;
}

/**
 * Applique automatiquement l'ajustement du texte à une bulle
 * Retourne une nouvelle bulle avec la taille de police ajustée
 */
export function autoFitBubbleText(bubble: Bubble, fontFamily: string): Bubble {
  // Ne pas modifier les bulles TextOnly ou si le texte est vide/default
  if (bubble.type === BubbleType.TextOnly || !bubble.text || bubble.text === 'Votre texte ici') {
    return bubble;
  }

  const result = calculateOptimalFontSize(bubble.text, bubble, fontFamily);

  // Si la taille est déjà optimale, ne rien changer
  if (result.fontSize === bubble.fontSize) {
    return bubble;
  }

  // Retourner une copie avec la nouvelle taille
  return {
    ...bubble,
    fontSize: result.fontSize
  };
}
