import { getLineHeightOffset } from './textAutoFit';

export interface TextStyle {
    fontFamily: string;
    fontSize: number;
    textColor: string;
    isBold: boolean;
    isItalic: boolean;
    isUnderline: boolean;
    isStrikethrough: boolean;
}

interface TextSegment {
    text: string;
    style: TextStyle;
    width: number; // calculated width
    height: number; // calculated height (approximated from font size)
}

interface TextLine {
    segments: TextSegment[];
    width: number;
    height: number; // max height of segments in line
}

/**
 * Parses HTML content from the bubble and returns a list of text segments with styles.
 * This is a simplified parser tailored for contentEditable output (divs, spans, fonts, b, i, u, br).
 */
function parseRichText(html: string, defaultStyle: TextStyle): TextSegment[] {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const segments: TextSegment[] = [];

    function traverse(node: Node, currentStyle: TextStyle) {
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent || '';
            if (text) {
                // Don't measure here, just create segment. Measurement needs context.
                segments.push({
                    text,
                    style: { ...currentStyle },
                    width: 0,
                    height: 0
                });
            }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as HTMLElement;
            let newStyle = { ...currentStyle };

            // Apply styles based on tag or attributes
            const tagName = element.tagName.toLowerCase();
            if (tagName === 'b' || tagName === 'strong' || element.style.fontWeight === 'bold') {
                newStyle.isBold = true;
            }
            if (tagName === 'i' || tagName === 'em' || element.style.fontStyle === 'italic') {
                newStyle.isItalic = true;
            }
            if (tagName === 'u' || element.style.textDecoration.includes('underline')) {
                newStyle.isUnderline = true;
            }
            if (tagName === 's' || tagName === 'strike' || element.style.textDecoration.includes('line-through')) {
                newStyle.isStrikethrough = true;
            }
            if (tagName === 'br') {
                segments.push({ text: '\n', style: { ...newStyle }, width: 0, height: 0 });
                return; // BR has no children
            }

            // Handle font size
            if (element.style.fontSize) {
                const size = parseInt(element.style.fontSize);
                if (!isNaN(size)) {
                    newStyle.fontSize = size;
                }
            }

            // Handle font family from style or legacy 'face' attribute
            const face = element.getAttribute('face');
            if (element.style.fontFamily) {
                // strip quotes and handle comma separated lists by taking the first font
                newStyle.fontFamily = element.style.fontFamily.split(',')[0].replace(/['"]/g, '').trim();
            } else if (face) {
                newStyle.fontFamily = face.split(',')[0].replace(/['"]/g, '').trim();
            }

            // Handle color from style or legacy 'color' attribute
            const colorAttr = element.getAttribute('color');
            if (element.style.color) {
                newStyle.textColor = element.style.color;
            } else if (colorAttr) {
                newStyle.textColor = colorAttr;
            }

            // Recursive traversal
            element.childNodes.forEach(child => traverse(child, newStyle));

            // Handle block elements which imply a newline after them (like div)
            if (tagName === 'div' || tagName === 'p') {
                // If not the last element, add a newline
                // segments.push({ text: '\n', style: { ...newStyle }, width: 0, height: 0 });
                // Note: contentEditable usually puts each line in a div. 
                // If we add \n here, we might get double spacing if we aren't careful.
                // A simplified approach: treat 'div' start as newline if it's not the first element?
                // Or just rely on BRs. ContentEditable is often valid HTML. 
                // Let's rely on the structure:
                // text
                // <div>text</div>
                // implies newline before second text.
            }
        }
    }

    // Pre-process: replace <div> with <br><div> ? Chrome contenteditable often wraps lines in divs.
    // A cleaner way is to handle block elements by ensuring they start on a new line.

    // Let's use a simpler approach for now:
    // We just traverse. If we encounter a block element and we aren't at the start of a line, we insert a break.
    // Actually, standard DOM traversal is safer.

    traverse(doc.body, defaultStyle);

    // Post-process to handle block-level breaks
    // If we have divs, they usually represent lines.
    // For this MVP, let's assume `br` is the primary line breaker, or `div`.
    // If the user presses enter in contenteditable, it often creates `<div><br></div>` or `<div>text</div>`.

    return segments;
}



export async function drawRichText(
    ctx: CanvasRenderingContext2D,
    html: string,
    x: number,
    y: number,
    width: number,
    height: number,
    defaultStyle: TextStyle,
    fontMap: Record<string, string>,
    getMaxWidthAtY?: (y: number) => number
) {
    // 1. Parsing
    let segments = parseRichText(html, defaultStyle);

    // 2. Add implied newlines for block elements if parsing didn't catch them. 
    // Actually, let's refine the parser logic later if needed. 
    // For now, let's assume explicit <br> or \n characters are used.
    // ContentEditable behavior: 'Enter' often wraps in <div>.
    // If we see <div>text</div>, it should be a new line.
    // Re-parsing approach: 
    // We can inject \n in the HTML string before parsing? 
    // html = html.replace(/<div/g, '<br><div').replace(/<p/g, '<br><p'); 
    // This is a hack but effective for visual reconstruction.

    const processedHtml = html.replace(/<div>/g, '<br>').replace(/<\/div>/g, '');
    // CAUTION: This might be too aggressive if divs are nested for other reasons, but for simple text editor it works.

    segments = parseRichText(processedHtml, defaultStyle);


    // 3. Measure segments
    ctx.save();
    segments.forEach(seg => {
        if (seg.text === '\n') return;

        let fontName = fontMap[seg.style.fontFamily] || seg.style.fontFamily || 'Arial, sans-serif';
        if (!fontName.includes(',') && !fontName.startsWith("'")) fontName = `'${fontName}'`;

        // Construct font string
        let fontStr = '';
        if (seg.style.isItalic) fontStr += 'italic ';
        if (seg.style.isBold) fontStr += 'bold ';
        fontStr += `${seg.style.fontSize}px ${fontName}`;

        ctx.font = fontStr;
        seg.width = ctx.measureText(seg.text).width;
        seg.height = seg.style.fontSize; // Approximate line height contribution
    });


    // 4. Line Wrapping
    const lines: TextLine[] = [];
    let currentLine: TextLine = { segments: [], width: 0, height: 0 };
    let currentY = 0; // Track current Y position for dynamic width
    const basePadding = 20;

    segments.forEach(seg => {
        if (seg.text === '\n') {
            lines.push(currentLine);
            currentLine = { segments: [], width: 0, height: 0 };
            return;
        }

        // Does it fit?
        // If text is long, we might need to split it.
        // Simple word wrapping:
        const words = seg.text.split(/(\s+)/); // keep separators

        words.forEach(word => {
            // Measure word
            // We reuse the ctx.font that was set? No, we need to set it again or store it.
            // Let's assume we can re-measure or just estimate proportion if we already measured the whole segment.
            // Better: measure each word properly.

            // Re-set font for accurate measure
            let fontName = fontMap[seg.style.fontFamily] || seg.style.fontFamily || 'Arial, sans-serif';
            let fontStr = '';
            if (seg.style.isItalic) fontStr += 'italic ';
            if (seg.style.isBold) fontStr += 'bold ';
            fontStr += `${seg.style.fontSize}px ${fontName}`;
            ctx.font = fontStr;

            const wordWidth = ctx.measureText(word).width;

            // Use width directly - it already represents the usable text area
            const maxLineWidth = getMaxWidthAtY
                ? getMaxWidthAtY(currentY)
                : width;

            // If the word itself is too long, break it character by character
            if (wordWidth > maxLineWidth) {
                let remainingWord = word;
                while (remainingWord.length > 0) {
                    let chunk = '';
                    let chunkWidth = 0;

                    // Build chunk character by character
                    for (let i = 0; i < remainingWord.length; i++) {
                        const testChunk = chunk + remainingWord[i];
                        const testWidth = ctx.measureText(testChunk).width;

                        if (currentLine.width + testWidth > maxLineWidth && currentLine.segments.length > 0) {
                            // Start new line
                            currentY += currentLine.height || (defaultStyle.fontSize + getLineHeightOffset(defaultStyle.fontSize));
                            lines.push(currentLine);
                            currentLine = { segments: [], width: 0, height: 0 };
                        }

                        if (testWidth <= maxLineWidth || chunk === '') {
                            chunk = testChunk;
                            chunkWidth = testWidth;
                        } else {
                            break;
                        }
                    }

                    // Add chunk to current line
                    if (chunk) {
                        currentLine.segments.push({
                            text: chunk,
                            style: seg.style,
                            width: chunkWidth,
                            height: seg.style.fontSize
                        });
                        currentLine.width += chunkWidth;
                        // Use custom gap based on font size
                        currentLine.height = Math.max(currentLine.height, seg.style.fontSize + getLineHeightOffset(seg.style.fontSize));

                        remainingWord = remainingWord.substring(chunk.length);
                    } else {
                        break; // Safety: avoid infinite loop
                    }
                }
            } else {
                // Normal word wrapping
                if (currentLine.width + wordWidth > maxLineWidth && currentLine.width > 0) {
                    currentY += currentLine.height || (defaultStyle.fontSize + getLineHeightOffset(defaultStyle.fontSize));
                    lines.push(currentLine);
                    currentLine = { segments: [], width: 0, height: 0 };
                }

                // Add to line
                currentLine.segments.push({
                    text: word,
                    style: seg.style,
                    width: wordWidth,
                    height: seg.style.fontSize
                });
                currentLine.width += wordWidth;
                // Use custom gap based on font size
                currentLine.height = Math.max(currentLine.height, seg.style.fontSize + getLineHeightOffset(seg.style.fontSize));
            }
        });
    });
    if (currentLine.segments.length > 0) lines.push(currentLine);


    // 5. Vertical Alignment (Center)
    const totalHeight = lines.reduce((acc, line) => acc + (line.height), 0);
    const startY = y + (height - totalHeight) / 2;

    // 6. Draw
    let drawY = startY;

    lines.forEach(line => {
        // Horizontal Center Alignment for each line
        let currentX = x + (width - line.width) / 2;
        // ensure we don't start before x (clipping needed?)
        currentX = Math.max(x, currentX);

        // Calculate baseline for this line (align bottom of texts?)
        // Simplification: align middles or baselines?
        // Standard text rendering aligns text on specific baseline. 
        // If sizes differ in a line, we probably want to align 'alphabetic' baselines.
        // HTML renderer usually aligns baselines.
        // `ctx.textBaseline = 'alphabetic'`

        // We need to know the max ascent/descent to place the line correctly.
        // Approximation: line.height is roughly the max fontSize * 1.2.
        // We can draw at currentY + line.height * 0.8 (baseline approx).

        // Perfect middle centering
        const baselineY = drawY + line.height / 2;

        line.segments.forEach(seg => {
            if (!seg.text) return;
            let fontName = fontMap[seg.style.fontFamily] || seg.style.fontFamily || 'Arial';
            if (!fontName.includes(',')) fontName = `'${fontName}'`;

            let fontStr = '';
            if (seg.style.isItalic) fontStr += 'italic ';
            if (seg.style.isBold) fontStr += 'bold ';
            fontStr += `${seg.style.fontSize}px ${fontName}`;

            ctx.font = fontStr;
            ctx.fillStyle = seg.style.textColor;
            ctx.textBaseline = 'middle';

            ctx.fillText(seg.text, currentX, baselineY);

            // Stroke/Underline/Strike handling could go here
            if (seg.style.isUnderline) {
                const width = ctx.measureText(seg.text).width;
                ctx.beginPath();
                ctx.strokeStyle = seg.style.textColor;
                ctx.lineWidth = seg.style.fontSize / 15;
                ctx.moveTo(currentX, baselineY + 2);
                ctx.lineTo(currentX + width, baselineY + 2);
                ctx.stroke();
            }

            currentX += seg.width;
        });

        drawY += line.height;
    });

    ctx.restore();
}
