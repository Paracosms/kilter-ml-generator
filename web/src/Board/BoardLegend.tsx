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
            className="min-w-[50px] self-start rounded-2xl bg-slate-900 p-4 text-slate-200"
        >
            <div className="grid gap-3">
                {roleLegend.map(({ roleId, label }) => (
                    // label and color
                    <div
                        key={roleId}
                        className="grid grid-cols-[20px_1fr] items-center gap-x-[15px] text-[30px] leading-[1.2]"
                    >
                        <span
                            aria-hidden="true"
                            className="inline-block size-5 rounded-full"
                            style={{ background: roleColors[roleId] }}
                        />
                        <span>{label}</span>
                    </div>
                ))}
            </div>
        </aside>
    );
}
