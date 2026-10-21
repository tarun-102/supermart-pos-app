import React from 'react';

export default function ConfirmModal({
    isOpen,
    title = 'Please Confirm',
    message = 'Are you sure you want to proceed?',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    confirmVariant = 'primary',
    icon = 'bi-question-circle-fill',
    onConfirm,
    onCancel
}) {
    if (!isOpen) return null;

    const variantColors = {
        danger: {
            btn: 'btn-danger',
            iconBg: 'rgba(244, 63, 94, 0.18)',
            iconColor: '#fb7185'
        },
        warning: {
            btn: 'btn-warning text-dark',
            iconBg: 'rgba(245, 158, 11, 0.18)',
            iconColor: '#fbbf24'
        },
        primary: {
            btn: 'btn-primary',
            iconBg: 'rgba(56, 189, 248, 0.18)',
            iconColor: '#38bdf8'
        },
        success: {
            btn: 'btn-success',
            iconBg: 'rgba(16, 185, 129, 0.18)',
            iconColor: '#34d399'
        }
    };

    const currentStyle = variantColors[confirmVariant] || variantColors.primary;

    return (
        <div
            className="modal show d-block"
            style={{
                backgroundColor: 'rgba(0, 0, 0, 0.75)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                zIndex: 1080
            }}
            tabIndex="-1"
            onClick={onCancel}
        >
            <div
                className="modal-dialog modal-dialog-centered"
                style={{ maxWidth: '440px', margin: 'auto' }}
                onClick={(e) => e.stopPropagation()}
            >
                <div
                    className="modal-content shadow-lg"
                    style={{
                        borderRadius: '20px',
                        overflow: 'hidden',
                        background: 'rgba(15, 23, 42, 0.94)',
                        backdropFilter: 'blur(24px)',
                        WebkitBackdropFilter: 'blur(24px)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                    }}
                >
                    <div className="p-4 text-center">
                        {/* Modern Floating Icon */}
                        <div
                            className="mx-auto mb-3 d-flex align-items-center justify-content-center rounded-circle"
                            style={{
                                width: '64px',
                                height: '64px',
                                backgroundColor: currentStyle.iconBg,
                                color: currentStyle.iconColor
                            }}
                        >
                            <i className={`bi ${icon} fs-2`}></i>
                        </div>

                        {/* Title & Message */}
                        <h5 className="fw-bolder text-dark mb-2" style={{ letterSpacing: '-0.3px' }}>
                            {title}
                        </h5>
                        <p className="text-muted small mb-4 px-2" style={{ lineHeight: '1.5' }}>
                            {message}
                        </p>

                        {/* Action Buttons */}
                        <div className="d-flex gap-2">
                            <button
                                type="button"
                                className="btn btn-light border fw-semibold flex-grow-1 py-2 rounded-3"
                                onClick={onCancel}
                            >
                                {cancelText}
                            </button>
                            <button
                                type="button"
                                className={`btn ${currentStyle.btn} fw-bold flex-grow-1 py-2 rounded-3 shadow-sm`}
                                onClick={onConfirm}
                                autoFocus
                            >
                                {confirmText}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

