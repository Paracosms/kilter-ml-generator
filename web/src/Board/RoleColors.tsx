// acquired from Vilin97/KilterBoard dataset
export const roleColors: Record<number, string> = {
    12: "#22c55e", // start
    13: "#3b82f6", // regular
    14: "#ef4444", // finish
    15: "#f59e0b", // foot
};

export function getRoleColor(roleId: number): string {
    // default to purple if roleId is not found (shouldn't happen in a valid dataset)
    return roleColors[roleId] ?? "#a855f7";
}