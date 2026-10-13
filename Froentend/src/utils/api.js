// Central API client with automatic token, store-id injection, and port fallback
const BASE_URL = '/api';

export async function apiFetch(endpoint, options = {}) {
    const token = localStorage.getItem('pos_token') || '';
    let storeId = localStorage.getItem('pos_store_id') || '';
    try {
        const savedUser = JSON.parse(localStorage.getItem('pos_user') || 'null');
        if (savedUser?.storeId) {
            storeId = savedUser.storeId;
        }
    } catch (e) {}

    const defaultHeaders = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...(storeId ? { 'x-store-id': storeId } : {}),
        ...options.headers
    };

    try {
        const res = await fetch(`${BASE_URL}${endpoint}`, {
            headers: defaultHeaders,
            ...options
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error(data.message || data.error || `Request failed with status ${res.status}`);
        }
        return data;
    } catch (err) {
        // If relative proxy failed, attempt direct fallback to http://localhost:5000/api
        if (!options._retried && !endpoint.startsWith('http')) {
            try {
                const res = await fetch(`http://localhost:5000/api${endpoint}`, {
                    headers: defaultHeaders,
                    ...options,
                    _retried: true
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) {
                    throw new Error(data.message || data.error || `Status ${res.status}`);
                }
                return data;
            } catch (fallbackErr) {
                console.error(`API Call failed on fallback for ${endpoint}:`, fallbackErr);
                throw fallbackErr;
            }
        }
        console.error(`API Call failed for ${endpoint}:`, err);
        throw err;
    }
}
