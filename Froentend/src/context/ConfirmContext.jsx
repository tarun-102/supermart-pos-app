import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import ConfirmModal from '../components/Common/ConfirmModal';

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
    const [confirmState, setConfirmState] = useState({
        isOpen: false,
        title: '',
        message: '',
        confirmText: 'Confirm',
        cancelText: 'Cancel',
        confirmVariant: 'primary',
        icon: 'bi-question-circle-fill'
    });

    const resolverRef = useRef(null);

    const confirm = useCallback((options) => {
        return new Promise((resolve) => {
            resolverRef.current = resolve;
            setConfirmState({
                isOpen: true,
                title: options.title || 'Please Confirm',
                message: options.message || 'Are you sure you want to proceed?',
                confirmText: options.confirmText || 'Confirm',
                cancelText: options.cancelText || 'Cancel',
                confirmVariant: options.confirmVariant || 'primary',
                icon: options.icon || 'bi-question-circle-fill'
            });
        });
    }, []);

    const handleConfirm = () => {
        setConfirmState(prev => ({ ...prev, isOpen: false }));
        if (resolverRef.current) {
            resolverRef.current(true);
            resolverRef.current = null;
        }
    };

    const handleCancel = () => {
        setConfirmState(prev => ({ ...prev, isOpen: false }));
        if (resolverRef.current) {
            resolverRef.current(false);
            resolverRef.current = null;
        }
    };

    return (
        <ConfirmContext.Provider value={{ confirm }}>
            {children}
            <ConfirmModal
                isOpen={confirmState.isOpen}
                title={confirmState.title}
                message={confirmState.message}
                confirmText={confirmState.confirmText}
                cancelText={confirmState.cancelText}
                confirmVariant={confirmState.confirmVariant}
                icon={confirmState.icon}
                onConfirm={handleConfirm}
                onCancel={handleCancel}
            />
        </ConfirmContext.Provider>
    );
}

export function useConfirm() {
    const context = useContext(ConfirmContext);
    if (!context) {
        throw new Error('useConfirm must be used within a ConfirmProvider');
    }
    return context.confirm;
}

