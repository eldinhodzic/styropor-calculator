import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Camera, Image as ImageIcon, Ruler, Square, PlusSquare, Undo, RefreshCw, Calculator } from 'lucide-react';

export type Point = { x: number; y: number };

export interface ExclusionConfig {
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

type ToolMode = 'reference' | 'main' | 'exclusion' | 'none';

function polygonArea(points: Point[]): number {
    if (points.length < 3) return 0;
    let area = 0;
    for (let i = 0; i < points.length; i++) {
        const j = (i + 1) % points.length;
        area += points[i].x * points[j].y - points[j].x * points[i].y;
    }
    return Math.abs(area / 2);
}

function getBoundingBox(points: Point[]) {
    if (points.length === 0) return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 };
    let minX = points[0].x, maxX = points[0].x;
    let minY = points[0].y, maxY = points[0].y;
    for (const p of points) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
    }
    return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
}

export default function WallPainter({ panelConfig, onExport }: Props) {
    const [photo, setPhoto] = useState<string | null>(null);
    const [scale, setScale] = useState<number | null>(null); // pixels per cm

    const [mode, setMode] = useState<ToolMode>('reference');

    // Drawing state (percentages 0-1 to handle resize)
    const [referenceLine, setReferenceLine] = useState<[Point, Point] | null>(null);
    const [referenceInput, setReferenceInput] = useState<string>('');

    const [mainPolygon, setMainPolygon] = useState<Point[]>([]);
    const [isMainClosed, setIsMainClosed] = useState(false);

    const [exclusions, setExclusions] = useState<Point[][]>([]);
    const [currentExclusion, setCurrentExclusion] = useState<Point[]>([]);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const imageRef = useRef<HTMLImageElement | null>(null);

    const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Load photo
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setPhoto(reader.result as string);
                const img = new Image();
                img.onload = () => {
                    imageRef.current = img;
                    draw();
                };
                img.src = reader.result as string;
            };
            reader.readAsDataURL(file);
        }
    };

    const handleCameraCapture = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            const video = document.createElement('video');
            video.srcObject = stream;
            video.play();

            // Basic implementation for camera: just wait 1 sec to focus then snap
            // A better robust implementation might need a dedicated UI like CameraTool.tsx 
            // but sticking to instructions:
            setTimeout(() => {
                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth || 1920;
                canvas.height = video.videoHeight || 1080;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    const data = canvas.toDataURL('image/jpeg');
                    setPhoto(data);
                    const img = new Image();
                    img.onload = () => {
                        imageRef.current = img;
                        draw();
                    };
                    img.src = data;
                }
                stream.getTracks().forEach(t => t.stop());
            }, 1000);

        } catch (e) {
            alert('Camera fout');
        }
    };

    // Canvas Drawing
    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (imageRef.current) {
            // Draw image to fill bounds or fit bounds
            const img = imageRef.current;
            const { width, height } = canvas;

            const scaleImage = Math.max(width / img.width, height / img.height);
            const x = (width / 2) - (img.width / 2) * scaleImage;
            const y = (height / 2) - (img.height / 2) * scaleImage;

            ctx.globalAlpha = 0.6; // Slightly dim image to see lines
            ctx.drawImage(img, x, y, img.width * scaleImage, img.height * scaleImage);
            ctx.globalAlpha = 1.0;
        }

        // Helper to draw points
        const drawPoints = (points: Point[], color: string, closed: boolean, fillColor?: string) => {
            if (points.length === 0) return;

            ctx.beginPath();
            // Map percentages to pixels
            const pxs = points.map(p => ({ x: p.x * canvas.width, y: p.y * canvas.height }));

            ctx.moveTo(pxs[0].x, pxs[0].y);
            for (let i = 1; i < pxs.length; i++) {
                ctx.lineTo(pxs[i].x, pxs[i].y);
            }

            if (closed && pxs.length > 2) {
                ctx.closePath();
                if (fillColor) {
                    ctx.fillStyle = fillColor;
                    ctx.fill();
                }
            }

            ctx.strokeStyle = color;
            ctx.lineWidth = 3;
            if (!closed) {
                ctx.setLineDash([5, 5]);
            } else {
                ctx.setLineDash([]);
            }
            ctx.stroke();
            ctx.setLineDash([]);

            // Draw dots
            pxs.forEach((p) => {
                ctx.beginPath();
                ctx.arc(p.x, p.y, 6, 0, 2 * Math.PI);
                ctx.fillStyle = 'white';
                ctx.fill();
                ctx.lineWidth = 2;
                ctx.strokeStyle = color;
                ctx.stroke();
            });

            if (closed && scale && pxs.length > 2) {
                // Draw area label in center
                const minX = Math.min(...pxs.map(p => p.x));
                const maxX = Math.max(...pxs.map(p => p.x));
                const minY = Math.min(...pxs.map(p => p.y));
                const maxY = Math.max(...pxs.map(p => p.y));
                const cx = (minX + maxX) / 2;
                const cy = (minY + maxY) / 2;

                // area in pixels
                const areaPx = polygonArea(pxs);
                // area in cm2
                const areaCm2 = areaPx / (scale * scale);
                const areaM2 = (areaCm2 / 10000).toFixed(2);

                ctx.fillStyle = 'white';
                ctx.font = 'bold 14px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.shadowColor = 'rgba(0,0,0,0.5)';
                ctx.shadowBlur = 4;
                ctx.fillText(`${areaM2} m²`, cx, cy);
                ctx.shadowBlur = 0;
            }
        };

        // Draw reference line
        if (referenceLine) {
            const [p1, p2] = referenceLine;
            if (p1) {
                ctx.beginPath();
                ctx.arc(p1.x * canvas.width, p1.y * canvas.height, 6, 0, 2 * Math.PI);
                ctx.fillStyle = 'yellow';
                ctx.fill();
                ctx.stroke();
            }
            if (p1 && p2) {
                ctx.beginPath();
                ctx.moveTo(p1.x * canvas.width, p1.y * canvas.height);
                ctx.lineTo(p2.x * canvas.width, p2.y * canvas.height);
                ctx.strokeStyle = 'yellow';
                ctx.lineWidth = 3;
                ctx.stroke();

                ctx.beginPath();
                ctx.arc(p2.x * canvas.width, p2.y * canvas.height, 6, 0, 2 * Math.PI);
                ctx.fillStyle = 'yellow';
                ctx.fill();
                ctx.stroke();
            }
        }

        // Draw main
        drawPoints(mainPolygon, '#3b82f6', isMainClosed, 'rgba(59, 130, 246, 0.4)');

        // Draw exclusions
        exclusions.forEach(exc => drawPoints(exc, '#ef4444', true, 'rgba(239, 68, 68, 0.4)'));
        drawPoints(currentExclusion, '#ef4444', false);

    }, [referenceLine, mainPolygon, isMainClosed, exclusions, currentExclusion, scale]);

    useEffect(() => {
        draw();
    }, [draw]);

    useEffect(() => {
        const handleResize = () => draw();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [draw]);

    const handlePointerDown = (clientX: number, clientY: number) => {
        if (!canvasRef.current) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const x = (clientX - rect.left) / rect.width;
        const y = (clientY - rect.top) / rect.height;

        // Check if we tapped close to first point of active polygon
        if (mode === 'main' && mainPolygon.length > 2 && !isMainClosed) {
            const first = mainPolygon[0];
            const dist = Math.sqrt(Math.pow(first.x - x, 2) + Math.pow(first.y - y, 2));
            if (dist < 0.05) {
                setIsMainClosed(true);
                setMode('exclusion');
                return;
            }
        } else if (mode === 'exclusion' && currentExclusion.length > 2) {
            const first = currentExclusion[0];
            const dist = Math.sqrt(Math.pow(first.x - x, 2) + Math.pow(first.y - y, 2));
            if (dist < 0.05) {
                setExclusions([...exclusions, currentExclusion]);
                setCurrentExclusion([]);
                return;
            }
        }

        if (mode === 'reference') {
            if (!referenceLine) {
                setReferenceLine([{ x, y }, { x, y }]); // temporary second pos
            } else if (referenceLine.length === 2 && referenceLine[0].x === referenceLine[1].x && referenceLine[1].x === x) {
                // this helps click 2 setup
            } else {
                // setting second point
                // handled in up
            }
        } else if (mode === 'main' && !isMainClosed) {
            setMainPolygon([...mainPolygon, { x, y }]);
        } else if (mode === 'exclusion') {
            setCurrentExclusion([...currentExclusion, { x, y }]);
        }
    };

    const handlePointerUp = (clientX: number, clientY: number) => {
        if (mode === 'reference' && referenceLine && referenceLine[0].x === referenceLine[1].x) {
            const rect = canvasRef.current?.getBoundingClientRect();
            if (rect) {
                const x = (clientX - rect.left) / rect.width;
                const y = (clientY - rect.top) / rect.height;
                const dist = Math.sqrt(Math.pow(referenceLine[0].x - x, 2) + Math.pow(referenceLine[0].y - y, 2));
                if (dist > 0.01) {
                    setReferenceLine([referenceLine[0], { x, y }]);
                }
            }
        }
    };

    const setReferenceScale = () => {
        if (referenceLine && referenceInput && canvasRef.current) {
            const [p1, p2] = referenceLine;
            const rect = canvasRef.current.getBoundingClientRect();
            const px1 = p1.x * rect.width;
            const py1 = p1.y * rect.height;
            const px2 = p2.x * rect.width;
            const py2 = p2.y * rect.height;

            const distancePx = Math.sqrt(Math.pow(px2 - px1, 2) + Math.pow(py2 - py1, 2));
            const cm = parseFloat(referenceInput);
            if (!isNaN(cm) && cm > 0) {
                setScale(distancePx / cm);
                setMode('main');
            }
        }
    };

    const calculations = useMemo(() => {
        if (!scale || !isMainClosed || !canvasRef.current) return null;
        const cw = canvasRef.current.width;
        const ch = canvasRef.current.height;

        // Main wall box in px
        const mainPxPoints = mainPolygon.map(p => ({ x: p.x * cw, y: p.y * ch }));
        const wallBoxPx = getBoundingBox(mainPxPoints);
        const wallWidthCm = wallBoxPx.width / scale;
        const wallHeightCm = wallBoxPx.height / scale;

        const wallAreaCm2 = polygonArea(mainPxPoints) / (scale * scale);

        let exclAreaCm2 = 0;
        const exclusionsFormatted: ExclusionConfig[] = exclusions.map((excPoints, idx) => {
            const pxPoints = excPoints.map(p => ({ x: p.x * cw, y: p.y * ch }));
            exclAreaCm2 += polygonArea(pxPoints) / (scale * scale);
            const boxPx = getBoundingBox(pxPoints);

            // relative to main wall minX, maxY (bottom-left)
            const x_van_links_px = boxPx.minX - wallBoxPx.minX;
            // Y van onder is Wall bottom (maxY) minus Exclusion bottom (maxY)
            const y_van_onder_px = wallBoxPx.maxY - boxPx.maxY;

            return {
                id: `exc-draw-${idx}`,
                x: x_van_links_px / scale,
                y: y_van_onder_px / scale,
                width: boxPx.width / scale,
                height: boxPx.height / scale
            };
        });

        const netAreaM2 = (wallAreaCm2 - exclAreaCm2) / 10000;

        // Quick estimate for display
        const panelAreaCm2 = panelConfig.width * panelConfig.height;
        const panelsNeeded = Math.ceil((wallAreaCm2 - exclAreaCm2) / panelAreaCm2);

        return {
            netAreaM2,
            panelsNeeded,
            exportWall: { width: wallWidthCm, height: wallHeightCm },
            exportExcls: exclusionsFormatted
        };

    }, [mainPolygon, isMainClosed, exclusions, scale, panelConfig]);

    const undo = () => {
        if (mode === 'main' && !isMainClosed && mainPolygon.length > 0) {
            setMainPolygon(mainPolygon.slice(0, -1));
        } else if (mode === 'exclusion' && currentExclusion.length > 0) {
            setCurrentExclusion(currentExclusion.slice(0, -1));
        } else if (mode === 'exclusion' && currentExclusion.length === 0 && exclusions.length > 0) {
            setExclusions(exclusions.slice(0, -1));
        }
    };

    const resetAll = () => {
        setMainPolygon([]);
        setIsMainClosed(false);
        setExclusions([]);
        setCurrentExclusion([]);
        setReferenceLine(null);
        setScale(null);
        setMode('reference');
    };

    if (!photo) {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col items-center justify-center text-center space-y-4 min-h-[50vh]">
                <div className="h-16 w-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center">
                    <Camera size={32} />
                </div>
                <div>
                    <h3 className="text-lg font-semibold text-slate-800">Tekenmodule Starten</h3>
                    <p className="text-sm text-slate-500 max-w-sm mt-1">
                        Maak een foto van de gevel op de bouwplaats om handmatig snijlijnen en uitsluitingen te tekenen.
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

    return (
        <div className="relative w-full h-[75vh] bg-slate-900 rounded-xl overflow-hidden flex flex-col shadow-lg">
            {/* Floating Toolbar */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-md px-4 py-2 rounded-full shadow-lg flex gap-4 z-10 items-center">
                <button onClick={() => setMode('reference')} className={`p-2 rounded-full ${mode === 'reference' ? 'bg-blue-100 text-blue-600' : 'text-slate-600 hover:bg-slate-100'}`} title="Schaal Lijn">
                    <Ruler size={20} />
                </button>
                <button onClick={() => setMode('main')} disabled={!scale} className={`p-2 rounded-full ${mode === 'main' ? 'bg-blue-100 text-blue-600' : 'text-slate-600 hover:bg-slate-100'} ${!scale && 'opacity-50'}`} title="Muur Tekenen">
                    <Square size={20} />
                </button>
                <button onClick={() => setMode('exclusion')} disabled={!isMainClosed} className={`p-2 rounded-full ${mode === 'exclusion' ? 'bg-red-100 text-red-600' : 'text-slate-600 hover:bg-slate-100'} ${!isMainClosed && 'opacity-50'}`} title="Uitsluiting Tekenen">
                    <PlusSquare size={20} />
                </button>
                <div className="w-[1px] h-6 bg-slate-300 mx-1"></div>
                <button onClick={undo} className="p-2 text-slate-600 hover:bg-slate-100 rounded-full" title="Ongedaan maken">
                    <Undo size={20} />
                </button>
                <button onClick={resetAll} className="p-2 text-slate-600 hover:bg-slate-100 rounded-full" title="Reset alles">
                    <RefreshCw size={20} />
                </button>
            </div>

            {/* Reference scale input popup */}
            {referenceLine && referenceLine[0].x !== referenceLine[1].x && !scale && mode === 'reference' && (
                <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-white p-3 rounded-lg shadow-xl z-20 flex gap-2 items-center">
                    <input
                        type="number"
                        placeholder="Maat in cm"
                        value={referenceInput}
                        onChange={e => setReferenceInput(e.target.value)}
                        className="w-24 border border-slate-300 rounded px-2 py-1 outline-none focus:border-blue-500 font-medium"
                        autoFocus
                    />
                    <button onClick={setReferenceScale} className="bg-blue-600 text-white px-3 py-1 rounded font-semibold text-sm">OK</button>
                </div>
            )}

            {/* Canvas Layer */}
            <div
                className="flex-1 w-full relative select-none touch-none"
                ref={containerRef}
                onMouseDown={(e) => {
                    const rect = canvasRef.current?.getBoundingClientRect();
                    if (rect) handlePointerDown(e.clientX, e.clientY);
                }}
                onMouseUp={(e) => {
                    const rect = canvasRef.current?.getBoundingClientRect();
                    if (rect) handlePointerUp(e.clientX, e.clientY);
                }}
                onTouchStart={(e) => {
                    longPressTimer.current = setTimeout(() => {
                        // long press logic: undo last point
                        undo();
                    }, 500);
                    handlePointerDown(e.touches[0].clientX, e.touches[0].clientY);
                }}
                onTouchMove={() => {
                    if (longPressTimer.current) clearTimeout(longPressTimer.current);
                }}
                onTouchEnd={(e) => {
                    if (longPressTimer.current) clearTimeout(longPressTimer.current);
                    if (e.changedTouches.length > 0) {
                        handlePointerUp(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
                    }
                }}
            >
                <canvas
                    ref={canvasRef}
                    className="absolute inset-0 w-full h-full object-contain"
                    // Resize handler ensures internal res matches displayed res
                    onLoad={(e) => {
                        const el = e.target as HTMLCanvasElement;
                        el.width = el.clientWidth;
                        el.height = el.clientHeight;
                        draw();
                    }}
                />
            </div>

            {/* Bottom Sticky Action Bar */}
            <div className="bg-slate-800 text-white p-4 flex items-center justify-between shrink-0">
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
                    disabled={!calculations}
                    onClick={() => {
                        if (calculations) {
                            onExport(calculations.exportWall, calculations.exportExcls);
                        }
                    }}
                    className={`px-5 py-2.5 rounded-lg font-bold flex items-center gap-2 transition-all shadow-lg ${calculations ? 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/30 text-white' : 'bg-slate-700 text-slate-400 cursor-not-allowed'}`}
                >
                    <Calculator size={18} />
                    Snijplan
                </button>
            </div>
        </div>
    );
}
