export interface Exclusion {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface PanelConfig {
    width: number;
    height: number;
}

export interface WallConfig {
    width: number;
    height: number;
}

export interface PlacedPanel {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    isCut: boolean;
    isOffcutReuse: boolean;
}

export interface CutPiece {
    width: number;
    height: number;
}

export interface CalculationResult {
    netArea: number; // in cm2
    grossArea: number; // in cm2
    theoreticalPanels: number;
    practicalPanels: number;
    placedPanels: PlacedPanel[];
    wasteArea: number; // in cm2
}

export function calculateStyropor(
    wall: WallConfig,
    panel: PanelConfig,
    exclusions: Exclusion[]
): CalculationResult {
    const placedPanels: PlacedPanel[] = [];
    const offcuts: CutPiece[] = [];

    let panelsUsed = 0;

    // Create a grid simulation from bottom-left (0,0) to top-right
    const rows = Math.ceil(wall.height / panel.height);

    let yOffset = 0;

    for (let r = 0; r < rows; r++) {
        // Half-bond connection (halfsteensverband) shift every other row
        let xOffset = (r % 2 === 1) ? -(panel.width / 2) : 0;

        // We keep placing panels until we cover the row width
        while (xOffset < wall.width) {
            // Calculate actual panel dimensions visible on the wall
            const startX = Math.max(0, xOffset);
            const startY = yOffset;
            const endX = Math.min(wall.width, xOffset + panel.width);
            const endY = Math.min(wall.height, yOffset + panel.height);

            const widthOnWall = endX - startX;
            const heightOnWall = endY - startY;

            // Check if this area overlaps entirely with an exclusion
            let overlapsExclusion = false;
            for (const exc of exclusions) {
                // Simplified AABB intersection
                if (
                    startX < exc.x + exc.width &&
                    startX + widthOnWall > exc.x &&
                    startY < exc.y + exc.height &&
                    startY + heightOnWall > exc.y
                ) {
                    // It overlaps. For MVP we consider it cut if it overlaps, but if it's completely inside...
                    if (
                        startX >= exc.x &&
                        startX + widthOnWall <= exc.x + exc.width &&
                        startY >= exc.y &&
                        startY + heightOnWall <= exc.y + exc.height
                    ) {
                        overlapsExclusion = true; // completely inside window, skip placing
                    }
                }
            }

            if (!overlapsExclusion && widthOnWall > 0 && heightOnWall > 0) {
                // We need a piece of size (widthOnWall x heightOnWall)
                let reused = false;

                // Try to find an offcut that fits
                const offcutIndex = offcuts.findIndex(
                    (oc) => oc.width >= widthOnWall && oc.height >= heightOnWall
                );

                if (offcutIndex !== -1) {
                    reused = true;
                    // Use this offcut
                    // We don't push remaining smaller pieces from offcuts yet to keep MVP simple
                    offcuts.splice(offcutIndex, 1);
                } else {
                    // Need a new panel
                    panelsUsed++;

                    // If we had to cut the new panel, save the rest as an offcut
                    if (widthOnWall < panel.width) {
                        offcuts.push({
                            width: panel.width - widthOnWall,
                            height: panel.height,
                        });
                    }
                }

                placedPanels.push({
                    id: `p-${r}-${xOffset}`,
                    x: startX,
                    y: startY,
                    width: widthOnWall,
                    height: heightOnWall,
                    isCut: widthOnWall < panel.width || heightOnWall < panel.height,
                    isOffcutReuse: reused,
                });
            }

            xOffset += panel.width;
        }

        yOffset += panel.height;
    }

    // Calculate areas
    const grossArea = wall.width * wall.height;
    const exclArea = exclusions.reduce((acc, curr) => acc + (curr.width * curr.height), 0);
    const netArea = grossArea - exclArea;
    const panelArea = panel.width * panel.height;
    const theoreticalPanels = netArea / panelArea;

    const actualUsedArea = panelsUsed * panelArea;
    const wasteArea = actualUsedArea - netArea;

    return {
        netArea,
        grossArea,
        theoreticalPanels: Math.ceil(theoreticalPanels),
        practicalPanels: panelsUsed,
        placedPanels,
        wasteArea,
    };
}
