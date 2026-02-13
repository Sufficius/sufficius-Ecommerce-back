export function removeCircularReferences(
    obj: any,
    seen: Set<any> = new Set()
): any {
    if (obj && typeof obj === "object") {
        if (seen.has(obj)) {
            // Evitar referência circular retornando 'undefined' ou 'null'
            return null;
        }
        seen.add(obj);

        // Iterar sobre todas as propriedades
        for (const key of Object.keys(obj)) {
            const value = obj[key];
            obj[key] = removeCircularReferences(value, seen);
        }
    }
    return obj;
}
