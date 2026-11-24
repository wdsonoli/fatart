export type PaperSize =
  | 'A0'
  | 'A1'
  | 'A2'
  | 'A3'
  | 'A4'
  | 'A5'
  | 'A6'
  | 'B2'
  | 'B3'
  | 'B4'
  | 'B5'
  | 'LETTER'
  | 'LEGAL'
  | 'TABLOID'
  | 'EXECUTIVE'
  | 'HALF_LETTER'
  | 'PHOTO_10X15'
  | 'PHOTO_13X18'
  | 'PHOTO_15X21'
  | 'PHOTO_20X25'
  | 'PHOTO_20X30'
  | 'SQ_20X20'
  | 'SQ_30X30'
  | 'CUSTOM';

export type Orientation = 'auto' | 'portrait' | 'landscape';
export type SizingMode = 'proportional_sheets' | 'physical' | 'free_grid';
export type SheetAxis = 'cols' | 'rows';
export type PhysicalUnit = 'cm' | 'm';
export type PanelShape = 'rect' | 'round';

export type PaperColorProfileId =
  | 'none'
  | 'sulfite'
  | 'matte'
  | 'glossy'
  | 'recycled'
  | 'couche';

export type WatermarkLayout = 'tiled' | 'center' | 'bottom-right';

export interface ImageFilters {
  rotation: 0 | 90 | 180 | 270;
  mirrorX: boolean;
  grayscale: boolean;
  stencilMode: boolean;
  stencilThreshold: number; // 0 to 255
  invert: boolean;
  saturation: number; // -100 to 100
  brightness: number; // -100 to 100
  contrast: number; // -100 to 100
  temperature: number; // -50 to 50
  paperColorProfile: PaperColorProfileId;
  reticleEnabled: boolean;
  reticleInkSaving: number; // 20 to 65 (%)
  reticleCellSize: number; // 4 to 14 (px)
  reticleMonochrome: boolean;
  watermarkEnabled: boolean;
  watermarkText: string;
  watermarkOpacity: number; // 10 to 80 (%)
  watermarkLayout: WatermarkLayout;
}

export interface CalibrationProfile {
  id: string;
  name: string;
  createdAt: string;
  paperColorProfile: PaperColorProfileId;
  saturation: number;
  contrast: number;
  brightness: number;
  temperature: number;
  reticleEnabled: boolean;
  reticleInkSaving: number;
}

export interface PosterSettings {
  paperSize: PaperSize;
  customPaperWMm: number;
  customPaperHMm: number;
  orientation: Orientation;
  sizingMode: SizingMode;
  sheetAxis: SheetAxis;
  cols: number;
  rows: number;
  targetWidthCm: number;
  targetHeightCm: number;
  physicalUnit: PhysicalUnit;
  lockAspectRatio: boolean;
  marginMm: number;
  overlapMm: number;
  guidedAssembly: boolean;
  manualPositioning: boolean;
  imageOffsetXMm: number;
  imageOffsetYMm: number;
  imageScale: number; // 0.5 to 2.0
  showCutMarks: boolean;
  showPageNumbers: boolean;
  includeAssemblyMap: boolean;
  skipBlankPages: boolean;
  panelShape: PanelShape;
  roundDiameterCm: number;
}

export interface TileSlice {
  index: number;
  row: number;
  col: number;
  pageLabel: string;
  gridXMm: number;
  gridYMm: number;
  printableWMm: number;
  printableHMm: number;
  hasIntersection: boolean;
  isBlank: boolean;
  destXMm: number;
  destYMm: number;
  destWMm: number;
  destHMm: number;
  srcX: number;
  srcY: number;
  srcW: number;
  srcH: number;
}

export interface PosterLayout {
  resolvedOrientation: 'portrait' | 'landscape';
  pageWMm: number;
  pageHMm: number;
  printableWMm: number;
  printableHMm: number;
  cols: number;
  rows: number;
  totalGridWMm: number;
  totalGridHMm: number;
  imgXMm: number;
  imgYMm: number;
  imgWMm: number;
  imgHMm: number;
  estimatedDpi: number;
  tiles: TileSlice[];
  circleCenterXMm?: number;
  circleCenterYMm?: number;
  circleRadiusMm?: number;
}

export interface SampleArtwork {
  id: string;
  title: string;
  category: string;
  src: string;
  recommendedSettings?: Partial<PosterSettings>;
  recommendedFilters?: Partial<ImageFilters>;
}

export type EditorElementType = 'text' | 'shape' | 'icon' | 'image';
export type ShapeKind = 'rect' | 'circle' | 'star' | 'triangle';
export type IconKind =
  | 'heart'
  | 'bolt'
  | 'crown'
  | 'scissors'
  | 'flower'
  | 'trophy'
  | 'music'
  | 'sparkles';

export interface EditorElement {
  id: string;
  type: EditorElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  text?: string;
  fontSize?: number;
  fontFamily?: 'Plus Jakarta Sans' | 'DM Sans' | 'JetBrains Mono' | 'Georgia';
  fontWeight?: '500' | '700' | '800';
  textAlign?: 'left' | 'center' | 'right';
  color?: string;
  shapeKind?: ShapeKind;
  iconKind?: IconKind;
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  imageSrc?: string;
}
