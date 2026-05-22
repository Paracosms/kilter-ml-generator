import { roleColors } from "./RoleColors";

type LegendItem = {
    roleId: number;
    label: string;
};

// ordering
const roleLegend: LegendItem[] = [
    { roleId: 12, label: "Start" },
    { roleId: 14, label: "Finish" },
    { roleId: 13, label: "Regular" },
    { roleId: 15, label: "Foot" },
];

export function BoardLegend() {
    return (
        // legend background
        <aside
            aria-label="Role colors legend"
            style={{
                background: "#111827",
                borderRadius: 16,
                color: "#e5e7eb",
                padding: 16,
                minWidth: 100,
                alignSelf: "flex-start",
            }}
        >
            <div style={{ display: "grid", gap: 12 }}>
                {roleLegend.map(({ roleId, label }) => (
                    // label and color
                    <div
                        key={roleId}
                        style={{
                            display: "grid",
                            gridTemplateColumns: "12px 1fr",
                            alignItems: "center",
                            columnGap: 15,
                            fontSize: 30,
                            fontFamily: "Helvetica",
                            lineHeight: 1.2,
                        }}
                    >
                        <span
                            aria-hidden="true"
                            style={{
                                width: 20,
                                height: 20,
                                borderRadius: 999,
                                background: roleColors[roleId],
                                display: "inline-block",
                            }}
                        />
                        <span>{label}</span>
                    </div>
                ))}
            </div>
        </aside>
    );
}

