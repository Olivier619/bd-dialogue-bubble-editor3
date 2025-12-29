import { Bubble, BubbleType } from '../types';
import { generateBubblePaths } from './bubbleUtils';

/**
 * Calcule les limites de texte sûres pour une bulle donnée en analysant son chemin SVG.
 * Retourne une fonction qui donne la largeur maximale disponible à une position Y donnée.
 */
export function calculateTextBounds(bubble: Bubble): (y: number) => number {
    const { width, height, type } = bubble;

    // Pour les bulles simples (rectangulaires), retourner une largeur fixe avec padding
    if (type === BubbleType.Descriptive || type === BubbleType.TextOnly) {
        const safeWidth = width * 0.92;
        return () => safeWidth;
    }

    // Pour les bulles avec formes complexes, analyser le chemin SVG
    const { bodyPath } = generateBubblePaths(bubble);

    // Échantillonner le chemin à différentes hauteurs Y
    const samples = samplePathAtYPositions(bodyPath, height, 20); // 20 échantillons

    // Créer une fonction d'interpolation
    return (y: number) => {
        // Trouver la largeur disponible à cette position Y
        const relativeY = y / height;
        const sampleIndex = Math.floor(relativeY * (samples.length - 1));

        if (sampleIndex < 0 || sampleIndex >= samples.length) {
            return width * 0.5; // Valeur par défaut sûre
        }

        return samples[sampleIndex];
    };
}

/**
 * Échantillonne un chemin SVG à différentes positions Y pour trouver la largeur disponible.
 */
function samplePathAtYPositions(pathString: string, totalHeight: number, numSamples: number): number[] {
    const samples: number[] = [];

    // Créer un élément SVG temporaire pour analyser le chemin
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathString);
    svg.appendChild(path);
    document.body.appendChild(svg);

    try {
        const pathLength = path.getTotalLength();

        for (let i = 0; i < numSamples; i++) {
            const y = (i / (numSamples - 1)) * totalHeight;

            // Trouver les points d'intersection avec cette ligne Y
            const intersections = findIntersectionsAtY(path, y, pathLength);

            if (intersections.length >= 2) {
                // Calculer la largeur entre les intersections les plus éloignées
                const minX = Math.min(...intersections);
                const maxX = Math.max(...intersections);
                const availableWidth = maxX - minX;

                // Appliquer un padding de sécurité (15% de chaque côté)
                samples.push(availableWidth * 0.70);
            } else {
                // Si pas d'intersection trouvée, utiliser une valeur conservatrice
                samples.push(totalHeight * 0.5);
            }
        }
    } finally {
        document.body.removeChild(svg);
    }

    return samples;
}

/**
 * Trouve les intersections d'un chemin SVG avec une ligne horizontale à Y.
 */
function findIntersectionsAtY(path: SVGPathElement, targetY: number, pathLength: number): number[] {
    const intersections: number[] = [];
    const precision = 100; // Nombre de points à vérifier

    let wasAbove = false;
    let lastPoint: DOMPoint | null = null;

    for (let i = 0; i <= precision; i++) {
        const distance = (i / precision) * pathLength;
        const point = path.getPointAtLength(distance);

        if (lastPoint) {
            const isAbove = point.y < targetY;

            // Détection de croisement
            if (wasAbove !== isAbove) {
                // Interpolation linéaire pour trouver le X exact de l'intersection
                const t = (targetY - lastPoint.y) / (point.y - lastPoint.y);
                const intersectionX = lastPoint.x + t * (point.x - lastPoint.x);
                intersections.push(intersectionX);
            }

            wasAbove = isAbove;
        } else {
            wasAbove = point.y < targetY;
        }

        lastPoint = point;
    }

    return intersections;
}
