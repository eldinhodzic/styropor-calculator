import { useState } from 'react';
import { Camera, Ruler, Image as ImageIcon } from 'lucide-react';

export default function CameraTool() {
    const [isActive, setIsActive] = useState(false);

    if (!isActive) {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col items-center justify-center text-center space-y-4">
                <div className="h-16 w-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center">
                    <Camera size={32} />
                </div>
                <div>
                    <h3 className="text-lg font-semibold text-slate-800">AI Fotometing</h3>
                    <p className="text-sm text-slate-500 max-w-sm mt-1">
                        Maak een foto van de muur met een referentieobject (zoals een A4-papiertje) om automatisch de afmetingen te berekenen.
                    </p>
                </div>
                <div className="flex space-x-3 w-full max-w-xs pt-4">
                    <button
                        onClick={() => setIsActive(true)}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                    >
                        <Camera size={18} />
                        Camera
                    </button>
                    <button className="flex-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 py-2.5 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2">
                        <ImageIcon size={18} />
                        Gallerij
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-slate-900 rounded-xl overflow-hidden shadow-lg relative h-[60vh] flex flex-col">
            {/* Placeholder for camera view */}
            <div className="flex-1 flex items-center justify-center bg-black">
                <p className="text-slate-400 font-medium">Camera View Placeholder</p>
            </div>

            {/* Overlay UI */}
            <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4">
                <div className="flex justify-between items-start pointer-events-auto">
                    <button
                        onClick={() => setIsActive(false)}
                        className="bg-black/50 hover:bg-black/70 text-white rounded-full p-2 backdrop-blur-md transition-colors"
                    >
                        ✕
                    </button>
                    <div className="bg-black/50 text-white px-3 py-1.5 rounded-full text-sm font-medium backdrop-blur-md flex items-center gap-2">
                        <Ruler size={16} />
                        Plaats A4-papier in beeld
                    </div>
                </div>

                <div className="flex justify-center pb-4 pointer-events-auto">
                    <button className="h-16 w-16 bg-white rounded-full border-4 border-slate-300 flex items-center justify-center shadow-xl active:scale-95 transition-transform">
                        <div className="h-12 w-12 bg-white rounded-full border-2 border-slate-200"></div>
                    </button>
                </div>
            </div>
        </div>
    );
}
