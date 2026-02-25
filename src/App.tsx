import { useState, useMemo } from 'react';
import CameraTool from './components/CameraTool';
import Visualizer from './components/Visualizer';
import WallPainter from './components/WallPainter';
import SettingsModal from './components/SettingsModal';
import { analyzeWallImage } from './services/AiVisionService';
import { calculateStyropor, type Exclusion } from './CalculatorEngine';
import { Ruler, LayoutDashboard, Settings, Plus, Trash2, AlertCircle } from 'lucide-react';
import { getApiKey } from './utils/storage';

function App() {
  const [activeTab, setActiveTab] = useState<'measure' | 'painter' | 'calculate'>('measure');

  const [wallWidth, setWallWidth] = useState<number>(500);
  const [wallHeight, setWallHeight] = useState<number>(300);
  const [panelWidth, setPanelWidth] = useState<number>(100);
  const [panelHeight, setPanelHeight] = useState<number>(50);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const [exclusions, setExclusions] = useState<Exclusion[]>([
    { id: '1', x: 200, y: 0, width: 100, height: 210 } // Standarch door
  ]);

  const addExclusion = () => {
    setExclusions([...exclusions, { id: Date.now().toString(), x: 0, y: 0, width: 100, height: 100 }]);
  };

  const removeExclusion = (id: string) => {
    setExclusions(exclusions.filter(e => e.id !== id));
  };

  const updateExclusion = (id: string, field: keyof Exclusion, value: number) => {
    setExclusions(exclusions.map(e => e.id === id ? { ...e, [field]: value } : e));
  };

  const handleCameraCapture = async (base64Image: string) => {
    try {
      if (!getApiKey()) {
        setIsSettingsOpen(true);
        setAiError("Vul eerst je Gemini API Key in om AI Fotometing te gebruiken.");
        return;
      }

      setIsAiLoading(true);
      setAiError(null);

      const visionData = await analyzeWallImage(base64Image);

      // Update form state with the AI answers
      setWallWidth(visionData.wall.width);
      setWallHeight(visionData.wall.height);

      if (visionData.exclusions && Array.isArray(visionData.exclusions)) {
        const newExclusions = visionData.exclusions.map(e => ({
          id: Date.now().toString() + Math.random().toString(),
          width: e.width,
          height: e.height,
          x: e.x,
          y: e.y
        }));
        setExclusions(newExclusions);
      } else {
        setExclusions([]);
      }

    } catch (err: unknown) {
      if (err instanceof Error) {
        setAiError(err.message);
      } else {
        setAiError("Fout bij ophalen AI fotometing.");
      }
    } finally {
      setIsAiLoading(false);
    }
  };

  const result = useMemo(() => {
    if (wallWidth <= 0 || wallHeight <= 0 || panelWidth <= 0 || panelHeight <= 0) return null;
    return calculateStyropor(
      { width: wallWidth, height: wallHeight },
      { width: panelWidth, height: panelHeight },
      exclusions
    );
  }, [wallWidth, wallHeight, panelWidth, panelHeight, exclusions]);

  return (
    <div className="min-h-screen pb-20 md:pb-0 font-sans">
      <header className="bg-white shadow-sm sticky top-0 z-10 border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 text-white p-1.5 rounded-lg shadow-sm">
              <LayoutDashboard size={24} />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-800">
              Styro<span className="text-blue-600">Calc</span>
            </h1>
          </div>
          <button onClick={() => setIsSettingsOpen(true)} className="p-2 text-slate-500 hover:text-blue-600 bg-slate-50 rounded-full hover:bg-blue-50 transition-colors">
            <Settings size={20} />
          </button>
        </div>
      </header>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex space-x-1 bg-slate-200/50 p-1.5 rounded-xl mb-8 shadow-inner overflow-x-auto">
          <button
            onClick={() => setActiveTab('measure')}
            className={`flex-1 py-3 px-4 whitespace-nowrap text-sm font-semibold rounded-lg transition-all ${activeTab === 'measure'
              ? 'bg-white text-blue-700 shadow border border-slate-200/50'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
          >
            1. Opmeten
          </button>
          <button
            onClick={() => setActiveTab('painter')}
            className={`flex-1 py-3 px-4 whitespace-nowrap text-sm font-semibold rounded-lg transition-all ${activeTab === 'painter'
              ? 'bg-white text-blue-700 shadow border border-slate-200/50'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
          >
            2. Tekenen
          </button>
          <button
            onClick={() => setActiveTab('calculate')}
            className={`flex-1 py-3 px-4 whitespace-nowrap text-sm font-semibold rounded-lg transition-all ${activeTab === 'calculate'
              ? 'bg-white text-blue-700 shadow border border-slate-200/50'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
          >
            3. Resultaat
          </button>
        </div>

        {activeTab === 'measure' && (
          <div className="space-y-6">

            {aiError && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-start gap-3">
                <AlertCircle className="shrink-0 mt-0.5" size={20} />
                <p className="text-sm font-medium">{aiError}</p>
              </div>
            )}

            <CameraTool onCapture={handleCameraCapture} isLoading={isAiLoading} />

            <div className="grid md:grid-cols-2 gap-6">
              {/* Muur Afmetingen */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 transition-all hover:shadow-md">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800">
                    <Ruler size={20} className="text-blue-600" />
                    Muur Afmetingen
                  </h2>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Breedte (cm)</label>
                    <input type="number" value={wallWidth} onChange={e => setWallWidth(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-slate-800" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Hoogte (cm)</label>
                    <input type="number" value={wallHeight} onChange={e => setWallHeight(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-slate-800" />
                  </div>
                </div>
              </div>

              {/* Styropor Paneel */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 transition-all hover:shadow-md">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800">
                    <LayoutDashboard size={20} className="text-blue-600" />
                    Styropor Plaat
                  </h2>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Breedte (cm)</label>
                    <input type="number" value={panelWidth} onChange={e => setPanelWidth(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-slate-800" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Hoogte (cm)</label>
                    <input type="number" value={panelHeight} onChange={e => setPanelHeight(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-slate-800" />
                  </div>
                </div>
              </div>
            </div>

            {/* Ramen en Deuren Toevoegen */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="flex flex-col mb-6">
                <h2 className="text-lg font-bold text-slate-800">Uitsluitingen (Ramen & Deuren)</h2>
                <p className="text-sm text-slate-500 mt-1">Voeg delen toe die niet bekleed hoeven te worden.</p>
              </div>

              <div className="space-y-4 mb-6">
                {exclusions.map((exc, index) => (
                  <div key={exc.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 relative">
                    <button onClick={() => removeExclusion(exc.id)} className="absolute -top-3 -right-3 bg-red-100 text-red-600 p-2 rounded-full hover:bg-red-200 transition-colors shadow">
                      <Trash2 size={16} />
                    </button>
                    <h4 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wider">Uitsluiting {index + 1}</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Breedte</label>
                        <input type="number" value={exc.width} onChange={e => updateExclusion(exc.id, 'width', Number(e.target.value))} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-blue-500 text-sm font-medium" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Hoogte</label>
                        <input type="number" value={exc.height} onChange={e => updateExclusion(exc.id, 'height', Number(e.target.value))} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-blue-500 text-sm font-medium" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Positie X (van links)</label>
                        <input type="number" value={exc.x} onChange={e => updateExclusion(exc.id, 'x', Number(e.target.value))} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-blue-500 text-sm font-medium" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Positie Y (van onder)</label>
                        <input type="number" value={exc.y} onChange={e => updateExclusion(exc.id, 'y', Number(e.target.value))} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-blue-500 text-sm font-medium" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button onClick={addExclusion} className="w-full py-4 border-2 border-dashed border-slate-300 rounded-xl text-slate-600 font-semibold hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all flex justify-center items-center gap-2">
                <Plus size={20} /> Raam/Deur Toevoegen
              </button>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                onClick={() => setActiveTab('calculate')}
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3.5 rounded-xl font-bold shadow-lg shadow-blue-500/30 transition-all active:scale-95 text-lg"
              >
                Bereken Resultaat
              </button>
            </div>
          </div>
        )}

        {activeTab === 'painter' && (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300 relative z-0">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 mb-4">
              <p className="text-sm font-medium text-slate-700">
                Kies je plaatformaat (voor weergave onderin component):
              </p>
              <div className="flex gap-4 mt-2">
                <input type="number" placeholder="Br" value={panelWidth} onChange={e => setPanelWidth(Number(e.target.value))} className="w-20 bg-slate-50 border border-slate-200 rounded px-2 py-1 text-sm font-bold" />
                <span className="self-center">x</span>
                <input type="number" placeholder="Hg" value={panelHeight} onChange={e => setPanelHeight(Number(e.target.value))} className="w-20 bg-slate-50 border border-slate-200 rounded px-2 py-1 text-sm font-bold" />
                <span className="self-center text-sm">cm</span>
              </div>
            </div>
            <WallPainter
              panelConfig={{ width: panelWidth, height: panelHeight }}
              onExport={(wall, excls) => {
                setWallWidth(Math.round(wall.width));
                setWallHeight(Math.round(wall.height));
                setExclusions(excls.map(e => ({
                  ...e,
                  id: e.id,
                  x: Math.round(e.x),
                  y: Math.round(e.y),
                  width: Math.round(e.width),
                  height: Math.round(e.height)
                })));
                setActiveTab('calculate');
              }}
            />
          </div>
        )}

        {activeTab === 'calculate' && (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300 relative z-0">
            <Visualizer result={result} wall={{ width: wallWidth, height: wallHeight }} exclusions={exclusions} />
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
