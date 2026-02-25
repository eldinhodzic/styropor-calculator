const API_KEY_STORAGE_KEY = 'styrocalc_gemini_api_key';

export function getApiKey(): string | null {
    return localStorage.getItem(API_KEY_STORAGE_KEY);
}

export function saveApiKey(key: string): void {
    localStorage.setItem(API_KEY_STORAGE_KEY, key);
}

export function removeApiKey(): void {
    localStorage.removeItem(API_KEY_STORAGE_KEY);
}
