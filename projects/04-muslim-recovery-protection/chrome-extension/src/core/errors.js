// Errors carry a stable machine code and numeric params only. They never embed
// user input (domains, phrases, URLs), so they are safe to surface or log.
export class TabsiraError extends Error {
    constructor(code, params = {}) {
        super(code);
        this.name = 'TabsiraError';
        this.code = code;
        this.params = params;
    }
}

export function toErrorPayload(error) {
    if (error instanceof TabsiraError) return { code: error.code, params: error.params };
    return { code: 'unexpected', params: {} };
}
