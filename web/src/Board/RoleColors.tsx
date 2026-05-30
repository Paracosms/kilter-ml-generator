// acquired from Vilin97/KilterBoard dataset
export const roleColors: Record<number, string> = {
    12: "var(--color-role-start)", // start (green)
    13: "var(--color-role-regular)", // regular (blue)
    14: "var(--color-role-finish)", // finish (red)
    15: "var(--color-role-foot)", // foot (yellow)
};

export function getRoleColor(roleId: number): string {
    // default to purple if roleId is not found (shouldn't happen in a valid dataset)
    return roleColors[roleId] ?? "var(--color-role-fallback)";
}