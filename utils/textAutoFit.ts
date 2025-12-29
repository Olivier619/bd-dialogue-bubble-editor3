import { Bubble, BubbleType } from '../types';

/**
 * Zones de sécurité optimisées pour chaque type de bulle
 * Ces valeurs garantissent que le texte reste toujours dans la zone blanche
 * widthFactor: pourcentage de la largeur totale utilisable pour le texte
 * heightFactor: pourcentage de la hauteur totale utilisable pour le texte
 */
export const SAFE_TEXT_ZONES: Record<BubbleType, { widthFactor: number; heightFactor: number }> = {
  [BubbleType.Shout]: { widthFactor: 0.50, heightFactor: 0.55 },        // Bulles éclair - très prudent
  [BubbleType.Thought]: { widthFactor: 0.50, heightFactor: 0.65 },      // Nuages de pensée
  [BubbleType.SpeechDown]: { widthFactor: 0.83, heightFactor: 0.83 },  // Dialogue classique
  [BubbleType.SpeechUp]: { widthFactor: 0.83, heightFactor: 0.83 },    // Dialogue vers le haut
  [BubbleType.Whisper]: { widthFactor: 0.80, heightFactor: 0.80 },     // Chuchotement
  [BubbleType.Descriptive]: { widthFactor: 0.90, heightFactor: 0.85 },  // Rectangulaire
  [BubbleType.TextOnly]: { widthFactor: 0.95, heightFactor: 0.90 },     // Texte seul - maximum
};

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
  // Pour les bulles irrégulières, utiliser des zones de sécurité très conservatrices
  // Pour les bulles régulières, utiliser un padding standard
  let textWidth: number;
  let textHeight: number;
  let textX: number;
  let textY: number;

  if (bubble.type === BubbleType.Shout || bubble.type === BubbleType.Thought) {
    // Bulles très irrégulières - facteurs très conservateurs
    const safeZone = SAFE_TEXT_ZONES[bubble.type];
    textWidth = bubble.width * safeZone.widthFactor;
    textHeight = bubble.height * safeZone.heightFactor;
    textX = (bubble.width - textWidth) / 2;
    textY = (bubble.height - textHeight) / 2;
  } else {
    // Bulles régulières - padding standard de 10px
    const padding = 10;
    textWidth = bubble.width - (padding * 2);
    textHeight = bubble.height - (padding * 2);
    textX = padding;
    textY = padding;
  }

  return { width: textWidth, height: textHeight, x: textX, y: textY };
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

  const lineHeight = fontSize * 1.4; // line-height: 1.4 comme dans BubbleItem
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
