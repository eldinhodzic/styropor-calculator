import { useState, useEffect } from 'react';
import { getApiKey, saveApiKey, removeApiKey } from '../utils/storage';
import { Settings, Key, X, CheckCircle2 } from 'lucide-react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: Props) {
    const [apiKey, setApiKey] = useState('');
    const [isSaved, setIsSaved] = useState(false);

    useEffect(() => {
        if (isOpen) {
            const storedKey = getApiKey();
            if (storedKey) {
                setApiKey(storedKey);
                setIsSaved(true);
            } else {
                setApiKey('');
                setIsSaved(false);
            }
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSave = () => {
        if (apiKey.trim().startsWith('AIza')) {
            saveApiKey(apiKey.trim());
            setIsSaved(true);
            setTimeout(onClose, 1000);
        } else if (apiKey.trim() === '') {
            removeApiKey();
            setIsSaved(false);
        } else {
            alert('Ongeldige Gemini API Key. Moet beginnen met AIza');
        }
    };

    const handleClear = () => {
        removeApiKey();
        setApiKey('');
        setIsSaved(false);
    };

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 duration-300">
                <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
                    <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800">
                        <Settings size={20} className="text-slate-500" />
                        Instellingen
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                            <Key size={16} /> Google Gemini API Key
                        </label>
                        <p className="text-sm text-slate-500 mb-4">
                            Om de AI Fotometing te gebruiken, vul je hier je Gemini API Key in via Google AI Studio. Deze sleutel blijft lokaal op je toestel in de browser (`localStorage`) en wordt alleen naar Google gestuurd.
                        </p>
                        <div className="relative">
                            <input
                                type="password"
                                value={apiKey}
                                onChange={(e) => {
                                    setApiKey(e.target.value);
                                    setIsSaved(false);
                                }}
                                placeholder="AIzaSy..."
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-4 pr-10 py-3 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono text-sm transition-all text-slate-800"
                            />
                            {isSaved && (
                                <div className="absolute right-3 top-3 text-emerald-500">
                                    <CheckCircle2 size={20} />
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                    <button
                        onClick={handleClear}
                        className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors"
                    >
                        Verwijderen
                    </button>
                    <button
                        onClick={handleSave}
                        className={`px-6 py-2 text-sm font-bold text-white rounded-lg transition-colors shadow-sm ${isSaved ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-blue-600 hover:bg-blue-700'
                            }`}
                    >
                        {isSaved ? 'Opgeslagen' : 'Opslaan'}
                    </button>
                </div>
            </div>
        </div>
    );
}
