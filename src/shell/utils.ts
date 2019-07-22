export function assertStringOrNull(val: any): string {
    if (typeof val !== "string" && val !== null) {
        throw new Error(`${val} was expected to be a string or null`);
    }
    return val;
}
