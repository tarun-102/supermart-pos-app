import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../utils/api';
import { useConfirm } from '../../context/ConfirmContext';
import { toast } from 'react-toastify';

export default function StoreSettingsModal({ isOpen, onClose, onStoreUpdated }) {
    const confirm = useConfirm();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [newCounterInput, setNewCounterInput] = useState('');
    const [formData, setFormData] = useState({
        storeName: 'Smart Retail & SuperMarket',
        storeType: 'Supermarket & Kirana Store',
        ownerName: 'Rajesh Mehta',
        address: 'Shop No. 12, Main Bazaar, City Center',
        contact: '+91 98765 43210',
        gstin: '24AAACD1234F1Z5',
        receiptTagline: 'Thank you for shopping with us! Visit again.',
        counters: []
    });

    useEffect(() => {
        if (isOpen) {
            loadStoreConfig();
        }
    }, [isOpen]);

    const loadStoreConfig = async () => {
        setLoading(true);
        try {
            const res = await apiFetch('/store/config');
            if (res.config) {
                setFormData({
                    storeName: res.config.storeName || '',
                    storeType: res.config.storeType || '',
                    ownerName: res.config.ownerName || '',
                    address: res.config.address || '',
                    contact: res.config.contact || '',
                    gstin: res.config.gstin || '',
                    receiptTagline: res.config.receiptTagline || '',
                    counters: res.config.counters || []
                });
            }
        } catch (err) {
            console.error('Failed to load store configuration:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await apiFetch('/store/config', {
                method: 'PUT',
                body: JSON.stringify(formData)
            });
            if (res.success) {
                toast.success('Shop configuration and counters saved successfully!');
                if (onStoreUpdated) onStoreUpdated(res.config);
                onClose();
            }
        } catch (err) {
            toast.error('Failed to save store configuration: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleAddCounter = () => {
        if (!newCounterInput.trim()) return;
        const trimmed = newCounterInput.trim();
        if (formData.counters.includes(trimmed)) {
            toast.warning('This counter already exists!');
            return;
        }
        setFormData({
            ...formData,
            counters: [...formData.counters, trimmed]
        });
        setNewCounterInput('');
        toast.success(`Counter "${trimmed}" added.`);
    };

    const handleDeleteCounter = async (counterName) => {
        const isOk = await confirm({
            title: 'Delete Counter Desk',
            message: `Are you sure you want to delete "${counterName}" from your shop's counter list?`,
            confirmText: 'Delete Counter',
            confirmVariant: 'danger',
            icon: 'bi-display'
        });
        if (!isOk) return;

        setFormData({
            ...formData,
            counters: formData.counters.filter(c => c !== counterName)
        });
        toast.info(`Counter "${counterName}" removed.`);
    };

    if (!isOpen) return null;

    return (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(15, 23, 42, 0.85)', zIndex: 1065 }} tabIndex="-1">
            <div className="modal-dialog modal-dialog-centered modal-lg">
                <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '16px', overflow: 'hidden' }}>
                    {/* Header */}
                    <div className="modal-header bg-dark text-white py-3 px-4">
                        <div className="d-flex align-items-center gap-2">
                            <i className="bi bi-shop fs-4 text-warning"></i>
                            <div>
                                <h5 className="modal-title fw-bold mb-0">Shop Profile &amp; Counter Register Setup</h5>
                                <small className="text-white-50">Configure your store name, details, and billing desks</small>
                            </div>
                        </div>
                        <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
                    </div>

                    <form onSubmit={handleSave}>
                        <div className="modal-body p-4 bg-light" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
                            {loading ? (
                                <div className="text-center py-5">
                                    <div className="spinner-border text-success"></div>
                                    <div className="text-muted mt-2">Loading store settings...</div>
                                </div>
                            ) : (
                                <div className="row g-3">
                                    {/* Store Details Card */}
                                    <div className="col-12">
                                        <div className="bg-white p-3 rounded-3 border shadow-sm">
                                            <h6 className="fw-bold text-dark border-bottom pb-2 mb-3">
                                                <i className="bi bi-building me-1 text-primary"></i>
                                                Shop Information (Prints on All Bills)
                                            </h6>
                                            <div className="row g-2">
                                                <div className="col-md-6 col-12">
                                                    <label className="form-label small fw-bold text-muted text-uppercase mb-1">
                                                        Shop / Store Name:
                                                    </label>
                                                    <input
                                                        type="text"
                                                        className="form-control form-control-sm fw-bold"
                                                        placeholder="e.g. Shree Krishna Supermarket"
                                                        value={formData.storeName}
                                                        onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
                                                        required
                                                    />
                                                </div>

                                                <div className="col-md-6 col-12">
                                                    <label className="form-label small fw-bold text-muted text-uppercase mb-1">
                                                        Store Type / Category:
                                                    </label>
                                                    <input
                                                        type="text"
                                                        className="form-control form-control-sm"
                                                        placeholder="e.g. Kirana Store, Supermarket, Retail"
                                                        value={formData.storeType}
                                                        onChange={(e) => setFormData({ ...formData, storeType: e.target.value })}
                                                    />
                                                </div>

                                                <div className="col-md-6 col-12">
                                                    <label className="form-label small fw-bold text-muted text-uppercase mb-1">
                                                        Shop Address:
                                                    </label>
                                                    <input
                                                        type="text"
                                                        className="form-control form-control-sm"
                                                        placeholder="e.g. Shop 4-5, Near Station Road"
                                                        value={formData.address}
                                                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                                    />
                                                </div>

                                                <div className="col-md-6 col-12">
                                                    <label className="form-label small fw-bold text-muted text-uppercase mb-1">
                                                        Contact Phone / Mobile:
                                                    </label>
                                                    <input
                                                        type="text"
                                                        className="form-control form-control-sm"
                                                        placeholder="e.g. +91 98765 43210"
                                                        value={formData.contact}
                                                        onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                                                    />
                                                </div>

                                                <div className="col-md-6 col-12">
                                                    <label className="form-label small fw-bold text-muted text-uppercase mb-1">
                                                        GSTIN / Tax No:
                                                    </label>
                                                    <input
                                                        type="text"
                                                        className="form-control form-control-sm font-mono"
                                                        placeholder="e.g. 24AAACD1234F1Z5"
                                                        value={formData.gstin}
                                                        onChange={(e) => setFormData({ ...formData, gstin: e.target.value })}
                                                    />
                                                </div>

                                                <div className="col-md-6 col-12">
                                                    <label className="form-label small fw-bold text-muted text-uppercase mb-1">
                                                        Bill Receipt Tagline:
                                                    </label>
                                                    <input
                                                        type="text"
                                                        className="form-control form-control-sm"
                                                        placeholder="e.g. Thank you for shopping with us! Visit again."
                                                        value={formData.receiptTagline}
                                                        onChange={(e) => setFormData({ ...formData, receiptTagline: e.target.value })}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Store Billing Counters Management */}
                                    <div className="col-12">
                                        <div className="bg-white p-3 rounded-3 border shadow-sm">
                                            <div className="d-flex justify-content-between align-items-center border-bottom pb-2 mb-3">
                                                <h6 className="fw-bold text-dark mb-0">
                                                    <i className="bi bi-display me-1 text-success"></i>
                                                    Billing Counters (Available Desks in Your Shop)
                                                </h6>
                                                <span className="badge bg-success-subtle text-success">
                                                    {formData.counters.length} Active Counters
                                                </span>
                                            </div>

                                            {/* Add New Counter Input */}
                                            <div className="input-group input-group-sm mb-3">
                                                <input
                                                    type="text"
                                                    className="form-control"
                                                    placeholder="Enter new counter name (e.g. Counter-05, Express Grocery)"
                                                    value={newCounterInput}
                                                    onChange={(e) => setNewCounterInput(e.target.value)}
                                                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCounter(); } }}
                                                />
                                                <button
                                                    type="button"
                                                    className="btn btn-success fw-bold px-3"
                                                    onClick={handleAddCounter}
                                                >
                                                    <i className="bi bi-plus-circle me-1"></i> Add Counter
                                                </button>
                                            </div>

                                            {/* Counters List */}
                                            <div className="list-group list-group-flush border rounded-2 overflow-hidden">
                                                {formData.counters.map((c, idx) => (
                                                    <div key={idx} className="list-group-item d-flex justify-content-between align-items-center py-2 px-3">
                                                        <div className="d-flex align-items-center gap-2">
                                                            <span className="badge bg-light text-dark border font-mono">
                                                                #{idx + 1}
                                                            </span>
                                                            <strong className="text-dark">{c}</strong>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            className="btn btn-outline-danger btn-sm py-0 px-2"
                                                            style={{ fontSize: '0.72rem' }}
                                                            onClick={() => handleDeleteCounter(c)}
                                                            title="Delete this counter"
                                                        >
                                                            <i className="bi bi-trash"></i> Delete
                                                        </button>
                                                    </div>
                                                ))}

                                                {formData.counters.length === 0 && (
                                                    <div className="text-center py-3 text-muted small">
                                                        No counters added yet. Please add at least one counter.
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="modal-footer bg-white border-top p-3 d-flex justify-content-between">
                            <button type="button" className="btn btn-outline-secondary" onClick={onClose}>
                                Cancel
                            </button>
                            <button type="submit" className="btn btn-success fw-bold px-4 shadow" disabled={saving}>
                                {saving ? (
                                    <>
                                        <span className="spinner-border spinner-border-sm me-2"></span>
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <i className="bi bi-check-circle-fill me-1"></i> Save Store &amp; Counters
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}

