import { Bubble, BubbleType, SpeechTailPart, ThoughtDotPart } from '../types';

export interface BubblePaths {
    bodyPath: string;
    partsCircles: { id: string; cx: number; cy: number; r: number }[];
}

export function generateBubblePaths(bubble: Bubble): BubblePaths {
    const { width: w, height: h, type, parts } = bubble;
    const paths: BubblePaths = { bodyPath: '', partsCircles: [] };

    // Fix for "vertical lines": Use a larger radius to create a pill shape for speech bubbles
    // If the user wants to remove vertical lines, they likely want fully rounded sides.
    // r = h / 2 will make it a pill shape if w >= h.
    // We clamp it to w/2 just in case.
    let r = 20;
    if (type === BubbleType.SpeechDown || type === BubbleType.SpeechUp || type === BubbleType.Whisper) {
        r = Math.min(w, h) / 2;
    } else if (type === BubbleType.Descriptive) {
        r = 5;
    }

    if (type === BubbleType.SpeechDown || type === BubbleType.SpeechUp || type === BubbleType.Whisper) {
        const tail = parts.find(p => p.type === 'speech-tail') as SpeechTailPart | undefined;
        if (tail) {
            const { baseCX, baseCY, baseWidth, tipX, tipY } = tail;
            const halfBase = baseWidth / 2;

            const clampedBaseCX = Math.max(0, Math.min(w, baseCX));
            const clampedBaseCY = Math.max(0, Math.min(h, baseCY));

            const createTailPath = (startPt: { x: number, y: number }, endPt: { x: number, y: number }) => {
                const midY = clampedBaseCY + (tipY - clampedBaseCY) * 0.5;
                return `L ${startPt.x},${startPt.y} Q ${startPt.x + (tipX - startPt.x) * 0.25},${midY} ${tipX},${tipY} Q ${endPt.x + (tipX - endPt.x) * 0.25},${midY} ${endPt.x},${endPt.y}`;
            };

            // Construire le path en fonction de la position de la base de la queue
            if (clampedBaseCY === h) {
                // Queue en bas
                const leftBaseX = Math.max(r, clampedBaseCX - halfBase);
                const rightBaseX = Math.min(w - r, clampedBaseCX + halfBase);

                paths.bodyPath = `M${r},0 L${w - r},0 A${r},${r} 0 0 1 ${w},${r} L${w},${h - r} A${r},${r} 0 0 1 ${w - r},${h} L${rightBaseX},${h} ${createTailPath({ x: rightBaseX, y: h }, { x: leftBaseX, y: h })} L${r},${h} A${r},${r} 0 0 1 0,${h - r} L0,${r} A${r},${r} 0 0 1 ${r},0 Z`;
            } else if (clampedBaseCY === 0) {
                // Queue en haut
                const leftBaseX = Math.max(r, clampedBaseCX - halfBase);
                const rightBaseX = Math.min(w - r, clampedBaseCX + halfBase);

                paths.bodyPath = `M${r},0 L${leftBaseX},0 ${createTailPath({ x: leftBaseX, y: 0 }, { x: rightBaseX, y: 0 })} L${w - r},0 A${r},${r} 0 0 1 ${w},${r} L${w},${h - r} A${r},${r} 0 0 1 ${w - r},${h} L${r},${h} A${r},${r} 0 0 1 0,${h - r} L0,${r} A${r},${r} 0 0 1 ${r},0 Z`;
            } else if (clampedBaseCX === w) {
                // Queue à droite
                const topBaseY = Math.max(r, clampedBaseCY - halfBase);
                const bottomBaseY = Math.min(h - r, clampedBaseCY + halfBase);

                paths.bodyPath = `M${r},0 L${w - r},0 A${r},${r} 0 0 1 ${w},${r} L${w},${topBaseY} ${createTailPath({ x: w, y: topBaseY }, { x: w, y: bottomBaseY })} L${w},${h - r} A${r},${r} 0 0 1 ${w - r},${h} L${r},${h} A${r},${r} 0 0 1 0,${h - r} L0,${r} A${r},${r} 0 0 1 ${r},0 Z`;
            } else if (clampedBaseCX === 0) {
                // Queue à gauche
                const topBaseY = Math.max(r, clampedBaseCY - halfBase);
                const bottomBaseY = Math.min(h - r, clampedBaseCY + halfBase);

                paths.bodyPath = `M${r},0 L${w - r},0 A${r},${r} 0 0 1 ${w},${r} L${w},${h - r} A${r},${r} 0 0 1 ${w - r},${h} L${r},${h} A${r},${r} 0 0 1 0,${h - r} L0,${bottomBaseY} ${createTailPath({ x: 0, y: bottomBaseY }, { x: 0, y: topBaseY })} L0,${r} A${r},${r} 0 0 1 ${r},0 Z`;
            } else {
                // Pas de queue visible (au milieu)
                paths.bodyPath = `M${r},0 L${w - r},0 A${r},${r} 0 0 1 ${w},${r} L${w},${h - r} A${r},${r} 0 0 1 ${w - r},${h} L${r},${h} A${r},${r} 0 0 1 0,${h - r} L0,${r} A${r},${r} 0 0 1 ${r},0 Z`;
            }
        } else {
            paths.bodyPath = `M${r},0 L${w - r},0 A${r},${r} 0 0 1 ${w},${r} L${w},${h - r} A${r},${r} 0 0 1 ${w - r},${h} L${r},${h} A${r},${r} 0 0 1 0,${h - r} L0,${r} A${r},${r} 0 0 1 ${r},0 Z`;
        }
        return paths;
    }

    // Simple seeded PRNG to ensure stability based on bubble ID and shapeVariant
    const seed = bubble.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) + (bubble.shapeVariant || 0);
    let randomState = seed;
    const random = () => {
        const x = Math.sin(randomState++) * 10000;
        return x - Math.floor(x);
    };

    switch (type) {
        case BubbleType.Descriptive:
            paths.bodyPath = `M${r},0 L${w - r},0 A${r},${r} 0 0 1 ${w},${r} L${w},${h - r} A${r},${r} 0 0 1 ${w - r},${h} L${r},${h} A${r},${r} 0 0 1 0,${h - r} L0,${r} A${r},${r} 0 0 1 ${r},0 Z`;
            break;

        case BubbleType.Thought: {
            const cx = w / 2;
            const cy = h / 2;
            const rx = w * 0.30;
            const ry = h * 0.30;

            // Random number of lobes between 7 and 12
            const lobes = Math.floor(random() * 6) + 7;

            let path = '';
            for (let i = 0; i < lobes; i++) {
                const angle = (i / lobes) * Math.PI * 2 - Math.PI / 2;
                const nextAngle = ((i + 1) / lobes) * Math.PI * 2 - Math.PI / 2;

                const x1 = cx + rx * Math.cos(angle);
                const y1 = cy + ry * Math.sin(angle);
                const x2 = cx + rx * Math.cos(nextAngle);
                const y2 = cy + ry * Math.sin(nextAngle);

                if (i === 0) {
                    path += `M${x1},${y1}`;
                }

                const midAngle = (angle + nextAngle) / 2;

                // Random bulge factor for each lobe (1.3 to 1.6)
                const bulgeFactor = 1.3 + random() * 0.3;

                const cpx = cx + rx * bulgeFactor * Math.cos(midAngle);
                const cpy = cy + ry * bulgeFactor * Math.sin(midAngle);

                path += ` Q${cpx},${cpy} ${x2},${y2}`;
            }

            paths.bodyPath = path + ' Z';

            parts.forEach(part => {
                if (part.type === 'thought-dot') {
                    paths.partsCircles.push({
                        id: part.id,
                        cx: part.offsetX,
                        cy: part.offsetY,
                        r: part.size / 2
                    });
                }
            });
            break;
        }

        case BubbleType.Shout: {
            let path = '';
            const points = 14; // Number of spikes
            const cx = w / 2, cy = h / 2;
            const outerRx = w / 2;
            const outerRy = h / 2;
            const innerRx = w / 3.5; // Deeper spikes
            const innerRy = h / 3.5;

            for (let i = 0; i < points * 2; i++) {
                const angle = (i * Math.PI) / points - Math.PI / 2; // Start at top
                const isOuter = i % 2 === 0;

                // Randomness requested by user: half the spikes (outer ones) are random
                let randomFactor = 1.0;
                if (isOuter) {
                    // Outer spikes: large variance (0.6 to 1.4)
                    randomFactor = 0.6 + random() * 0.8;
                } else {
                    // Inner valleys: small variance (0.9 to 1.1) to keep text area safe
                    randomFactor = 0.9 + random() * 0.2;
                }

                const currRx = (isOuter ? outerRx : innerRx) * randomFactor;
                const currRy = (isOuter ? outerRy : innerRy) * randomFactor;

                const px = cx + currRx * Math.cos(angle);
                const py = cy + currRy * Math.sin(angle);

                path += `${i === 0 ? 'M' : 'L'}${px},${py} `;
            }
            paths.bodyPath = path + 'Z';
            break;
        }

        case BubbleType.TextOnly:
            paths.bodyPath = '';
            break;
    }

    return paths;
}

export function getOverallBbox(bubble: Bubble) {
    let minX = 0, minY = 0, maxX = bubble.width, maxY = bubble.height;

    bubble.parts.forEach(part => {
        if (part.type === 'speech-tail') {
            minX = Math.min(minX, part.tipX);
            maxX = Math.max(maxX, part.tipX);
            minY = Math.min(minY, part.tipY);
            maxY = Math.max(maxY, part.tipY);
        } else if (part.type === 'thought-dot') {
            minX = Math.min(minX, part.offsetX - part.size / 2);
            maxX = Math.max(maxX, part.offsetX + part.size / 2);
            minY = Math.min(minY, part.offsetY - part.size / 2);
            maxY = Math.max(maxY, part.offsetY + part.size / 2);
        }
    });

    const padding = 10;
    minX -= padding; minY -= padding;
    maxX += padding; maxY += padding;

    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
