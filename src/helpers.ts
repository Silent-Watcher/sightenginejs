export function isNumber(v: any): v is number {
    return typeof v === "number" && !Number.isNaN(v);
}

// Recursively collect numeric leaf values with their path
export function collectNumericValues(
    obj: any,
    prefix = "",
): Array<{ path: string; value: number }> {
    const out: Array<{ path: string; value: number }> = [];
    if (obj && typeof obj === "object") {
        for (const k of Object.keys(obj)) {
            const v = obj[k];
            const path = prefix ? `${prefix}.${k}` : k;
            if (isNumber(v)) out.push({ path, value: v });
            else if (typeof v === "object") {
                out.push(...collectNumericValues(v, path));
            }
        }
    }
    return out;
}
