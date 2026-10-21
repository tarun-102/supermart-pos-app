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
            iconBg: '#fee2e2',
            iconColor: '#ef4444'
        },
        warning: {
            btn: 'btn-warning text-dark',
            iconBg: '#fef3c7',
            iconColor: '#f59e0b'
        },
        primary: {
            btn: 'btn-primary',
            iconBg: '#e0e7ff',
            iconColor: '#4f46e5'
        },
        success: {
            btn: 'btn-success',
            iconBg: '#dcfce7',
            iconColor: '#10b981'
        }
    };

    const currentStyle = variantColors[confirmVariant] || variantColors.primary;

    return (
        <div
            className="modal show d-block"
            style={{
                backgroundColor: 'rgba(15, 23, 42, 0.7)',
                backdropFilter: 'blur(6px)',
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
                    className="modal-content border-0 shadow-lg"
                    style={{
                        borderRadius: '20px',
                        overflow: 'hidden',
                        background: '#ffffff'
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

