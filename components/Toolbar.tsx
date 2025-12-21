import React, { ChangeEvent } from 'react';
import { ToolSettings, BubbleType, FontName, FONT_FAMILY_MAP, Bubble, MIN_TAIL_BASE_WIDTH, MIN_TAIL_LENGTH, MIN_DOT_COUNT, MIN_DOT_SIZE } from '../types.ts';

interface ToolbarProps {
  settings: ToolSettings;
  onImageUpload: (file: File) => void;
  onSave: (format: 'png' | 'jpeg') => void;
  isSaving: boolean;
  onClear: () => void;
  onSettingChange: (newSettings: Partial<ToolSettings>) => void;
  selectedBubble: Bubble | null;
  onSaveProject: () => void;
  onLoadProject: (file: File) => void;
  isProjectLoaded: boolean;
}

const bubbleTypeOptions = [
  { label: 'Dialogue (Bas)', value: BubbleType.SpeechDown },
  { label: 'Dialogue (Haut)', value: BubbleType.SpeechUp },
  { label: 'Pensée', value: BubbleType.Thought },
  { label: 'Cri', value: BubbleType.Shout },
  { label: 'Descriptif', value: BubbleType.Descriptive },
  { label: 'Chuchotement', value: BubbleType.Whisper },
  { label: 'Texte Seul', value: BubbleType.TextOnly },
];

const fontOptions = Object.keys(FontName).map(key => ({
    label: key, 
    value: FontName[key as keyof typeof FontName], 
    fontFamilyStyle: FONT_FAMILY_MAP[FontName[key as keyof typeof FontName] as FontName], 
}));

const BUBBLE_TYPES_WITH_BORDERS = [
    BubbleType.SpeechDown,
    BubbleType.SpeechUp,
    BubbleType.Thought,
    BubbleType.Descriptive,
    BubbleType.Whisper,
];


