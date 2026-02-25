import React, { useState, useRef, useMemo, useCallback } from 'react';
import { Camera, Image as ImageIcon, PlusSquare, Trash2, Maximize, Loader2, Calculator } from 'lucide-react';
import { analyzeWallImageForPainter } from '../services/AiVisionService';

export type ExclusionConfig = {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
}

interface Props {
    panelConfig: { width: number; height: number };
    onExport: (wall: { width: number; height: number }, exclusions: ExclusionConfig[]) => void;
}

type RectType = 'wall' | 'window' | 'door';

type Rect = {
    id: string;
    type: RectType;
    x: number;   // 0-1
    y: number;
    w: number;
    h: number;
};

type HandleType = 'tl' | 'tr' | 'bl' | 'br' | 't' | 'b' | 'l' | 'r' | 'move';

export default function WallPainter({ panelConfig, onExport }: Props) {
    const [photo, setPhoto] = useState<string | null>(null);
    const [imgNatSize, setImgNatSize] = useState<{ w: number; h: number } | null>(null);

    const [aiStatus, setAiStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
    const [aiErrorMsg, setAiErrorMsg] = useState<string | null>(null);

    const [rects, setRects] = useState<Rect[]>([]);
    const [selectedRectId, setSelectedRectId] = useState<string | null>(null);
    const [settingMeasureId, setSettingMeasureId] = useState<string | null>(null);

    // The absolute scale mapping: how many CM is the full width of the original image.
    // We initialize it to 1000cm to have a somewhat realistic default until they calibrate.
    const [imageWidthCm, setImageWidthCm] = useState<number | null>(null);

    const containerRef = useRef<HTMLDivElement>(null);
    const wrapperRef = useRef<HTMLDivElement>(null); // the absolute div exactly fitting the image

    // Pointer tracking for drag & drop
    const draggingRef = useRef<{
        id: string;
        handle: HandleType;
        startX: number;
        startY: number;
        startRect: Rect
    } | null>(null);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                loadPhotoAndAnalyze(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const loadPhotoAndAnalyze = async (base64: string) => {
        setPhoto(base64);
        setAiStatus('loading');
        setAiErrorMsg(null);
        setRects([]);
        setImageWidthCm(null);
        setSelectedRectId(null);

        const img = new Image();
        img.onload = async () => {
            setImgNatSize({ w: img.naturalWidth, h: img.naturalHeight });

            try {
                const result = await analyzeWallImageForPainter(base64);

                const newRects: Rect[] = [];
                if (result.mainWall) {
                    newRects.push({
                        id: 'wall-main',
                        type: 'wall',
                        x: result.mainWall.x,
                        y: result.mainWall.y,
                        w: result.mainWall.w,
                        h: result.mainWall.h
                    });

                    // If they provided estimate
                    if (result.estimatedMainWallCm && result.estimatedMainWallCm.w > 0) {
                        setImageWidthCm(result.estimatedMainWallCm.w / result.mainWall.w);
                    }
                }

                if (result.exclusions && Array.isArray(result.exclusions)) {
                    result.exclusions.forEach((exc, i) => {
                        newRects.push({
                            id: `exc-${i}`,
                            type: exc.type === 'window' ? 'window' : 'door',
                            x: exc.x,
                            y: exc.y,
                            w: exc.w,
                            h: exc.h
                        });
                    });
                }

                if (!imageWidthCm && newRects.length > 0) {
                    // fallback default
                    setImageWidthCm(800);
                }

                setRects(newRects);
                setAiStatus('done');
            } catch (err: any) {
                console.error(err);
                setAiStatus('error');
                setAiErrorMsg(err.message || 'Fout bij analyseren.');
            }
        };
        img.src = base64;
    };

    const handleCameraCapture = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            const video = document.createElement('video');
            video.srcObject = stream;
            video.play();

            setTimeout(() => {
                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth || 1920;
                canvas.height = video.videoHeight || 1080;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    const data = canvas.toDataURL('image/jpeg');
                    loadPhotoAndAnalyze(data);
                }
                stream.getTracks().forEach(t => t.stop());
            }, 1000);
        } catch (e) {
            alert('Camera kon niet worden gestart. Toestemming geweigerd?');
        }
    };

    const addManualRect = () => {
        setRects(prev => [...prev, {
            id: `manual-${Date.now()}`,
            type: 'window',
            x: 0.4,
            y: 0.4,
            w: 0.2,
            h: 0.2
        }]);
    };

    const deleteRect = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setRects(prev => prev.filter(r => r.id !== id));
        if (selectedRectId === id) setSelectedRectId(null);
        if (settingMeasureId === id) setSettingMeasureId(null);
    };

    const cycleType = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setRects(prev => prev.map(r => {
            if (r.id !== id) return r;
            let next: RectType = 'window';
            if (r.type === 'window') next = 'door';
            else if (r.type === 'door') next = 'wall';
            return { ...r, type: next };
        }));
    };

    const getRectCm = useCallback((r: Rect) => {
        if (!imageWidthCm || !imgNatSize) return { w: 0, h: 0 };
        const wCm = r.w * imageWidthCm;
        const hCm = r.h * imageWidthCm * (imgNatSize.h / imgNatSize.w);
        return { w: wCm, h: hCm };
    }, [imageWidthCm, imgNatSize]);

    const setRectCm = (rect: Rect, newWCm: number) => {
        if (newWCm <= 0) return;
        // Calculate new global imageWidthCm based on this rect's w percentage
        setImageWidthCm(newWCm / rect.w);
    };

    const setRectCmHeight = (rect: Rect, newHCm: number) => {
        if (newHCm <= 0 || !imgNatSize) return;
        // newHCm = rect.h * newImageWidthCm * (natH / natW)
        setImageWidthCm(newHCm / (rect.h * (imgNatSize.h / imgNatSize.w)));
    };

    // Drag & Drop logic
    const handlePointerDown = (id: string, handle: HandleType, e: React.PointerEvent) => {
        e.stopPropagation();
        setSelectedRectId(id);
        setSettingMeasureId(null); // hide measure on interact

        const wrapper = wrapperRef.current;
        if (!wrapper) return;
        const rect = rects.find(r => r.id === id);
        if (!rect) return;

        e.currentTarget.setPointerCapture(e.pointerId);

        draggingRef.current = {
            id,
            handle,
            startX: e.clientX,
            startY: e.clientY,
            startRect: { ...rect }
        };
    };

    const onPointerMove = (e: React.PointerEvent) => {
        if (!draggingRef.current || !wrapperRef.current) return;
        const { id, handle, startX, startY, startRect } = draggingRef.current;

        // Calculate delta in percentages
        const bounds = wrapperRef.current.getBoundingClientRect();
        const dx = (e.clientX - startX) / bounds.width;
        const dy = (e.clientY - startY) / bounds.height;

        setRects(prev => prev.map(r => {
            if (r.id !== id) return r;
            let { x, y, w, h } = startRect;

            if (handle === 'move') {
                x += dx;
                y += dy;
            } else {
                if (handle.includes('l')) { x += dx; w -= dx; }
                if (handle.includes('r')) { w += dx; }
                if (handle.includes('t')) { y += dy; h -= dy; }
                if (handle.includes('b')) { h += dy; }
            }

            // Constraints
            w = Math.max(0.02, w);
            h = Math.max(0.02, h);
            x = Math.max(0, Math.min(x, 1 - w));
            y = Math.max(0, Math.min(y, 1 - h));

            return { ...r, x, y, w, h };
        }));
    };

    const onPointerUp = (e: React.PointerEvent) => {
        if (draggingRef.current) {
            e.currentTarget.releasePointerCapture(e.pointerId);
            draggingRef.current = null;
        }
    };

    // Calculation for bottom bar
    const calculations = useMemo(() => {
        if (!imageWidthCm || !imgNatSize || !rects.length) return null;

        const wallRects = rects.filter(r => r.type === 'wall');
        let totalWallCm2 = 0;

        let mainWallRect = wallRects[0];
        if (!mainWallRect) return null; // No wall defined

        for (const wr of wallRects) {
            const dim = getRectCm(wr);
            totalWallCm2 += dim.w * dim.h;
        }

        let exclusionsCm2 = 0;
        const exclusionsFormatted: ExclusionConfig[] = [];

        const excRects = rects.filter(r => r.type !== 'wall');
        excRects.forEach((exc, idx) => {
            const dim = getRectCm(exc);
            exclusionsCm2 += dim.w * dim.h;

            // Calculate X van links and Y van onder relative to the main wall!
            // App.tsx logic expects coords relative to bottom-left of the main wall.
            const mainWallBottomY = mainWallRect.y + mainWallRect.h;
            const excBottomY = exc.y + exc.h;

            // Convert diff in percentages to CM
            const xCm = Math.max(0, (exc.x - mainWallRect.x) * imageWidthCm);
            const yCm = Math.max(0, (mainWallBottomY - excBottomY) * imageWidthCm * (imgNatSize.h / imgNatSize.w));

            exclusionsFormatted.push({
                id: `painter-exc-${idx}`,
                x: xCm,
                y: yCm,
                width: dim.w,
                height: dim.h
            });
        });

        const netAreaM2 = Math.max(0, totalWallCm2 - exclusionsCm2) / 10000;
        const panelAreaCm2 = panelConfig.width * panelConfig.height;
        const panelsNeeded = Math.ceil(Math.max(0, totalWallCm2 - exclusionsCm2) / panelAreaCm2);

        return {
            netAreaM2,
            panelsNeeded,
            exportWall: { width: getRectCm(mainWallRect).w, height: getRectCm(mainWallRect).h },
            exportExcls: exclusionsFormatted
        };
    }, [rects, imageWidthCm, imgNatSize, panelConfig, getRectCm]);


    if (!photo) {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col items-center justify-center text-center space-y-4 min-h-[50vh]">
                <div className="h-16 w-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center">
                    <Camera size={32} />
                </div>
                <div>
                    <h3 className="text-lg font-semibold text-slate-800">Tekenmodule Starten</h3>
                    <p className="text-sm text-slate-500 max-w-sm mt-1">
                        Maak een foto van de gevel. Google Gemini zal automatisch alle ramen en deuren herkennen en voortekenen op schaal!
                    </p>
                </div>
                <div className="flex space-x-3 w-full max-w-xs pt-4">
                    <button
                        onClick={handleCameraCapture}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                    >
                        <Camera size={18} />
                        Camera
                    </button>
                    <label className="flex-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 py-2.5 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 cursor-pointer">
                        <ImageIcon size={18} />
                        Gallerij
                        <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                    </label>
                </div>
            </div>
        );
    }

    const getRectColor = (type: RectType) => {
        switch (type) {
            case 'wall': return 'blue';
            case 'window': return 'cyan';
            case 'door': return 'orange';
        }
    };

    return (
        <div className="relative w-full h-[75vh] bg-slate-900 rounded-xl overflow-hidden flex flex-col shadow-lg border border-slate-800">

            {/* Floating Toolbar */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-md px-4 py-2 rounded-full shadow-lg flex gap-4 z-20 items-center">
                <button onClick={addManualRect} className="p-2 text-slate-600 hover:bg-slate-100 hover:text-blue-600 rounded-full flex items-center gap-1 text-sm font-semibold" title="Rond/Deur Tekenen">
                    <PlusSquare size={18} /> Toevoegen
                </button>
            </div>

            {/* Editor Workspace */}
            <div
                className="flex-1 w-full relative select-none touch-none overflow-hidden"
                ref={containerRef}
                onPointerDown={() => {
                    setSelectedRectId(null);
                    setSettingMeasureId(null);
                }}
            >
                {/* The Wrapper Div fitting exactly over the image */}
                <div
                    ref={wrapperRef}
                    className="absolute inset-0 m-auto"
                    style={imgNatSize && containerRef.current ? (
                        // Object Contain calculation
                        (() => {
                            const cw = containerRef.current.clientWidth;
                            const ch = containerRef.current.clientHeight;
                            const iRatio = imgNatSize.w / imgNatSize.h;
                            const cRatio = cw / ch;
                            if (iRatio > cRatio) {
                                return { width: '100%', height: cw / iRatio };
                            } else {
                                return { width: ch * iRatio, height: '100%' };
                            }
                        })()
                    ) : { width: '100%', height: '100%' }}
                >
                    <img src={photo} className="absolute inset-0 w-full h-full object-contain pointer-events-none opacity-80" />

                    {aiStatus === 'loading' && (
                        <div className="absolute inset-0 bg-slate-900/60 flex flex-col items-center justify-center z-50">
                            <Loader2 size={48} className="animate-spin text-blue-500 mb-4" />
                            <p className="text-white font-medium text-lg">AI analyseert gevel...</p>
                            <p className="text-slate-300 text-sm mt-1">Schatting van schaal en ramen berekenen.</p>
                        </div>
                    )}

                    {aiStatus === 'error' && (
                        <div className="absolute inset-0 bg-slate-900/80 flex flex-col items-center justify-center z-50 p-6 text-center">
                            <p className="text-red-400 font-bold mb-2">Oeps! Analyse mislukt</p>
                            <p className="text-slate-300 text-sm">{aiErrorMsg}</p>
                            <button onClick={() => setAiStatus('idle')} className="mt-4 bg-slate-700 px-4 py-2 rounded text-white text-sm">Zelf handmatig tekenen</button>
                        </div>
                    )}

                    {/* Rectangles */}
                    {rects.map(r => {
                        const isSel = selectedRectId === r.id;
                        const isMeasure = settingMeasureId === r.id;
                        const color = getRectColor(r.type);
                        const dimCm = getRectCm(r);

                        return (
                            <div
                                key={r.id}
                                className="absolute border-2 transition-colors cursor-move shadow-md"
                                style={{
                                    left: r.x * 100 + '%',
                                    top: r.y * 100 + '%',
                                    width: r.w * 100 + '%',
                                    height: r.h * 100 + '%',
                                    borderColor: isSel ? 'white' : color === 'blue' ? '#3b82f6' : color === 'cyan' ? '#06b6d4' : '#f97316',
                                    backgroundColor: color === 'blue' ? 'rgba(59, 130, 246, 0.2)' : color === 'cyan' ? 'rgba(6, 182, 212, 0.2)' : 'rgba(249, 115, 22, 0.2)',
                                    zIndex: isSel ? 10 : 1
                                }}
                                onPointerDown={(e) => handlePointerDown(r.id, 'move', e)}
                                onPointerMove={onPointerMove}
                                onPointerUp={onPointerUp}
                            >
                                {/* Top Label */}
                                <div className="absolute -top-7 left-1/2 -translate-x-1/2 flex items-center gap-1 z-20">
                                    <button
                                        onPointerDown={(e) => cycleType(r.id, e)}
                                        className="bg-black/80 backdrop-blur text-white text-xs font-bold px-2 py-1 rounded-md capitalize shadow hover:bg-slate-800"
                                    >
                                        {r.type}
                                    </button>
                                    {isSel && !isMeasure && (
                                        <button onPointerDown={(e) => { e.stopPropagation(); setSettingMeasureId(r.id); }} className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-md shadow flex items-center gap-1">
                                            <Maximize size={12} /> Maat instellen
                                        </button>
                                    )}
                                </div>

                                {/* Delete Button */}
                                {
                                    isSel && (
                                        <button onPointerDown={(e) => deleteRect(r.id, e)} className="absolute -top-3 -right-3 bg-red-500 text-white p-1 rounded-full shadow-lg z-20">
                                            <Trash2 size={14} />
                                        </button>
                                    )
                                }

                                {/* Dimension Arrows UI */}
                                {
                                    isMeasure && (
                                        <div className="absolute inset-0 pointer-events-none">
                                            {/* Horizontal */}
                                            <div className="absolute top-1/2 left-0 w-full border-t-2 border-dashed border-white flex justify-center items-center">
                                                <input
                                                    type="number"
                                                    value={Math.round(dimCm.w)}
                                                    onChange={(e) => setRectCm(r, Number(e.target.value))}
                                                    className="w-16 text-center text-sm font-bold border-2 border-white bg-black/80 text-white rounded outline-none pointer-events-auto shadow-xl"
                                                    onPointerDown={e => e.stopPropagation()}
                                                />
                                            </div>
                                            {/* Vertical */}
                                            <div className="absolute left-1/2 top-0 h-full border-l-2 border-dashed border-white flex justify-center items-center flex-col">
                                                <input
                                                    type="number"
                                                    value={Math.round(dimCm.h)}
                                                    onChange={(e) => setRectCmHeight(r, Number(e.target.value))}
                                                    className="w-16 text-center text-sm font-bold border-2 border-white bg-black/80 text-white rounded outline-none pointer-events-auto shadow-xl z-20"
                                                    onPointerDown={e => e.stopPropagation()}
                                                />
                                            </div>
                                        </div>
                                    )
                                }
                                {
                                    !isMeasure && imageWidthCm && (
                                        <div className="absolute bottom-1 right-2 text-white text-xs font-bold drop-shadow-md pointer-events-none">
                                            {Math.round(dimCm.w)}x{Math.round(dimCm.h)} cm
                                        </div>
                                    )
                                }

                                {/* Drag Handles */}
                                {
                                    isSel && !isMeasure && (
                                        <>
                                            {[
                                                { h: 'tl', t: -6, l: -6 }, { h: 'tr', t: -6, r: -6 },
                                                { h: 'bl', b: -6, l: -6 }, { h: 'br', b: -6, r: -6 },
                                                { h: 't', t: -6, l: '50%', ml: -6 }, { h: 'b', b: -6, l: '50%', ml: -6 },
                                                { h: 'l', l: -6, t: '50%', mt: -6 }, { h: 'r', r: -6, t: '50%', mt: -6 }
                                            ].map(pos => (
                                                <div
                                                    key={pos.h}
                                                    onPointerDown={(e) => handlePointerDown(r.id, pos.h as HandleType, e)}
                                                    className="absolute bg-white border-2 border-blue-500 shadow-sm z-30"
                                                    style={{
                                                        width: 14, height: 14,
                                                        top: pos.t, bottom: pos.b, left: pos.l, right: pos.r,
                                                        marginLeft: pos.ml, marginTop: pos.mt,
                                                        cursor: pos.h.includes('l') && pos.h.includes('t') ? 'nwse-resize' : pos.h === 'tr' || pos.h === 'bl' ? 'nesw-resize' : pos.h === 't' || pos.h === 'b' ? 'ns-resize' : 'ew-resize'
                                                    }}
                                                />
                                            ))}
                                        </>
                                    )
                                }
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Bottom Sticky Action Bar */}
            <div className="bg-slate-800 text-white p-4 flex items-center justify-between shrink-0 z-20">
                <div className="flex gap-6">
                    <div>
                        <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Netto m²</p>
                        <p className="text-xl font-bold">{calculations ? calculations.netAreaM2.toFixed(2) : '0.00'}</p>
                    </div>
                    <div>
                        <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Est. Platen</p>
                        <p className="text-xl font-bold">{calculations ? calculations.panelsNeeded : '0'}</p>
                    </div>
                </div>

                <button
                    disabled={!calculations || !rects.some(r => r.type === 'wall')}
                    onClick={() => {
                        if (calculations) {
                            onExport(calculations.exportWall, calculations.exportExcls);
                        }
                    }}
                    className={`px-5 py-2.5 rounded-lg font-bold flex items-center gap-2 transition-all shadow-lg ${calculations && rects.some(r => r.type === 'wall') ? 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/30 text-white' : 'bg-slate-700 text-slate-400 cursor-not-allowed'}`}
                >
                    <Calculator size={18} />
                    Snijplan
                </button>
            </div>
        </div >
    );
}
