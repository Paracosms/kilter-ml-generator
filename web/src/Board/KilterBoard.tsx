import { HoldMarker } from "./HoldMarker";

export type BoardPlacement = {
    placementId: number;
    x: number;
    y: number;
};

export type DisplayPlacement = {
    placementId: number;
    roleId: number;
};

type KilterBoardProps = {
    placements: BoardPlacement[];
    selectedPlacements: DisplayPlacement[];
    width?: number;
    height?: number;
    flipY?: boolean;
};

export function KilterBoard(
    {
        // size properties
        width = 500,
        height = 700,

        placements,
        selectedPlacements,
        flipY = false,
    }: KilterBoardProps) {

    // map placementId to roleId (e.g. placement=5 role=12 -> 5:12)
    const selectedByPlacementId = new Map(
        selectedPlacements.map((p) => [p.placementId, p.roleId])
    );

    // gets and creates the bounding box for the board
    const xs = placements.map((p) => p.x);
    const ys = placements.map((p) => p.y);

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const padding = 10;

    const viewBox = [
        minX - padding,
        minY - padding,
        maxX - minX + padding * 2,
        maxY - minY + padding * 2,
    ].join(" ");

    // flip because Y is down
    function displayY(y: number) {
        return flipY ? maxY - (y - minY) : y;
    }

    return (
        <div style={{ width, maxWidth: "100%" }}>
            <svg
                viewBox={viewBox}
                width="100%"
                height={height}
                preserveAspectRatio="xMidYMid meet"
                style={{
                    background: "#111827",
                    borderRadius: 16,
                }}
            >
                {placements.map((placement) => {
                    // maps placement to role, if it exists. renders all placements and their color if applicable
                    const roleId = selectedByPlacementId.get(placement.placementId);
                    return (
                        <HoldMarker
                            key={placement.placementId}
                            x={placement.x}
                            y={displayY(placement.y)}
                            roleId={roleId}
                        />
                    );
                })}
            </svg>
        </div>
    );
}