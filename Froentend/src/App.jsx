import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import PosBilling from './components/POS/PosBilling';
import InventoryManager from './components/Inventory/InventoryManager';
import CashOfficerTally from './components/CashOfficer/CashOfficerTally';
import BillsHistory from './components/Reports/BillsHistory';
import ShiftDrawerModal from './components/Shift/ShiftDrawerModal';
import LoginPage from './components/Auth/LoginPage';
import StaffApprovalsModal from './components/Admin/StaffApprovalsModal';
import StoreSettingsModal from './components/Admin/StoreSettingsModal';
import { apiFetch } from './utils/api';

export default function App() {
  // Check persisted user from localStorage
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('pos_user');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  const [activeTab, setActiveTab] = useState('pos'); // 'pos', 'inventory', 'cash_officer', 'bills'
  const [activeShift, setActiveShift] = useState(null);
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [isStaffApprovalsOpen, setIsStaffApprovalsOpen] = useState(false);
  const [isStoreSettingsOpen, setIsStoreSettingsOpen] = useState(false);
  const [storeConfig, setStoreConfig] = useState(null);
  const [pendingStaffCount, setPendingStaffCount] = useState(0);
  const [heldCount, setHeldCount] = useState(0);

  // Synchronize on user state change
  useEffect(() => {
    fetchStoreConfig();
    if (currentUser) {
      // Set appropriate initial tab by role
      if (currentUser.role === 'cash_officer') {
        setActiveTab('cash_officer');
      } else {
        setActiveTab('pos');
      }
      checkActiveShift();
      fetchHeldCount();
      if (currentUser.role === 'admin') {
        fetchPendingStaffCount();
      }
    }
  }, [currentUser]);

  const fetchStoreConfig = async () => {
    try {
      const storeId = currentUser?.storeId || localStorage.getItem('pos_store_id') || '';
      const res = await apiFetch(`/store/config${storeId ? `?storeId=${storeId}` : ''}`);
      if (res.config) {
        setStoreConfig(res.config);
      }
    } catch (e) {
      console.warn('Could not load store config:', e);
    }
  };

  const checkActiveShift = async () => {
    if (!currentUser) return;
    try {
      const res = await apiFetch(`/shifts/active/${currentUser.id}`);
      if (res.hasActiveShift && res.shift) {
        setActiveShift(res.shift);
      } else {
        setActiveShift(null);
      }
    } catch (err) {
      console.warn('Could not fetch active shift:', err.message);
    }
  };

  const fetchHeldCount = async () => {
    try {
      const res = await apiFetch('/billing/held-bills');
      if (res.heldBills) {
        setHeldCount(res.heldBills.length);
      }
    } catch (err) {}
  };

  const fetchPendingStaffCount = async () => {
    try {
      const res = await apiFetch('/auth/pending');
      if (res.requests) {
        setPendingStaffCount(res.requests.length);
      }
    } catch (err) {}
  };

  // Login handler
  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    if (user?.storeId) {
      localStorage.setItem('pos_store_id', user.storeId);
    }
    if (user.role === 'cash_officer') {
      setActiveTab('cash_officer');
    } else {
      setActiveTab('pos');
    }
  };

  // Logout handler
  const handleLogout = () => {
    localStorage.removeItem('pos_token');
    localStorage.removeItem('pos_user');
    localStorage.removeItem('pos_store_id');
    setCurrentUser(null);
    setActiveShift(null);
  };

  // IF NOT LOGGED IN: SHOW MANDATORY LOGIN PAGE
  if (!currentUser) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  const currentCounter = activeShift?.counterNo || currentUser.counterAssigned || 'Counter-01';

  return (
    <div className="min-vh-100 d-flex flex-column bg-light">
      {/* Universal Store Navigation Bar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentUser={currentUser}
        activeShift={activeShift}
        onOpenShiftModal={() => setIsShiftModalOpen(true)}
        onOpenStaffApprovals={() => setIsStaffApprovalsOpen(true)}
        onOpenStoreSettings={() => setIsStoreSettingsOpen(true)}
        storeConfig={storeConfig}
        pendingStaffCount={pendingStaffCount}
        heldCount={heldCount}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <main className="flex-grow-1">
        {activeTab === 'pos' && (
          <PosBilling
            currentUser={currentUser}
            activeShift={activeShift}
            refreshShifts={checkActiveShift}
            onOpenShiftModal={() => setIsShiftModalOpen(true)}
            storeConfig={storeConfig}
          />
        )}

        {activeTab === 'inventory' && currentUser?.role === 'admin' && (
          <InventoryManager />
        )}

        {activeTab === 'cash_officer' && (
          <CashOfficerTally
            currentUser={currentUser}
          />
        )}

        {activeTab === 'bills' && (
          <BillsHistory
            currentUser={currentUser}
            activeShift={activeShift}
            onOpenShiftModal={() => setIsShiftModalOpen(true)}
            storeConfig={storeConfig}
          />
        )}
      </main>

      {/* Quick POS Shortcut Ribbon at bottom */}
      <footer className="bg-white border-top py-2 px-3 no-print">
        <div className="container-fluid d-flex flex-wrap justify-content-between align-items-center gap-2 small text-muted">
          <div className="d-flex align-items-center gap-3">
            <span className="fw-bold text-success">
              <i className="bi bi-shop me-1"></i> {storeConfig?.storeName || 'SuperStore POS'}
            </span>
            <span className="d-none d-md-inline">|</span>
            <span className="d-none d-md-inline">
              Counter: <strong className="text-dark">{currentCounter}</strong>
            </span>
            <span className="d-none d-md-inline">|</span>
            <span>
              Logged in as: <strong className="text-dark">{currentUser.name}</strong> ({currentUser.role})
            </span>
          </div>

          <div className="d-flex align-items-center gap-3 flex-wrap">
            <span><kbd>F2</kbd> Focus Barcode</span>
            <span><kbd>F4</kbd> Checkout / Split Pay</span>
            <span><kbd>F7</kbd> Hold Bill</span>
            <span><kbd>Ctrl+P</kbd> Print Receipt</span>
          </div>
        </div>
      </footer>

      {/* Register Shift & Cash Tally Handover Modal */}
      <ShiftDrawerModal
        isOpen={isShiftModalOpen}
        onClose={() => setIsShiftModalOpen(false)}
        currentUser={currentUser}
        activeShift={activeShift}
        onShiftUpdated={checkActiveShift}
      />

      {/* Admin Staff Approvals Modal */}
      {currentUser.role === 'admin' && (
        <StaffApprovalsModal
          isOpen={isStaffApprovalsOpen}
          onClose={() => setIsStaffApprovalsOpen(false)}
          onStaffUpdated={() => {
            fetchPendingStaffCount();
          }}
        />
      )}

      {/* Store Settings & Counters Modal (Store Owner / Admin) */}
      {currentUser.role === 'admin' && (
        <StoreSettingsModal
          isOpen={isStoreSettingsOpen}
          onClose={() => setIsStoreSettingsOpen(false)}
          onStoreUpdated={(newConfig) => {
            setStoreConfig(newConfig);
          }}
        />
      )}
    </div>
  );
}