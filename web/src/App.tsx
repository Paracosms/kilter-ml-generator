import { KilterBoard } from "./Board/KilterBoard";
import { BoardLegend } from "./Board/BoardLegend";
import boardPlacements from "./Data/BoardPlacements.json";

const fakeClimb = [
  {'placementId': 1149, 'roleId': 13},
  {'placementId': 1179, 'roleId': 12},
  {'placementId': 1252, 'roleId': 13},
  {'placementId': 1291, 'roleId': 13},
  {'placementId': 1324, 'roleId': 13},
  {'placementId': 1375, 'roleId': 13},
  {'placementId': 1392, 'roleId': 14},
  {'placementId': 1454, 'roleId': 15},
  {'placementId': 1458, 'roleId': 15},
  {'placementId': 1459, 'roleId': 15},
  {'placementId': 1461, 'roleId': 15},
  {'placementId': 1518, 'roleId': 15}
];

export default function App() {
  return (
      <div style={{ padding: 16, display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
        <KilterBoard
            placements={boardPlacements}
            selectedPlacements={fakeClimb}
            flipY={true}
        />

        <BoardLegend />
      </div>
  );
}