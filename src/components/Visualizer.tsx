import type { CalculationResult, Exclusion, WallConfig } from '../CalculatorEngine';

interface Props {
    result: CalculationResult | null;
    wall: WallConfig;
    exclusions: Exclusion[];
}

export default function Visualizer({ result, wall, exclusions }: Props) {
    if (!result) {
        return (
            <div className="bg-slate-100 rounded-xl aspect-video flex-col flex items-center justify-center border-2 border-dashed border-slate-300">
                <p className="text-slate-500 font-medium">Berekent...</p>
            </div>
        );
    }

    // To fit the wall drawing inside the container, we calculate a scale factor.
    // We assume the container has ~ 100% width and we use an aspect-ratio preserving SVG container via viewBox.

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 overflow-hidden">
            <h3 className="text-lg font-semibold mb-4 text-slate-800">Visueel Snijplan</h3>

            <div className="relative w-full overflow-x-auto">
                <svg
                    viewBox={`0 0 ${wall.width} ${wall.height}`}
                    className="w-full h-auto min-w-[500px] bg-slate-100 rounded border border-slate-300 shadow-inner"
                    preserveAspectRatio="xMidYMid meet"
                >
                    {/* Draw each styropor panel */}
                    {result.placedPanels.map((p, index) => (
                        <rect
                            key={p.id || index}
                            x={p.x}
                            // SVG Y goes down, our Y goes up, so we invert Y for visual representation?
                            // Let's assume input y=0 is bottom: Y = wall.height - y - height
                            y={wall.height - p.y - p.height}
                            width={p.width}
                            height={p.height}
                            fill={p.isOffcutReuse ? '#10b981' : (p.isCut ? '#fbbf24' : '#3b82f6')}
                            stroke="#ffffff"
                            strokeWidth={Math.max(1, wall.width / 500)} // scale stroke width
                            fillOpacity={0.7}
                        >
                            <title>{`Plat: ${p.width}x${p.height}cm`}</title>
                        </rect>
                    ))}

                    {/* Draw Window/Door Exclusions over the grid to make it clear */}
                    {exclusions.map((exc, idx) => (
                        <rect
                            key={`exc-${idx}`}
                            x={exc.x}
                            y={wall.height - exc.y - exc.height}
                            width={exc.width}
                            height={exc.height}
                            fill="#1e293b" // slate-800 to look like a window opening/dark hole
                            stroke="#0f172a"
                            strokeWidth={Math.max(2, wall.width / 500)}
                        />
                    ))}
                </svg>
            </div>

            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-sm text-blue-600 font-medium mb-1">Theoretisch</p>
                    <p className="text-2xl font-bold text-blue-900">{result.theoreticalPanels} <span className="text-sm font-normal">platen</span></p>
                </div>
                <div className="bg-amber-50 p-4 rounded-lg">
                    <p className="text-sm text-amber-600 font-medium mb-1">Praktisch (Besteladvies)</p>
                    <p className="text-2xl font-bold text-amber-900">{result.practicalPanels} <span className="text-sm font-normal">platen</span></p>
                </div>
                <div className="bg-slate-50 p-4 rounded-lg">
                    <p className="text-sm text-slate-600 font-medium mb-1">Snijverlies</p>
                    <p className="text-2xl font-bold text-slate-900">{(result.wasteArea / 10000).toFixed(1)} <span className="text-sm font-normal">m²</span></p>
                </div>
                <div className="bg-emerald-50 p-4 rounded-lg">
                    <p className="text-sm text-emerald-600 font-medium mb-1">Netto Oppervlakte</p>
                    <p className="text-2xl font-bold text-emerald-900">{(result.netArea / 10000).toFixed(1)} <span className="text-sm font-normal">m²</span></p>
                </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-blue-500 rounded opacity-70"></div>
                    <span className="text-slate-600">Volle plaat</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-amber-400 rounded opacity-70"></div>
                    <span className="text-slate-600">Gesneden plaat</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-emerald-500 rounded opacity-70"></div>
                    <span className="text-slate-600">Hergebruikt reststuk</span>
                </div>
            </div>
        </div>
    );
}
