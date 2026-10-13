import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { playBarcodeBeep } from '../../utils/audio';

export default function CameraScannerModal({ isOpen, onClose, onDetected }) {
    const [scannerError, setScannerError] = useState(null);
    const [manualCode, setManualCode] = useState('');
    const [isScanning, setIsScanning] = useState(false);
    const [cameras, setCameras] = useState([]);
    const [selectedCameraId, setSelectedCameraId] = useState('');
    const [isProcessingSnap, setIsProcessingSnap] = useState(false);

    const html5QrCodeRef = useRef(null);
    const isMountedRef = useRef(true);
    const fileInputRef = useRef(null);

    const isMobileDevice = typeof navigator !== 'undefined' &&
        (/android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(navigator.userAgent || ''));

    useEffect(() => {
        isMountedRef.current = true;
        if (!isOpen) {
            stopCamera();
            return;
        }

        startCamera();

        return () => {
            isMountedRef.current = false;
            stopCamera();
        };
    }, [isOpen]);

    const startCamera = async (specificCameraId = null) => {
        stopCamera();
        setScannerError(null);
        setIsScanning(true);

        const container = document.getElementById("camera-scanner-viewfinder");
        if (container) {
            container.innerHTML = '';
        }

        if (!navigator?.mediaDevices?.getUserMedia) {
            setScannerError('mediaDevices_unavailable');
            setIsScanning(false);
            return;
        }

        try {
            const html5QrCode = new Html5Qrcode("camera-scanner-viewfinder", {
                formatsToSupport: [
                    Html5QrcodeSupportedFormats.EAN_13,
                    Html5QrcodeSupportedFormats.EAN_8,
                    Html5QrcodeSupportedFormats.CODE_128,
                    Html5QrcodeSupportedFormats.CODE_39,
                    Html5QrcodeSupportedFormats.CODE_93,
                    Html5QrcodeSupportedFormats.UPC_A,
                    Html5QrcodeSupportedFormats.UPC_E,
                    Html5QrcodeSupportedFormats.ITF,
                    Html5QrcodeSupportedFormats.QR_CODE
                ],
                experimentalFeatures: {
                    useBarCodeDetectorIfSupported: false
                },
                verbose: false
            });

            html5QrCodeRef.current = html5QrCode;

            const onScanSuccess = (decodedText) => {
                playBarcodeBeep();
                if (navigator.vibrate) navigator.vibrate(100);
                onDetected(decodedText.trim());
            };

            const onScanFailure = () => {};

            const cameraTarget = specificCameraId ? specificCameraId : { facingMode: 'environment' };

            const config = {
                fps: 12,
                qrbox: (viewfinderWidth, viewfinderHeight) => ({
                    width: Math.max(220, Math.floor(viewfinderWidth * 0.88)),
                    height: Math.max(120, Math.floor(viewfinderHeight * 0.80))
                }),
                videoConstraints: {
                    facingMode: { ideal: 'environment' },
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            };

            try {
                await html5QrCode.start(cameraTarget, config, onScanSuccess, onScanFailure);
            } catch (err1) {
                console.warn('Modal standard start failed, trying minimal...', err1);
                await html5QrCode.start(cameraTarget, { fps: 10, videoConstraints: { facingMode: 'environment' } }, onScanSuccess, onScanFailure);
            }

            if (!isMountedRef.current) return;
            setIsScanning(false);

            try {
                const videoElem = document.querySelector('#camera-scanner-viewfinder video');
                if (videoElem) {
                    videoElem.setAttribute('playsinline', 'true');
                    videoElem.setAttribute('webkit-playsinline', 'true');
                    videoElem.setAttribute('muted', 'true');
                    videoElem.setAttribute('autoplay', 'true');
                    videoElem.muted = true;
                    const p = videoElem.play();
                    if (p !== undefined) p.catch(() => {});
                }
            } catch (e) {}

            try {
                const devices = await Html5Qrcode.getCameras();
                if (devices && devices.length > 0 && isMountedRef.current) {
                    setCameras(devices);
                    if (!specificCameraId) {
                        const backCam = devices.find(d =>
                            d.label.toLowerCase().includes('back') ||
                            d.label.toLowerCase().includes('rear') ||
                            d.label.toLowerCase().includes('environment')
                        );
                        setSelectedCameraId(backCam ? backCam.id : devices[0].id);
                    } else {
                        setSelectedCameraId(specificCameraId);
                    }
                }
            } catch (e) {}

        } catch (fatalErr) {
            console.error('Modal camera fatal error:', fatalErr);
            if (!isMountedRef.current) return;
            setScannerError('stream_blocked');
            setIsScanning(false);
        }
    };

    const stopCamera = () => {
        if (html5QrCodeRef.current) {
            try {
                if (html5QrCodeRef.current.isScanning) {
                    html5QrCodeRef.current.stop().then(() => {
                        try { html5QrCodeRef.current?.clear(); } catch (e) {}
                    }).catch(() => {});
                } else {
                    try { html5QrCodeRef.current?.clear(); } catch (e) {}
                }
            } catch (e) {}
            html5QrCodeRef.current = null;
        }
        try {
            const container = document.getElementById("camera-scanner-viewfinder");
            if (container) {
                const videos = container.querySelectorAll('video');
                videos.forEach(v => {
                    if (v.srcObject) {
                        v.srcObject.getTracks().forEach(t => t.stop());
                        v.srcObject = null;
                    }
                });
                container.innerHTML = '';
            }
        } catch (e) {}
        setIsScanning(false);
    };

    const handleCameraSwitch = (e) => {
        const camId = e.target.value;
        setSelectedCameraId(camId);
        startCamera(camId);
    };

    const handleManualSubmit = (e) => {
        e.preventDefault();
        if (!manualCode.trim()) return;
        playBarcodeBeep();
        onDetected(manualCode.trim());
        setManualCode('');
    };

    const handleSnapPhoto = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsProcessingSnap(true);
        try {
            let snapScanner = html5QrCodeRef.current;
            if (!snapScanner) {
                snapScanner = new Html5Qrcode("camera-scanner-viewfinder", { verbose: false });
            }

            const decodedText = await snapScanner.scanFile(file, true);
            if (decodedText) {
                playBarcodeBeep();
                if (navigator.vibrate) navigator.vibrate(100);
                onDetected(decodedText.trim());
                onClose();
            }
        } catch (err) {
            alert('Could not decode barcode from photo. Please keep barcode clear and steady.');
        } finally {
            setIsProcessingSnap(false);
            e.target.value = '';
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(15, 23, 42, 0.85)', zIndex: 1060 }} tabIndex="-1">
            <input
                type="file"
                accept="image/*"
                capture="environment"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handleSnapPhoto}
            />

            <div className="modal-dialog modal-dialog-centered">
                <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '16px', overflow: 'hidden' }}>
                    {/* Header */}
                    <div className="modal-header bg-success text-white py-2 px-3">
                        <div className="d-flex align-items-center gap-2">
                            <i className="bi bi-camera-fill fs-5"></i>
                            <div>
                                <h6 className="modal-title fw-bold mb-0">Live Camera Barcode Scanner</h6>
                                <small className="text-white-50" style={{ fontSize: '0.72rem' }}>Scan barcodes directly using device camera</small>
                            </div>
                        </div>
                        <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
                    </div>

                    <div className="modal-body p-3 bg-light text-center">
                        {/* Camera Switcher Dropdown */}
                        {cameras.length > 1 && (
                            <div className="mb-2">
                                <select
                                    className="form-select form-select-sm"
                                    value={selectedCameraId}
                                    onChange={handleCameraSwitch}
                                >
                                    {cameras.map((c, i) => (
                                        <option key={c.id} value={c.id}>
                                            📷 {c.label || `Camera ${i + 1}`}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Viewfinder Video Frame Container - Compact 160px */}
                        <div
                            className="scanner-viewport-box shadow-sm mx-auto position-relative"
                            style={{ width: '100%', height: '160px', maxHeight: '160px' }}
                        >
                            <div
                                id="camera-scanner-viewfinder"
                                style={{ width: '100%', height: '160px', overflow: 'hidden' }}
                            ></div>

                            {/* Active laser line */}
                            {!isScanning && !scannerError && (
                                <div className="scanner-laser-line"></div>
                            )}

                            {isProcessingSnap && (
                                <div className="position-absolute top-0 start-0 w-100 h-100 bg-dark bg-opacity-75 d-flex flex-column justify-content-center align-items-center text-white" style={{ zIndex: 25 }}>
                                    <div className="spinner-border spinner-border-sm text-warning mb-1" role="status"></div>
                                    <span className="small fw-bold">Reading barcode photo...</span>
                                </div>
                            )}

                            {/* Error Fallback with Snap Button */}
                            {scannerError && (
                                <div className="position-absolute top-0 start-0 w-100 h-100 bg-dark p-2 text-center text-white d-flex flex-column justify-content-center align-items-center" style={{ zIndex: 20 }}>
                                    <i className="bi bi-camera text-warning fs-3 mb-1"></i>
                                    <h6 className="fw-bold text-white mb-1" style={{ fontSize: '0.85rem' }}>
                                        {isMobileDevice ? 'Mobile Camera Ready' : 'Camera Feed Blocked'}
                                    </h6>
                                    <p className="small text-light mb-2 px-1" style={{ fontSize: '0.72rem' }}>
                                        Snap photo directly with your phone's camera:
                                    </p>
                                    <button
                                        type="button"
                                        className="btn btn-success btn-sm fw-bold px-3 py-1 shadow"
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        <i className="bi bi-camera-fill me-1"></i> Snap Barcode Photo
                                    </button>
                                </div>
                            )}

                            {/* Loading state indicator */}
                            {isScanning && !scannerError && (
                                <div className="position-absolute top-0 start-0 w-100 h-100 bg-dark bg-opacity-75 d-flex flex-column justify-content-center align-items-center text-white" style={{ zIndex: 15 }}>
                                    <div className="spinner-border spinner-border-sm text-success mb-2" role="status"></div>
                                    <span className="small fw-semibold">Connecting camera...</span>
                                </div>
                            )}
                        </div>

                        {/* Mobile Snap Button Option */}
                        <div className="d-flex justify-content-between align-items-center mt-2 px-1">
                            <span className="text-muted small" style={{ fontSize: '0.75rem' }}>
                                Center barcode in lens
                            </span>
                            <button
                                type="button"
                                className="btn btn-outline-success btn-sm fw-bold px-2 py-0 d-flex align-items-center gap-1"
                                style={{ fontSize: '0.72rem' }}
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <i className="bi bi-camera-fill"></i>
                                <span>Phone Snap</span>
                            </button>
                        </div>

                        {/* Fallback: Manual Barcode Entry */}
                        <div className="mt-2 p-2 bg-white rounded border shadow-sm text-start">
                            <label className="form-label fw-bold small text-muted text-uppercase mb-1" style={{ fontSize: '0.72rem' }}>
                                <i className="bi bi-keyboard me-1"></i> Manual Barcode:
                            </label>
                            <form onSubmit={handleManualSubmit} className="input-group input-group-sm">
                                <input
                                    type="text"
                                    className="form-control font-mono fw-bold"
                                    placeholder="e.g. 8901030364958"
                                    value={manualCode}
                                    onChange={(e) => setManualCode(e.target.value)}
                                />
                                <button type="submit" className="btn btn-success fw-bold px-3">
                                    Add
                                </button>
                            </form>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="modal-footer bg-white border-top p-2 justify-content-between">
                        <small className="text-muted" style={{ fontSize: '0.72rem' }}>
                            Universal Barcode Scanner (EAN, UPC, QR)
                        </small>
                        <button type="button" className="btn btn-secondary btn-sm px-3" onClick={onClose}>
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