export const Toolbar: React.FC<ToolbarProps> = ({ settings, onImageUpload, onSave, isSaving, onClear, onSettingChange, selectedBubble, onSaveProject, onLoadProject, isProjectLoaded }) => {
  
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onImageUpload(e.target.files[0]);
    }
  };

  const handleProjectFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        onLoadProject(e.target.files[0]);
        // Reset the input value to allow loading the same file again
        e.target.value = '';
    }
  };

  const ToolButton: React.FC<{ onClick?: () => void; onMouseDown?: (e: React.MouseEvent) => void; active?: boolean; children: React.ReactNode; className?: string; title?: string; disabled?: boolean; style?: React.CSSProperties }> = 
    ({ onClick, onMouseDown, active, children, className = '', title, disabled, style}) => (
    <button
      title={title}
      onMouseDown={onMouseDown}
      onClick={onClick}
      disabled={disabled}
      style={style}
      className={`px-3 py-2 text-sm rounded shadow hover:bg-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50 disabled:cursor-not-allowed
                  ${active ? 'bg-blue-700 text-white ring-2 ring-blue-300' : 'bg-blue-500 text-white'} ${className}`}
    >
      {children}
    </button>
  );

  return (
    <div className="mb-6 p-4 border border-gray-300 rounded-lg bg-white shadow-md space-y-6">
      {/* Section 1: Upload & Save */}
      <div>
        <h2 className="text-lg font-semibold mb-3 text-gray-700 font-['Bangers']">Projet</h2>
        <div className="flex flex-wrap items-center gap-3">
            <label htmlFor="imageUpload" className="px-3 py-2 text-sm rounded shadow bg-indigo-500 text-white hover:bg-indigo-600 transition-colors cursor-pointer">
              Télécharger Planche
            </label>
            <input type="file" id="imageUpload" accept="image/*" onChange={handleFileChange} className="hidden" />
          
            <label htmlFor="projectUpload" className="px-3 py-2 text-sm rounded shadow bg-purple-500 text-white hover:bg-purple-600 transition-colors cursor-pointer">
              Ouvrir Projet
            </label>
            <input type="file" id="projectUpload" accept=".json,application/json" onChange={handleProjectFileChange} className="hidden" />

          <ToolButton onClick={onSaveProject} className="bg-blue-500 hover:bg-blue-600" disabled={!isProjectLoaded || isSaving} title={!isProjectLoaded ? "Chargez une image d'abord" : "Sauvegarder le projet (.json)"}>Sauvegarder Projet</ToolButton>
          <ToolButton onClick={() => onSave('png')} className="bg-green-600 hover:bg-green-700" disabled={!isProjectLoaded || isSaving}>{isSaving ? 'Exportation...' : 'Exporter PNG'}</ToolButton>
          <ToolButton onClick={() => onSave('jpeg')} className="bg-teal-600 hover:bg-teal-700" disabled={!isProjectLoaded || isSaving}>{isSaving ? 'Exportation...' : 'Exporter JPG'}</ToolButton>
          <ToolButton onClick={onClear} className="bg-red-500 hover:bg-red-600" disabled={isSaving}>Effacer Tout</ToolButton>
        </div>
      </div>

      {/* Section 2: Bubble Properties */}
      <div>
        <h2 className="text-lg font-semibold mb-3 text-gray-700 font-['Bangers']">Propriétés de la Bulle</h2>
        
        <div className="mb-4">
          <h3 className="font-medium mb-1 text-sm text-gray-600">Type de bulle :</h3>
          <div className="flex flex-wrap gap-2">
            {bubbleTypeOptions.map(opt => (
              <ToolButton 
                key={opt.value} 
                onClick={() => onSettingChange({ activeBubbleType: opt.value })} 
                active={settings.activeBubbleType === opt.value}
                title={opt.label}
              >
                {opt.label}
              </ToolButton>
            ))}
          </div>
        </div>

        <div className="mb-4">
            <h3 className="font-medium mb-1 text-sm text-gray-600">Police :</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                {fontOptions.map(font => (
                    <ToolButton
                        key={font.value}
                        onMouseDown={(e) => {
                            e.preventDefault();
                            onSettingChange({ activeFontFamily: font.value });
                        }}
                        active={settings.activeFontFamily === font.value}
                        style={{ fontFamily: font.fontFamilyStyle }}
                        title={font.label}
                    >
                        {font.label}
                    </ToolButton>
                ))}
            </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <h3 className="font-medium mb-1 text-sm text-gray-600">Taille du texte : {selectedBubble ? selectedBubble.fontSize : settings.activeFontSize}px</h3>
            <input 
              type="range" 
              min="5"
              max="40" 
              value={selectedBubble ? selectedBubble.fontSize : settings.activeFontSize}
              onChange={(e) => onSettingChange({ activeFontSize: parseInt(e.target.value) })} 
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              aria-label="Taille du texte"
            />
          </div>
          <div className="flex items-center gap-4">
              <div>
                  <label htmlFor="textColor" className="font-medium mb-1 text-sm text-gray-600 block">Texte</label>
                  <input
                      type="color"
                      id="textColor"
                      value={settings.activeTextColor}
                      onChange={(e) => onSettingChange({ activeTextColor: e.target.value })}
                      className="w-12 h-8 p-1 border border-gray-300 rounded cursor-pointer bg-white"
                      title="Couleur du texte"
                  />
              </div>
              {BUBBLE_TYPES_WITH_BORDERS.includes(settings.activeBubbleType) && (
                  <div>
                      <label htmlFor="borderColor" className="font-medium mb-1 text-sm text-gray-600 block">Bordure</label>
                      <input
                          type="color"
                          id="borderColor"
                          value={settings.activeBorderColor}
                          onChange={(e) => onSettingChange({ activeBorderColor: e.target.value })}
                          className="w-12 h-8 p-1 border border-gray-300 rounded cursor-pointer bg-white"
                          title="Couleur de la bordure"
                      />
                  </div>
              )}
          </div>
        </div>
        
        {(settings.activeBubbleType === BubbleType.SpeechDown || settings.activeBubbleType === BubbleType.SpeechUp || settings.activeBubbleType === BubbleType.Whisper || settings.activeBubbleType === BubbleType.Thought ) && (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                { (settings.activeBubbleType === BubbleType.SpeechDown || settings.activeBubbleType === BubbleType.SpeechUp || settings.activeBubbleType === BubbleType.Whisper) && (
                    <div className="p-2 border rounded border-gray-200 bg-gray-50">
                        <h4 className="font-medium text-xs text-gray-500 mb-1">Queue (Nouvelles Bulles)</h4>
                        <div className="flex items-center gap-2 text-sm">
                            <label htmlFor="tailLength" className="whitespace-nowrap">Longueur:</label>
                            <input type="number" id="tailLength" value={settings.defaultTailLength} onChange={e => onSettingChange({ defaultTailLength: Math.max(MIN_TAIL_LENGTH, parseInt(e.target.value))})} className="w-16 p-1 border rounded text-xs" min={MIN_TAIL_LENGTH.toString()} />
                            <label htmlFor="tailBaseWidth" className="whitespace-nowrap">Largeur Base (Totale):</label>
                            <input type="number" id="tailBaseWidth" value={settings.defaultTailBaseWidth} onChange={e => onSettingChange({ defaultTailBaseWidth: Math.max(MIN_TAIL_BASE_WIDTH, parseInt(e.target.value))})} className="w-16 p-1 border rounded text-xs" min={MIN_TAIL_BASE_WIDTH.toString()} />
                        </div>
                    </div>
                )}
       
              {/* Section: UI Mode (no icons) */}
              <div>
                <h2 className="text-lg font-semibold mb-3 text-gray-700 font-['Bangers']">Apparence</h2>
                <div className="flex items-center gap-3">
                  <div>
                    <h3 className="font-medium mb-1 text-sm text-gray-600">Mode</h3>
                    <div className="flex gap-2">
                      <ToolButton onClick={() => onSettingChange({ uiMode: 'light' })} active={settings.uiMode === 'light'} title="Mode Clair">Mode Clair</ToolButton>
                      <ToolButton onClick={() => onSettingChange({ uiMode: 'dark' })} active={settings.uiMode === 'dark'} title="Mode Sombre">Mode Sombre</ToolButton>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-medium mb-1 text-sm text-gray-600">Période</h3>
                    <div className="flex gap-2">
                      <ToolButton onClick={() => onSettingChange({ timeOfDay: 'day' })} active={settings.timeOfDay === 'day'} title="Jour">Jour</ToolButton>
                      <ToolButton onClick={() => onSettingChange({ timeOfDay: 'night' })} active={settings.timeOfDay === 'night'} title="Nuit">Nuit</ToolButton>
                    </div>
                  </div>
                </div>
              </div>
                { settings.activeBubbleType === BubbleType.Thought && (
                     <div className="p-2 border rounded border-gray-200 bg-gray-50">
                        <h4 className="font-medium text-xs text-gray-500 mb-1">Points Pensée (Nouvelles Bulles)</h4>
                        <div className="flex items-center gap-2 text-sm">
                            <label htmlFor="dotCount" className="whitespace-nowrap">Nombre:</label>
                            <input type="number" id="dotCount" value={settings.defaultDotCount} onChange={e => onSettingChange({ defaultDotCount: Math.max(MIN_DOT_COUNT, parseInt(e.target.value))})} className="w-16 p-1 border rounded text-xs" min={MIN_DOT_COUNT.toString()} />
                            <label htmlFor="dotSize" className="whitespace-nowrap">Taille Moyenne:</label>
                            <input type="number" id="dotSize" value={settings.defaultDotSize} onChange={e => onSettingChange({ defaultDotSize: Math.max(MIN_DOT_SIZE, parseInt(e.target.value))})} className="w-16 p-1 border rounded text-xs" min={MIN_DOT_SIZE.toString()} />
                        </div>
                    </div>
                )}
             </div>
        )}
      </div>
    </div>
  );
};