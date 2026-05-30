import { getRoleColor } from "./RoleColors";

type HoldMarkerProps = {
    x: number;
    y: number;
    radius?: number;
    roleId?: number;
};

export function HoldMarker({
        x,
        y,
        radius = 2,
        roleId,
    }: HoldMarkerProps) {
    const hasRole = roleId != null;

    // fill in respective color, otherwise leave it greyed out
    const fill = hasRole ? getRoleColor(roleId) : "transparent";
    const stroke = hasRole ? fill : "var(--color-hold-empty)";

    return (
        <circle
            cx={x}
            cy={y}
            r={radius}
            fill={fill}
            stroke={stroke}
            strokeWidth={hasRole ? 2 : 1.5}
            opacity={hasRole ? 1 : 0.45}
        />
    );
}