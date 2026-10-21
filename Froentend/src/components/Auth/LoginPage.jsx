import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../utils/api';
import { toast } from 'react-toastify';

export default function LoginPage({ onLoginSuccess }) {
    const [activeTab, setActiveTab] = useState('login'); // 'login', 'register_store', 'register_staff'

    // Registered Stores for selector / staff application
    const [availableStores, setAvailableStores] = useState([]);

    // Login Form State
    const [loginUsername, setLoginUsername] = useState('cashier1');
    const [loginPassword, setLoginPassword] = useState('cashier123');
    const [loginLoading, setLoginLoading] = useState(false);
    const [loginError, setLoginError] = useState(null);

    // Register Store State
    const [storeName, setStoreName] = useState('');
    const [storeType, setStoreType] = useState('Supermarket & Kirana');
    const [ownerName, setOwnerName] = useState('');
    const [address, setAddress] = useState('');
    const [contact, setContact] = useState('');
    const [gstin, setGstin] = useState('');
    const [receiptTagline, setReceiptTagline] = useState('Thank you for shopping with us! Visit again.');
    const [adminUsername, setAdminUsername] = useState('');
    const [adminPassword, setAdminPassword] = useState('');
    const [storeCounters, setStoreCounters] = useState([
        'Counter-01 (Express Billing)',
        'Counter-02 (General Checkout)',
        'Counter-03 (Quick Pay)'
    ]);
    const [newCounterInput, setNewCounterInput] = useState('');
    const [seedSampleProducts, setSeedSampleProducts] = useState(true);
    const [storeRegLoading, setStoreRegLoading] = useState(false);
    const [storeRegError, setStoreRegError] = useState(null);
    const [storeRegSuccess, setStoreRegSuccess] = useState(null);

    // Staff Register Form State
    const [selectedStoreId, setSelectedStoreId] = useState('');
    const [regName, setRegName] = useState('');
    const [regUsername, setRegUsername] = useState('');
    const [regPassword, setRegPassword] = useState('');
    const [regRole, setRegRole] = useState('cashier');
    const [regCounter, setRegCounter] = useState('Counter-01');
    const [regLoading, setRegLoading] = useState(false);
    const [regSuccess, setRegSuccess] = useState(null);
    const [regError, setRegError] = useState(null);

    useEffect(() => {
        loadStoresList();
    }, []);

    const loadStoresList = async () => {
        try {
            const res = await apiFetch('/store/all');
            if (res.stores && res.stores.length > 0) {
                setAvailableStores(res.stores);
                setSelectedStoreId(res.stores[0].id);
            }
        } catch (e) {
            console.warn('Could not fetch store list:', e);
        }
    };

    // Handle Login Submit
    const handleLoginSubmit = async (e) => {
        e.preventDefault();
        setLoginError(null);
        setLoginLoading(true);

        try {
            const res = await apiFetch('/auth/login', {
                method: 'POST',
                body: JSON.stringify({
                    username: loginUsername.trim(),
                    password: loginPassword.trim()
                })
            });

            if (res.success && res.user) {
                localStorage.setItem('pos_token', res.token);
                localStorage.setItem('pos_user', JSON.stringify(res.user));
                if (res.user.storeId) {
                    localStorage.setItem('pos_store_id', res.user.storeId);
                }
                onLoginSuccess(res.user);
            }
        } catch (err) {
            const rawMsg = err.message || '';
            const friendlyMsg = rawMsg.toLowerCase().includes('fetch')
                ? 'Unable to connect to server. Retrying connection to cloud backend...'
                : (rawMsg || 'Login failed.');
            setLoginError(friendlyMsg);
        } finally {
            setLoginLoading(false);
        }
    };

    // Handle Quick Demo Fill
    const fillDemoCredentials = (u, p) => {
        setLoginUsername(u);
        setLoginPassword(p);
        setLoginError(null);
    };

    // Counter management for new store registration
    const handleAddStoreCounter = (e) => {
        if (e) e.preventDefault();
        const trimmed = newCounterInput.trim();
        if (!trimmed) return;
        if (storeCounters.includes(trimmed)) {
            toast.warning('This counter already exists in the list!');
            return;
        }
        setStoreCounters([...storeCounters, trimmed]);
        setNewCounterInput('');
    };

    const handleRemoveStoreCounter = (indexToRemove) => {
        if (storeCounters.length <= 1) {
            toast.warning('At least one counter is required for billing.');
            return;
        }
        setStoreCounters(storeCounters.filter((_, idx) => idx !== indexToRemove));
    };

    // Handle Register Store Submit
    const handleRegisterStoreSubmit = async (e) => {
        e.preventDefault();
        setStoreRegError(null);
        setStoreRegSuccess(null);
        setStoreRegLoading(true);

        try {
            const res = await apiFetch('/store/register', {
                method: 'POST',
                body: JSON.stringify({
                    storeName: storeName.trim(),
                    storeType: storeType.trim(),
                    ownerName: ownerName.trim(),
                    address: address.trim(),
                    contact: contact.trim(),
                    gstin: gstin.trim(),
                    receiptTagline: receiptTagline.trim(),
                    counters: storeCounters,
                    adminUsername: adminUsername.trim(),
                    adminPassword: adminPassword.trim(),
                    seedSampleProducts
                })
            });

            if (res.success && res.user) {
                setStoreRegSuccess(`Shop "${res.store.storeName}" registered successfully!`);
                localStorage.setItem('pos_token', res.token);
                localStorage.setItem('pos_user', JSON.stringify(res.user));
                localStorage.setItem('pos_store_id', res.store._id);
                setTimeout(() => {
                    onLoginSuccess(res.user);
                }, 600);
            }
        } catch (err) {
            setStoreRegError(err.message || 'Failed to register new store.');
        } finally {
            setStoreRegLoading(false);
        }
    };

    // Handle Staff Registration Submit (Request to Store Admin)
    const handleRegisterStaffSubmit = async (e) => {
        e.preventDefault();
        setRegError(null);
        setRegSuccess(null);
        setRegLoading(true);

        try {
            const res = await apiFetch('/auth/register', {
                method: 'POST',
                body: JSON.stringify({
                    storeId: selectedStoreId,
                    name: regName.trim(),
                    username: regUsername.trim(),
                    password: regPassword.trim(),
                    role: regRole,
                    counterAssigned: regCounter
                })
            });

            if (res.success) {
                setRegSuccess(res.message);
                setRegName('');
                setRegUsername('');
                setRegPassword('');
            }
        } catch (err) {
            setRegError(err.message || 'Staff registration request failed.');
        } finally {
            setRegLoading(false);
        }
    };

    return (
        <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light py-4 px-2">
            <div className="card border-0 shadow-sm" style={{ maxWidth: '580px', width: '100%', borderRadius: '16px', overflow: 'hidden' }}>
                {/* Header with Multi-Store Branding */}
                <div className="text-white p-4 text-center" style={{ background: '#0f172a', borderBottom: '2px solid #2563eb' }}>
                    <div className="d-flex justify-content-center align-items-center gap-2 mb-2">
                        <span className="fs-1">🏬</span>
                        <div className="text-start">
                            <h3 className="fw-bolder mb-0 tracking-wide">ShiftFlow POS</h3>
                            <span className="badge bg-primary text-white fw-bold text-uppercase" style={{ fontSize: '0.75rem' }}>
                                Multi-Store Supermarket &amp; Retail Cloud ERP
                            </span>
                        </div>
                    </div>
                    <p className="small text-white-50 mb-0">
                        Independent Shop Inventory, Fast Barcode Billing &amp; Cash Room Reconciliation
                    </p>
                </div>

                {/* 3 Tabs: Login / Register Store / Staff Request */}
                <div className="bg-white border-bottom">
                    <ul className="nav nav-tabs nav-fill border-0">
                        <li className="nav-item">
                            <button
                                className={`nav-link py-3 fw-bold border-0 ${activeTab === 'login' ? 'active text-primary border-bottom border-primary border-3' : 'text-muted'}`}
                                onClick={() => { setActiveTab('login'); setLoginError(null); }}
                            >
                                <i className="bi bi-box-arrow-in-right me-1"></i> Sign In
                            </button>
                        </li>
                        <li className="nav-item">
                            <button
                                className={`nav-link py-3 fw-bold border-0 ${activeTab === 'register_store' ? 'active text-primary border-bottom border-primary border-3' : 'text-muted'}`}
                                onClick={() => { setActiveTab('register_store'); setStoreRegError(null); }}
                            >
                                <i className="bi bi-shop me-1"></i> Register Shop
                            </button>
                        </li>
                        <li className="nav-item">
                            <button
                                className={`nav-link py-3 fw-bold border-0 ${activeTab === 'register_staff' ? 'active text-primary border-bottom border-primary border-3' : 'text-muted'}`}
                                onClick={() => { setActiveTab('register_staff'); setRegError(null); }}
                            >
                                <i className="bi bi-person-plus me-1"></i> Staff Join
                            </button>
                        </li>
                    </ul>
                </div>

                <div className="card-body p-4 bg-white">
                    {/* 1. SIGN IN (LOGIN) TAB */}
                    {activeTab === 'login' && (
                        <div>
                            {loginError && (
                                <div className="alert alert-danger py-2 px-3 small d-flex align-items-center gap-2 mb-3 shadow-sm">
                                    <i className="bi bi-exclamation-triangle-fill fs-5"></i>
                                    <div>{loginError}</div>
                                </div>
                            )}

                            {availableStores.length > 0 && (
                                <div className="p-2 mb-3 bg-light rounded border small d-flex align-items-center justify-content-between">
                                    <span className="text-muted">
                                        <i className="bi bi-building me-1"></i> Active Stores Online:
                                    </span>
                                    <span className="badge bg-success font-mono">
                                        {availableStores.length} Registered
                                    </span>
                                </div>
                            )}

                            <form onSubmit={handleLoginSubmit}>
                                <div className="mb-3">
                                    <label className="form-label small fw-bold text-muted text-uppercase">
                                        Username / ID <span className="text-danger">*</span>
                                    </label>
                                    <div className="input-group">
                                        <span className="input-group-text bg-light"><i className="bi bi-person"></i></span>
                                        <input
                                            type="text"
                                            className="form-control form-control-lg font-mono fw-semibold"
                                            placeholder="e.g. admin, cashier1, officer1"
                                            value={loginUsername}
                                            onChange={(e) => setLoginUsername(e.target.value)}
                                            required
                                            autoFocus
                                        />
                                    </div>
                                </div>

                                <div className="mb-3">
                                    <label className="form-label small fw-bold text-muted text-uppercase">
                                        Password <span className="text-danger">*</span>
                                    </label>
                                    <div className="input-group">
                                        <span className="input-group-text bg-light"><i className="bi bi-key"></i></span>
                                        <input
                                            type="password"
                                            className="form-control form-control-lg"
                                            placeholder="Enter password"
                                            value={loginPassword}
                                            onChange={(e) => setLoginPassword(e.target.value)}
                                            required
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    className="btn btn-primary btn-lg w-100 fw-bold py-3 shadow-sm d-flex align-items-center justify-content-center gap-2 mb-3"
                                    disabled={loginLoading}
                                >
                                    {loginLoading ? (
                                        <span className="spinner-border spinner-border-sm"></span>
                                    ) : (
                                        <>
                                            <i className="bi bi-check-circle-fill"></i>
                                            <span>Login to POS System</span>
                                        </>
                                    )}
                                </button>
                            </form>

                            {/* Demo Quick Logins */}
                            <div className="mt-4 p-3 bg-light rounded-3 border">
                                <div className="d-flex align-items-center justify-content-between mb-2">
                                    <span className="small fw-bold text-muted text-uppercase">
                                        <i className="bi bi-lightning-charge-fill text-warning me-1"></i> Quick Demo Logins:
                                    </span>
                                </div>

                                <div className="d-flex flex-column gap-2">
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-outline-dark d-flex justify-content-between align-items-center p-2 text-start"
                                        onClick={() => fillDemoCredentials('admin', 'admin123')}
                                    >
                                        <div>
                                            <span className="badge bg-dark me-2">STORE ADMIN</span>
                                            <strong className="text-dark">admin</strong> / <code>admin123</code>
                                        </div>
                                        <small className="text-muted">Manager &amp; Settings</small>
                                    </button>

                                    <button
                                        type="button"
                                        className="btn btn-sm btn-outline-success d-flex justify-content-between align-items-center p-2 text-start"
                                        onClick={() => fillDemoCredentials('cashier1', 'cashier123')}
                                    >
                                        <div>
                                            <span className="badge bg-success me-2">CASHIER</span>
                                            <strong className="text-dark">cashier1</strong> / <code>cashier123</code>
                                        </div>
                                        <small className="text-muted">Counter Billing</small>
                                    </button>

                                    <button
                                        type="button"
                                        className="btn btn-sm btn-outline-primary d-flex justify-content-between align-items-center p-2 text-start"
                                        onClick={() => fillDemoCredentials('officer1', 'officer123')}
                                    >
                                        <div>
                                            <span className="badge bg-primary me-2">CASH OFFICER</span>
                                            <strong className="text-dark">officer1</strong> / <code>officer123</code>
                                        </div>
                                        <small className="text-muted">Cash Vault &amp; Tally</small>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 2. REGISTER NEW STORE / SHOP TAB */}
                    {activeTab === 'register_store' && (
                        <div>
                            <div className="alert alert-success py-2 px-3 small mb-3">
                                <i className="bi bi-stars me-1"></i>
                                <strong>Register Your Own Shop:</strong> Each registered store receives its own <strong>completely isolated inventory, counters, shifts</strong>, and dynamic store name on all customer receipts!
                            </div>

                            {storeRegSuccess && (
                                <div className="alert alert-success py-2 px-3 small mb-3">
                                    <i className="bi bi-check-circle-fill me-1"></i> {storeRegSuccess}
                                </div>
                            )}

                            {storeRegError && (
                                <div className="alert alert-danger py-2 px-3 small mb-3">
                                    <i className="bi bi-exclamation-triangle-fill me-1"></i> {storeRegError}
                                </div>
                            )}

                            <form onSubmit={handleRegisterStoreSubmit}>
                                <div className="row g-2 mb-2">
                                    <div className="col-md-7 col-12">
                                        <label className="form-label small fw-bold text-muted text-uppercase">
                                            Store / Shop Name <span className="text-danger">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            className="form-control fw-bold"
                                            placeholder="e.g. Radhe Krishna Super Market"
                                            value={storeName}
                                            onChange={(e) => setStoreName(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="col-md-5 col-12">
                                        <label className="form-label small fw-bold text-muted text-uppercase">
                                            Shop Category
                                        </label>
                                        <select
                                            className="form-select"
                                            value={storeType}
                                            onChange={(e) => setStoreType(e.target.value)}
                                        >
                                            <option value="Supermarket & Kirana">Supermarket &amp; Kirana</option>
                                            <option value="Grocery & Departmental">Grocery &amp; Departmental</option>
                                            <option value="Wholesale & Retail">Wholesale &amp; Retail</option>
                                            <option value="Electronics & Mobile">Electronics &amp; Mobile</option>
                                            <option value="Apparel & Clothing">Apparel &amp; Clothing</option>
                                            <option value="Pharmacy & Chemist">Pharmacy &amp; Chemist</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="row g-2 mb-2">
                                    <div className="col-md-6 col-12">
                                        <label className="form-label small fw-bold text-muted text-uppercase">
                                            Owner / Manager Name <span className="text-danger">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            placeholder="e.g. Rajesh Mehta"
                                            value={ownerName}
                                            onChange={(e) => setOwnerName(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="col-md-6 col-12">
                                        <label className="form-label small fw-bold text-muted text-uppercase">
                                            Contact Phone
                                        </label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            placeholder="e.g. +91 98765 43210"
                                            value={contact}
                                            onChange={(e) => setContact(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="row g-2 mb-2">
                                    <div className="col-md-8 col-12">
                                        <label className="form-label small fw-bold text-muted text-uppercase">
                                            Store Address (Prints on Bill)
                                        </label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            placeholder="e.g. Shop 4, Main Bazaar, City"
                                            value={address}
                                            onChange={(e) => setAddress(e.target.value)}
                                        />
                                    </div>
                                    <div className="col-md-4 col-12">
                                        <label className="form-label small fw-bold text-muted text-uppercase">
                                            GSTIN Number
                                        </label>
                                        <input
                                            type="text"
                                            className="form-control font-mono"
                                            placeholder="24AAACD1234F1Z5"
                                            value={gstin}
                                            onChange={(e) => setGstin(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="mb-2">
                                    <label className="form-label small fw-bold text-muted text-uppercase">
                                        Bill Receipt Footer Message
                                    </label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        placeholder="Thank you for shopping with us! Visit again."
                                        value={receiptTagline}
                                        onChange={(e) => setReceiptTagline(e.target.value)}
                                    />
                                </div>

                                {/* Setup Shop Billing Counters */}
                                <div className="border rounded-3 p-3 bg-white mb-3 shadow-sm">
                                    <div className="d-flex justify-content-between align-items-center mb-2">
                                        <label className="form-label small fw-bold text-dark text-uppercase mb-0">
                                            <i className="bi bi-display me-1 text-success"></i>
                                            Shop Billing Counters ({storeCounters.length})
                                        </label>
                                        <small className="text-muted">Can add or remove counters anytime</small>
                                    </div>

                                    {/* Add counter input bar */}
                                    <div className="input-group input-group-sm mb-2">
                                        <input
                                            type="text"
                                            className="form-control"
                                            placeholder="e.g. Counter-04 (Quick Pay)"
                                            value={newCounterInput}
                                            onChange={(e) => setNewCounterInput(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    handleAddStoreCounter();
                                                }
                                            }}
                                        />
                                        <button
                                            type="button"
                                            className="btn btn-outline-success fw-bold px-3"
                                            onClick={handleAddStoreCounter}
                                        >
                                            <i className="bi bi-plus-circle me-1"></i> Add Counter
                                        </button>
                                    </div>

                                    {/* Pill Badges for current counters */}
                                    <div className="d-flex flex-wrap gap-2">
                                        {storeCounters.map((cnt, idx) => (
                                            <span
                                                key={idx}
                                                className="badge bg-light text-dark border d-flex align-items-center gap-2 py-2 px-2 fw-normal"
                                                style={{ fontSize: '0.82rem' }}
                                            >
                                                <i className="bi bi-pc-display text-success"></i>
                                                <span>{cnt}</span>
                                                <button
                                                    type="button"
                                                    className="btn btn-link text-danger p-0 ms-1 text-decoration-none"
                                                    title="Remove Counter"
                                                    onClick={() => handleRemoveStoreCounter(idx)}
                                                    style={{ lineHeight: 1 }}
                                                >
                                                    ✕
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                <div className="border-top pt-2 mt-3 mb-3 bg-light p-2 rounded">
                                    <span className="small fw-bold text-dark text-uppercase d-block mb-2">
                                        <i className="bi bi-shield-check text-success me-1"></i> Store Admin Credentials:
                                    </span>
                                    <div className="row g-2">
                                        <div className="col-6">
                                            <label className="form-label small text-muted mb-1">Admin Username *</label>
                                            <input
                                                type="text"
                                                className="form-control font-mono fw-bold"
                                                placeholder="e.g. radhe_admin"
                                                value={adminUsername}
                                                onChange={(e) => setAdminUsername(e.target.value)}
                                                required
                                            />
                                        </div>
                                        <div className="col-6">
                                            <label className="form-label small text-muted mb-1">Admin Password *</label>
                                            <input
                                                type="password"
                                                className="form-control"
                                                placeholder="Create password"
                                                value={adminPassword}
                                                onChange={(e) => setAdminPassword(e.target.value)}
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="form-check mb-3">
                                    <input
                                        className="form-check-input"
                                        type="checkbox"
                                        id="seedCheck"
                                        checked={seedSampleProducts}
                                        onChange={(e) => setSeedSampleProducts(e.target.checked)}
                                    />
                                    <label className="form-check-label small fw-semibold" htmlFor="seedCheck">
                                        Pre-populate with 50+ Popular Grocery Items (Instant Barcode Scan Ready)
                                    </label>
                                </div>

                                <button
                                    type="submit"
                                    className="btn btn-primary btn-lg w-100 fw-bold py-3 shadow-sm d-flex align-items-center justify-content-center gap-2"
                                    disabled={storeRegLoading}
                                >
                                    {storeRegLoading ? (
                                        <span className="spinner-border spinner-border-sm"></span>
                                    ) : (
                                        <>
                                            <i className="bi bi-rocket-takeoff-fill"></i>
                                            <span>Register Store &amp; Launch POS</span>
                                        </>
                                    )}
                                </button>
                            </form>
                        </div>
                    )}

                    {/* 3. STAFF JOIN REQUEST TAB */}
                    {activeTab === 'register_staff' && (
                        <div>
                            <div className="alert alert-info py-2 px-3 small mb-3">
                                <i className="bi bi-shield-lock-fill me-1"></i>
                                <strong>Staff Onboarding:</strong> Apply to join a specific store as a Cashier or Cash Officer. Your application will be sent to the Store Admin for approval.
                            </div>

                            {regSuccess && (
                                <div className="alert alert-success py-2 px-3 small mb-3">
                                    <i className="bi bi-check-circle-fill me-1"></i>
                                    {regSuccess}
                                    <div className="mt-1">
                                        <button
                                            className="btn btn-sm btn-link p-0 text-success fw-bold"
                                            onClick={() => setActiveTab('login')}
                                        >
                                            Go to Sign In &rarr;
                                        </button>
                                    </div>
                                </div>
                            )}

                            {regError && (
                                <div className="alert alert-danger py-2 px-3 small mb-3">
                                    <i className="bi bi-exclamation-triangle-fill me-1"></i>
                                    {regError}
                                </div>
                            )}

                            <form onSubmit={handleRegisterStaffSubmit}>
                                <div className="mb-2">
                                    <label className="form-label small fw-bold text-muted text-uppercase">
                                        Select Store / Shop <span className="text-danger">*</span>
                                    </label>
                                    <select
                                        className="form-select fw-bold"
                                        value={selectedStoreId}
                                        onChange={(e) => setSelectedStoreId(e.target.value)}
                                        required
                                    >
                                        {availableStores.map(s => (
                                            <option key={s.id} value={s.id}>
                                                🏬 {s.storeName} ({s.address || s.storeType})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="mb-2">
                                    <label className="form-label small fw-bold text-muted text-uppercase">
                                        Full Name <span className="text-danger">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        placeholder="e.g. Ramesh Patel"
                                        value={regName}
                                        onChange={(e) => setRegName(e.target.value)}
                                        required
                                    />
                                </div>

                                <div className="mb-2">
                                    <label className="form-label small fw-bold text-muted text-uppercase">
                                        Username <span className="text-danger">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        className="form-control font-mono"
                                        placeholder="e.g. ramesh_pos"
                                        value={regUsername}
                                        onChange={(e) => setRegUsername(e.target.value)}
                                        required
                                    />
                                </div>

                                <div className="mb-2">
                                    <label className="form-label small fw-bold text-muted text-uppercase">
                                        Password <span className="text-danger">*</span>
                                    </label>
                                    <input
                                        type="password"
                                        className="form-control"
                                        placeholder="Enter password"
                                        value={regPassword}
                                        onChange={(e) => setRegPassword(e.target.value)}
                                        required
                                    />
                                </div>

                                <div className="row g-2 mb-3">
                                    <div className="col-6">
                                        <label className="form-label small fw-bold text-muted text-uppercase">Role</label>
                                        <select
                                            className="form-select fw-semibold"
                                            value={regRole}
                                            onChange={(e) => setRegRole(e.target.value)}
                                        >
                                            <option value="cashier">Cashier (Billing)</option>
                                            <option value="cash_officer">Cash Officer (Tally)</option>
                                        </select>
                                    </div>

                                    <div className="col-6">
                                        <label className="form-label small fw-bold text-muted text-uppercase">Counter</label>
                                        <select
                                            className="form-select"
                                            value={regCounter}
                                            onChange={(e) => setRegCounter(e.target.value)}
                                            disabled={regRole === 'cash_officer'}
                                        >
                                            <option value="Counter-01">Counter-01</option>
                                            <option value="Counter-02">Counter-02</option>
                                            <option value="Counter-03">Counter-03</option>
                                        </select>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    className="btn btn-warning text-dark w-100 fw-bold py-2 shadow-sm d-flex align-items-center justify-content-center gap-2"
                                    disabled={regLoading}
                                >
                                    {regLoading ? (
                                        <span className="spinner-border spinner-border-sm"></span>
                                    ) : (
                                        <>
                                            <i className="bi bi-send-fill"></i>
                                            <span>Send Request to Store Admin</span>
                                        </>
                                    )}
                                </button>
                            </form>
                        </div>
                    )}
                </div>

                <div className="card-footer bg-light py-2 text-center text-muted small">
                    ShiftFlow Retail Multi-Store SaaS ERP &copy; 2026 — Secure Tenant Isolation
                </div>
            </div>
        </div>
    );
}
