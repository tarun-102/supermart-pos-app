import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../utils/api';

export default function StaffApprovalsModal({ isOpen, onClose, onStaffUpdated }) {
    const [staffList, setStaffList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionMsg, setActionMsg] = useState(null);

    useEffect(() => {
        if (isOpen) {
            loadStaff();
        }
    }, [isOpen]);

    const loadStaff = async () => {
        setLoading(true);
        try {
            const res = await apiFetch('/auth/users');
            if (res.users) {
                setStaffList(res.users);
            }
        } catch (err) {
            console.error('Failed to load staff:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (id, name) => {
        try {
            const res = await apiFetch(`/auth/approve/${id}`, { method: 'PUT' });
            setActionMsg({ type: 'success', text: res.message || `${name} approved!` });
            loadStaff();
            if (onStaffUpdated) onStaffUpdated();
        } catch (err) {
            setActionMsg({ type: 'danger', text: err.message });
        }
    };

    const handleReject = async (id, name) => {
        if (!window.confirm(`Reject registration request for "${name}"?`)) return;
        try {
            const res = await apiFetch(`/auth/reject/${id}`, { method: 'PUT' });
            setActionMsg({ type: 'warning', text: res.message || `${name} rejected.` });
            loadStaff();
            if (onStaffUpdated) onStaffUpdated();
        } catch (err) {
            setActionMsg({ type: 'danger', text: err.message });
        }
    };

    if (!isOpen) return null;

    const pendingStaff = staffList.filter(s => s.status === 'PENDING');
    const approvedStaff = staffList.filter(s => s.status !== 'PENDING');

    return (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(15, 23, 42, 0.75)', zIndex: 1060 }} tabIndex="-1">
            <div className="modal-dialog modal-dialog-centered modal-lg">
                <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '16px', overflow: 'hidden' }}>
                    {/* Header */}
                    <div className="modal-header bg-dark text-white py-3">
                        <div className="d-flex align-items-center gap-2">
                            <i className="bi bi-person-check-fill text-warning fs-5"></i>
                            <div>
                                <h6 className="modal-title fw-bold mb-0">Admin Staff Approval &amp; Management</h6>
                                <small className="text-white-50">Approve or reject new cashier and cash officer registration requests</small>
                            </div>
                        </div>
                        <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
                    </div>

                    <div className="modal-body p-3 bg-light" style={{ maxHeight: '72vh', overflowY: 'auto' }}>
                        {actionMsg && (
                            <div className={`alert alert-${actionMsg.type} py-2 px-3 small d-flex justify-content-between align-items-center mb-3 shadow-sm`}>
                                <span>{actionMsg.text}</span>
                                <button type="button" className="btn-close btn-close-sm" onClick={() => setActionMsg(null)}></button>
                            </div>
                        )}

                        {/* SECTION 1: PENDING REQUESTS (Highlighted) */}
                        <div className="mb-4">
                            <div className="d-flex align-items-center justify-content-between mb-2">
                                <h6 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2">
                                    <span className="badge bg-warning text-dark fs-6 px-2 py-1">
                                        {pendingStaff.length}
                                    </span>
                                    <span>Pending Registration Requests (Awaiting Admin Approval)</span>
                                </h6>
                            </div>

                            {pendingStaff.length === 0 ? (
                                <div className="card border-0 p-3 bg-white text-center text-muted small shadow-sm rounded-3">
                                    <i className="bi bi-check2-all text-success fs-3"></i>
                                    <div className="fw-semibold mt-1">No pending registration requests. All requests have been processed.</div>
                                </div>
                            ) : (
                                <div className="d-flex flex-column gap-2">
                                    {pendingStaff.map(user => (
                                        <div key={user.id} className="card border-0 shadow-sm p-3 bg-white rounded-3 border-start border-warning border-4">
                                            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                                                <div>
                                                    <div className="d-flex align-items-center gap-2">
                                                        <strong className="fs-6 text-dark">{user.name}</strong>
                                                        <span className={`badge ${user.role === 'cash_officer' ? 'bg-primary' : 'bg-success'} text-uppercase`} style={{ fontSize: '0.65rem' }}>
                                                            {user.role === 'cash_officer' ? 'Cash Officer' : 'Cashier'}
                                                        </span>
                                                        <span className="badge bg-warning-subtle text-warning-emphasis border small">
                                                            Pending Approval
                                                        </span>
                                                    </div>
                                                    <div className="small text-muted mt-1">
                                                        Username: <code className="fw-bold text-dark">{user.username}</code> | Assigned: {user.counterAssigned || 'Counter-01'}
                                                    </div>
                                                </div>

                                                <div className="d-flex gap-2">
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-outline-danger fw-semibold"
                                                        onClick={() => handleReject(user.id, user.name)}
                                                    >
                                                        <i className="bi bi-x-circle me-1"></i> Reject
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-success fw-bold shadow-sm px-3"
                                                        onClick={() => handleApprove(user.id, user.name)}
                                                    >
                                                        <i className="bi bi-check-circle-fill me-1"></i> Approve Staff
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* SECTION 2: APPROVED / ACTIVE STAFF */}
                        <div>
                            <h6 className="fw-bold text-muted small text-uppercase mb-2">
                                Active &amp; Existing Staff ({approvedStaff.length})
                            </h6>
                            <div className="table-responsive bg-white rounded-3 shadow-sm border">
                                <table className="table table-hover align-middle mb-0 small">
                                    <thead className="table-light">
                                        <tr>
                                            <th>Staff Name</th>
                                            <th>Username</th>
                                            <th>Role</th>
                                            <th>Counter / Dept</th>
                                            <th className="text-center">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {approvedStaff.map(user => (
                                            <tr key={user.id}>
                                                <td className="fw-bold text-dark">{user.name}</td>
                                                <td><code>{user.username}</code></td>
                                                <td>
                                                    <span className={`badge ${user.role === 'admin' ? 'bg-dark' : user.role === 'cash_officer' ? 'bg-primary' : 'bg-success'} text-uppercase`} style={{ fontSize: '0.65rem' }}>
                                                        {user.role}
                                                    </span>
                                                </td>
                                                <td className="text-muted">{user.counterAssigned || '-'}</td>
                                                <td className="text-center">
                                                    {user.status === 'APPROVED' ? (
                                                        <span className="badge bg-success-subtle text-success border border-success-subtle">
                                                            <i className="bi bi-check-circle-fill me-1"></i> Active
                                                        </span>
                                                    ) : (
                                                        <span className="badge bg-danger-subtle text-danger border border-danger-subtle">
                                                            Rejected
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <div className="modal-footer bg-white border-top p-2">
                        <button type="button" className="btn btn-secondary btn-sm px-3" onClick={onClose}>
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

