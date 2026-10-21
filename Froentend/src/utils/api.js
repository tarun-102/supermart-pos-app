// Central API client with Render Cloud Backend integration, automatic token & store-id injection
const CLOUD_RENDER_API = 'https://supermart-pos-app.onrender.com/api';

// In local dev/LAN (Vite), relative `/api` is preferred because Vite server proxies directly to Render with zero CORS issues
const isLocalEnv = typeof window !== 'undefined' && (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.startsWith('192.168.') ||
    window.location.hostname.startsWith('10.') ||
    window.location.port === '5173'
);

const envApiUrl = typeof import.meta !== 'undefined' && (import.meta.env?.VITE_API_URL || import.meta.env?.VITE_BACKEND_URL);
export const BASE_API_URL = isLocalEnv
    ? '/api'
    : (envApiUrl ? (envApiUrl.endsWith('/api') ? envApiUrl : `${envApiUrl}/api`) : CLOUD_RENDER_API);

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

    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

    // Candidate URL list in priority order
    const candidateUrls = endpoint.startsWith('http')
        ? [endpoint]
        : (isLocalEnv
            ? [
                `/api${cleanEndpoint}`,                                      // 1. Vite proxy to Render
                `https://supermart-pos-app.onrender.com/api${cleanEndpoint}`, // 2. Direct Render cloud backend
                `http://localhost:5000/api${cleanEndpoint}`                  // 3. Local server fallback
            ]
            : [
                `${BASE_API_URL}${cleanEndpoint}`,                           // 1. Production cloud API
                `https://supermart-pos-app.onrender.com/api${cleanEndpoint}`, // 2. Explicit Render cloud URL
                `/api${cleanEndpoint}`                                       // 3. Relative proxy fallback
            ]);

    let lastError = null;

    for (const url of candidateUrls) {
        try {
            const res = await fetch(url, {
                headers: defaultHeaders,
                ...options
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                // Legitimate server error (e.g. 400 Invalid credentials, 404, etc.)
                throw new Error(data.message || data.error || `Request failed with status ${res.status}`);
            }

            // Universal sanitization: ensure billNumber NEVER starts with DM- anywhere
            if (data) {
                if (data.bill && data.bill.billNumber) {
                    data.bill.billNumber = String(data.bill.billNumber).replace(/^DM-/i, 'INV-');
                }
                if (Array.isArray(data.bills)) {
                    data.bills.forEach(b => {
                        if (b && b.billNumber) {
                            b.billNumber = String(b.billNumber).replace(/^DM-/i, 'INV-');
                        }
                    });
                }
            }

            return data;
        } catch (err) {
            lastError = err;
            // If the error was a real server response (e.g., wrong password / user not found), don't retry other servers
            if (err.message && !err.message.toLowerCase().includes('fetch') && !err.message.toLowerCase().includes('network')) {
                throw err;
            }
            // Otherwise, it was a network / connection failure, try next candidate URL
            console.warn(`Connection attempt to ${url} failed, trying next candidate...`, err.message);
        }
    }

    console.error(`All connection attempts failed for ${endpoint}:`, lastError);
    throw lastError || new Error('Unable to connect to server. Please check your internet connection.');
}
