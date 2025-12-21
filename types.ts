export enum BubbleType {
  SpeechDown = 'speech-down',
  SpeechUp = 'speech-up',
  Thought = 'thought',
  Shout = 'shout',
  Descriptive = 'descriptive',
  Whisper = 'whisper',
  TextOnly = 'text-only',
}

export enum FontName {
  Comic = 'font-comic',
  Bangers = 'font-bangers',
  Indie = 'font-indie',
  Marker = 'font-marker',
  Arial = 'font-arial',
}

export interface SpeechTailPart {
  id: string;
  type: 'speech-tail';
  baseCX: number;
  baseCY: number;
  baseWidth: number;
  tipX: number;
  tipY: number;
  initialLength: number;
  initialBaseWidth: number;
}

export interface ThoughtDotPart {
  id: string;
  type: 'thought-dot';
  offsetX: number;
  offsetY: number;
  size: number;
}

export type BubblePart = SpeechTailPart | ThoughtDotPart;

export interface Bubble {
  id: string;
  type: BubbleType;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontFamily: FontName;
  fontSize: number;
  textColor: string;
  borderColor: string;
  zIndex: number;
  parts: BubblePart[];
  shapeVariant?: number;
}

export interface ToolSettings {
  activeBubbleType: BubbleType;
  activeFontFamily: FontName;
  activeFontSize: number;
  activeTextColor: string;
  activeBorderColor: string;
  defaultTailLength: number;
  defaultTailBaseWidth: number;
  defaultDotCount: number;
  defaultDotSize: number;
  uiMode?: 'dark' | 'light';
  timeOfDay?: 'night' | 'day';
}

export const MIN_BUBBLE_WIDTH = 50;
export const MIN_BUBBLE_HEIGHT = 30;

export const MIN_TAIL_LENGTH = 10;
export const MIN_TAIL_BASE_WIDTH = 10;
export const MIN_DOT_SIZE = 5;
export const MIN_DOT_COUNT = 1;

export const FONT_FAMILY_MAP: Record<FontName, string> = {
  [FontName.Comic]: "'Comic Neue', cursive",
  [FontName.Bangers]: "'Bangers', cursive",
  [FontName.Indie]: "'Indie Flower', cursive",
  [FontName.Marker]: "'Permanent Marker', cursive",
  [FontName.Arial]: "Arial, sans-serif",
};

export const BUBBLE_REQUIRES_PARTS: BubbleType[] = [
  BubbleType.SpeechDown,
  BubbleType.SpeechUp,
  BubbleType.Thought,
  BubbleType.Whisper
];