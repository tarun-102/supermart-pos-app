import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { playBarcodeBeep } from '../../utils/audio';

export default function CameraScannerBox({
    onDetected,
    onClose,
    containerId = 'camera-barcode-viewfinder',
    title = 'Live Camera Barcode Scanner',
    autoCloseOnScan = false
}) {
    const [scannerError, setScannerError] = useState(null);
    const [cameras, setCameras] = useState([]);
    const [selectedCameraId, setSelectedCameraId] = useState('');
    const [lastScanned, setLastScanned] = useState(null);
    const [manualCode, setManualCode] = useState('');
    const [isStarting, setIsStarting] = useState(true);
    const [justScanned, setJustScanned] = useState(false);
    const [zoomLevel, setZoomLevel] = useState(1);
    const [isProcessingSnap, setIsProcessingSnap] = useState(false);

    const html5QrCodeRef = useRef(null);
    const lastScanRef = useRef({ code: '', time: 0 });
    const isScanLockedRef = useRef(false);
    const lastScannedBarcodeRef = useRef('');
    const isMountedRef = useRef(true);
    const fileInputRef = useRef(null);

    // Detect mobile browser environment
    const isMobileDevice = typeof navigator !== 'undefined' &&
        (/android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(navigator.userAgent || ''));

    useEffect(() => {
        isMountedRef.current = true;
        isScanLockedRef.current = false;
        initializeScanner();

        return () => {
            isMountedRef.current = false;
            stopScanner();
        };
    }, []);

    const stopScanner = () => {
        isScanLockedRef.current = true;
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

        // Clean up DOM and stop tracks to prevent duplicate video feeds
        try {
            const container = document.getElementById(containerId);
            if (container) {
                const videos = container.querySelectorAll('video');
                videos.forEach(v => {
                    if (v.srcObject) {
                        try {
                            v.srcObject.getTracks().forEach(t => t.stop());
                        } catch (e) {}
                        v.srcObject = null;
                    }
                });
                container.innerHTML = '';
            }
        } catch (e) {}
    };

    const initializeScanner = async (specificCameraId = null) => {
        stopScanner();
        isScanLockedRef.current = false;
        setIsStarting(true);
        setScannerError(null);

        // Pre-clear DOM so no duplicate video tags ever exist
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = '';
        }

        // Check if live camera stream is available
        if (!navigator?.mediaDevices?.getUserMedia) {
            setScannerError('mediaDevices_unavailable');
            setIsStarting(false);
            return;
        }

        try {
            const html5QrCode = new Html5Qrcode(containerId, {
                formatsToSupport: [
                    Html5QrcodeSupportedFormats.EAN_13,
                    Html5QrcodeSupportedFormats.EAN_8,
                    Html5QrcodeSupportedFormats.CODE_128,
                    Html5QrcodeSupportedFormats.CODE_39,
                    Html5QrcodeSupportedFormats.CODE_93,
                    Html5QrcodeSupportedFormats.UPC_A,
                    Html5QrcodeSupportedFormats.UPC_E,
                    Html5QrcodeSupportedFormats.ITF,
                    Html5QrcodeSupportedFormats.QR_CODE,
                    Html5QrcodeSupportedFormats.DATA_MATRIX
                ],
                experimentalFeatures: {
                    useBarCodeDetectorIfSupported: true
                },
                verbose: false
            });

            html5QrCodeRef.current = html5QrCode;

            const onScanSuccess = (decodedText) => {
                // Hard guard: if locked or already shutting down, discard immediately
                if (isScanLockedRef.current) return;

                const now = Date.now();
                const clean = decodedText ? decodedText.trim() : '';
                if (!clean) return;

                // Mode A: Single-item inventory barcode fill mode (autoCloseOnScan = true)
                if (autoCloseOnScan) {
                    // Lock instantly so NO MORE FRAMES can ever decode or beep
                    isScanLockedRef.current = true;
                    setLastScanned(clean);
                    setJustScanned(true);

                    // Exactly ONE crisp beep immediately
                    playBarcodeBeep();

                    // Immediately shut off scanner hardware
                    stopScanner();

                    // Pass code to form
                    onDetected(clean);

                    if (onClose) onClose();
                    return;
                }

                // Mode B: Continuous POS billing scanner mode (autoCloseOnScan = false)
                // 1. Never re-scan the exact same barcode within 3500ms
                if (lastScannedBarcodeRef.current === clean && (now - lastScanRef.current.time < 3500)) {
                    return;
                }
                // 2. Never scan ANY barcode faster than 1800ms
                if (now - lastScanRef.current.time < 1800) {
                    return;
                }

                // Lock for the cooldown period
                isScanLockedRef.current = true;
                lastScanRef.current = { code: clean, time: now };
                lastScannedBarcodeRef.current = clean;
                setLastScanned(clean);
                setJustScanned(true);

                // Notify POS parent (which verifies inventory and triggers single beep)
                onDetected(clean);

                // Release lock after 1800ms cooldown for next item
                setTimeout(() => {
                    if (isMountedRef.current) {
                        isScanLockedRef.current = false;
                        setJustScanned(false);
                    }
                }, 1800);
            };

            const onScanFailure = () => {};

            const cameraTarget = specificCameraId ? specificCameraId : { facingMode: 'environment' };

            const config = {
                fps: 25,
                qrbox: (viewfinderWidth, viewfinderHeight) => ({
                    width: Math.max(240, Math.floor(viewfinderWidth * 0.95)),
                    height: Math.max(120, Math.floor(viewfinderHeight * 0.90))
                }),
                videoConstraints: {
                    facingMode: { ideal: 'environment' },
                    width: { min: 1280, ideal: 1920 },
                    height: { min: 720, ideal: 1080 },
                    focusMode: { ideal: 'continuous' }
                }
            };

            try {
                await html5QrCode.start(cameraTarget, config, onScanSuccess, onScanFailure);
            } catch (firstErr) {
                console.warn('Flexible start failed, trying basic camera...', firstErr);
                // Ensure DOM has only 1 video before fallback
                if (container) {
                    const extraVideos = container.querySelectorAll('video');
                    if (extraVideos.length > 1) {
                        for (let i = 1; i < extraVideos.length; i++) {
                            extraVideos[i].remove();
                        }
                    }
                }
                await html5QrCode.start(cameraTarget, { fps: 20 }, onScanSuccess, onScanFailure);
            }

            if (!isMountedRef.current) return;
            setIsStarting(false);

            // Configure single video element attributes & ensure no duplicate tags
            try {
                if (container) {
                    const allVideos = container.querySelectorAll('video');
                    if (allVideos.length > 1) {
                        for (let i = 1; i < allVideos.length; i++) {
                            if (allVideos[i].srcObject) {
                                try { allVideos[i].srcObject.getTracks().forEach(t => t.stop()); } catch (e) {}
                            }
                            allVideos[i].remove();
                        }
                    }
                    const videoElem = allVideos[0];
                    if (videoElem) {
                        videoElem.setAttribute('playsinline', 'true');
                        videoElem.setAttribute('webkit-playsinline', 'true');
                        videoElem.setAttribute('muted', 'true');
                        videoElem.setAttribute('autoplay', 'true');
                        videoElem.style.transform = `scale(${zoomLevel})`;
                        videoElem.style.transformOrigin = 'center center';
                    }
                }
            } catch (e) {}

            // Populate camera switcher
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
            console.error('Camera live start error:', fatalErr);
            if (!isMountedRef.current) return;
            setScannerError('stream_blocked');
            setIsStarting(false);
        }
    };

    // Mobile Snap Camera Handler: Uses Phone's Native Camera (Works 100% on HTTP)
    const handleSnapPhoto = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsProcessingSnap(true);
        try {
            // Create temporary instance for fast file barcode decoding
            let snapScanner = html5QrCodeRef.current;
            if (!snapScanner) {
                snapScanner = new Html5Qrcode(containerId, { verbose: false });
            }

            const decodedText = await snapScanner.scanFile(file, true);
            if (decodedText) {
                const clean = decodedText.trim();
                setLastScanned(clean);
                setJustScanned(true);
                setTimeout(() => setJustScanned(false), 800);
                playBarcodeBeep();
                onDetected(clean);
                if (autoCloseOnScan && onClose) {
                    onClose();
                }
            }
        } catch (err) {
            console.warn('Snap barcode decode error:', err);
            alert('Barcode was not detected in this snap. Please hold camera closer and keep barcode steady.');
        } finally {
            setIsProcessingSnap(false);
            e.target.value = '';
        }
    };

    const handleTurnOffCamera = () => {
        stopScanner();
        if (onClose) onClose();
    };

    const handleCameraSwitch = (e) => {
        const camId = e.target.value;
        setSelectedCameraId(camId);
        initializeScanner(camId);
    };

    const handleApplyZoom = async (newZoom) => {
        setZoomLevel(newZoom);
        try {
            const videoElem = document.querySelector(`#${containerId} video`);
            if (videoElem) {
                videoElem.style.transform = `scale(${newZoom})`;
                videoElem.style.transformOrigin = 'center center';
                videoElem.style.transition = 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)';

                if (videoElem.srcObject) {
                    const track = videoElem.srcObject.getVideoTracks()[0];
                    if (track && track.applyConstraints) {
                        const capabilities = track.getCapabilities ? track.getCapabilities() : {};
                        if (capabilities.zoom) {
                            await track.applyConstraints({
                                advanced: [{ zoom: Number(newZoom) }]
                            });
                        }
                    }
                }
            }
        } catch (e) {}
    };

    const handleManualSubmit = (e) => {
        e.preventDefault();
        if (!manualCode.trim()) return;
        const code = manualCode.trim();
        setLastScanned(code);
        setManualCode('');
        playBarcodeBeep();
        onDetected(code);
        if (autoCloseOnScan && onClose) {
            onClose();
        }
    };

    return (
        <div className="card border-success border-2 shadow-sm rounded-3 mb-2 bg-white overflow-hidden">
            {/* Native Mobile Camera File Input (Zero HTTP restrictions) */}
            <input
                type="file"
                accept="image/*"
                capture="environment"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handleSnapPhoto}
            />

            {/* Header Toolbar - Compact */}
            <div className={`card-header text-white py-1 px-3 d-flex justify-content-between align-items-center transition-all ${justScanned ? 'bg-primary' : 'bg-success'}`}>
                <div className="d-flex align-items-center gap-2">
                    <span className="scan-pulse" style={{ width: '8px', height: '8px' }}></span>
                    <i className="bi bi-camera-fill"></i>
                    <strong className="small">{title}</strong>
                    {lastScanned && (
                        <span className="badge bg-warning text-dark font-mono ms-1 px-2 py-0 shadow-sm" style={{ fontSize: '0.75rem' }}>
                            Scanned: {lastScanned}
                        </span>
                    )}
                </div>

                <div className="d-flex align-items-center gap-1">
                    {/* Camera Select Dropdown */}
                    {cameras.length > 1 && (
                        <select
                            className="form-select form-select-sm bg-white text-dark py-0 px-2 fw-semibold border-0"
                            style={{ fontSize: '0.72rem', width: 'auto' }}
                            value={selectedCameraId}
                            onChange={handleCameraSwitch}
                        >
                            {cameras.map((c, i) => (
                                <option key={c.id} value={c.id}>
                                    📷 {c.label.slice(0, 18) || `Cam ${i + 1}`}
                                </option>
                            ))}
                        </select>
                    )}

                    {/* Turn Off Camera Button */}
                    <button
                        type="button"
                        className="btn btn-sm btn-danger fw-bold d-flex align-items-center gap-1 py-0 px-2"
                        style={{ fontSize: '0.72rem' }}
                        onClick={handleTurnOffCamera}
                        title="Turn OFF Camera"
                    >
                        <i className="bi bi-camera-video-off-fill"></i>
                        <span>Turn OFF</span>
                    </button>
                </div>
            </div>

            {/* Viewfinder & Controls Container */}
            <div className="card-body p-2 bg-light">
                <div className="row g-2 align-items-center">
                    {/* Viewfinder Column (Single screen, compact 145px) */}
                    <div className="col-md-6 col-12">
                        <div
                            className="scanner-viewport-box shadow-inner position-relative mx-auto"
                            style={{ height: '145px', maxHeight: '145px', width: '100%' }}
                        >
                            {/* Live Video Target */}
                            <div
                                id={containerId}
                                style={{ width: '100%', height: '145px', overflow: 'hidden' }}
                            ></div>

                            {/* Single Laser Sweep Line */}
                            {!isStarting && !scannerError && (
                                <div className="scanner-laser-line"></div>
                            )}

                            {/* Processing Snap Indicator */}
                            {isProcessingSnap && (
                                <div className="position-absolute top-0 start-0 w-100 h-100 bg-dark bg-opacity-75 d-flex flex-column justify-content-center align-items-center text-white" style={{ zIndex: 25 }}>
                                    <div className="spinner-border spinner-border-sm text-warning mb-1" role="status"></div>
                                    <span className="small fw-bold">Reading barcode from photo...</span>
                                </div>
                            )}

                            {/* Mobile / Insecure HTTP Viewfinder Fallback (Direct Snap) */}
                            {scannerError && (
                                <div className="position-absolute top-0 start-0 w-100 h-100 bg-dark p-2 text-center text-white d-flex flex-column justify-content-center align-items-center" style={{ zIndex: 20 }}>
                                    <i className="bi bi-camera text-warning fs-3 mb-1"></i>
                                    <h6 className="fw-bold text-white mb-1" style={{ fontSize: '0.85rem' }}>
                                        {isMobileDevice ? 'Mobile Phone Camera Ready' : 'Camera Live Feed Blocked'}
                                    </h6>
                                    <p className="small text-light mb-2 px-1" style={{ fontSize: '0.72rem', maxWidth: '320px' }}>
                                        Tap below to scan with your phone's native camera:
                                    </p>
                                    <button
                                        type="button"
                                        className="btn btn-success btn-sm fw-bold px-3 py-1 shadow"
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        <i className="bi bi-camera-fill me-1"></i> Snap Barcode Now
                                    </button>
                                </div>
                            )}

                            {/* Loading state indicator */}
                            {isStarting && !scannerError && (
                                <div className="position-absolute top-0 start-0 w-100 h-100 bg-dark bg-opacity-75 d-flex flex-column justify-content-center align-items-center text-white" style={{ zIndex: 15 }}>
                                    <div className="spinner-border spinner-border-sm text-success mb-1" role="status"></div>
                                    <span className="small" style={{ fontSize: '0.75rem' }}>Opening camera lens...</span>
                                </div>
                            )}
                        </div>

                        {/* Distance Zoom Bar & Quick Snap Button */}
                        <div className="d-flex justify-content-between align-items-center mt-1 px-1 flex-wrap gap-1">
                            <div className="d-flex align-items-center gap-1">
                                <span className="text-muted small fw-bold" style={{ fontSize: '0.7rem' }}>
                                    Zoom:
                                </span>
                                <div className="btn-group btn-group-sm" role="group">
                                    {[1, 1.5, 2, 2.5, 3].map(z => (
                                        <button
                                            key={z}
                                            type="button"
                                            className={`btn btn-sm px-2 py-0 fw-bold ${zoomLevel === z ? 'btn-success text-white' : 'btn-outline-secondary'}`}
                                            style={{ fontSize: '0.68rem' }}
                                            onClick={() => handleApplyZoom(z)}
                                            title={`Set Zoom to ${z}x`}
                                        >
                                            {z}x
                                        </button>
                                    ))}
                                </div>
                                <button
                                    type="button"
                                    className={`btn btn-sm px-2 py-0 fw-bold ${zoomLevel >= 2 ? 'btn-warning text-dark' : 'btn-outline-warning text-dark'}`}
                                    style={{ fontSize: '0.65rem' }}
                                    onClick={() => handleApplyZoom(zoomLevel >= 2 ? 1 : 2)}
                                    title="Toggle Far-Distance Counter Barcode Scanning Mode"
                                >
                                    🎯 Distance Mode
                                </button>
                            </div>

                            {/* One-Tap Mobile Camera Snap */}
                            <button
                                type="button"
                                className="btn btn-outline-success btn-sm fw-bold px-2 py-0 shadow-sm d-flex align-items-center gap-1"
                                style={{ fontSize: '0.72rem' }}
                                onClick={() => fileInputRef.current?.click()}
                                title="Open phone camera to snap barcode directly"
                            >
                                <i className="bi bi-camera-fill"></i>
                                <span>Snap Camera</span>
                            </button>
                        </div>
                    </div>

                    {/* Controls & Manual Input Column */}
                    <div className="col-md-6 col-12">
                        <div className="p-2 bg-white rounded border h-100 d-flex flex-column justify-content-between">
                            <div>
                                <label className="form-label small fw-bold text-muted mb-1 text-uppercase" style={{ fontSize: '0.72rem' }}>
                                    Barcode / Manual SKU:
                                </label>
                                <div className="input-group input-group-sm mb-1">
                                    <input
                                        type="text"
                                        className="form-control font-mono fw-bold"
                                        placeholder="Scan or type barcode..."
                                        value={manualCode}
                                        onChange={(e) => setManualCode(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleManualSubmit(e);
                                            }
                                        }}
                                    />
                                    <button
                                        type="button"
                                        className="btn btn-success fw-bold px-3"
                                        onClick={handleManualSubmit}
                                    >
                                        Scan
                                    </button>
                                </div>
                            </div>

                            <div className="d-flex gap-1 mt-1">
                                <button
                                    type="button"
                                    className="btn btn-outline-primary btn-sm fw-bold w-50 py-1"
                                    style={{ fontSize: '0.72rem' }}
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <i className="bi bi-phone me-1"></i> Phone Snap
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-outline-danger btn-sm fw-bold w-50 py-1"
                                    style={{ fontSize: '0.72rem' }}
                                    onClick={handleTurnOffCamera}
                                >
                                    <i className="bi bi-power me-1"></i> Stop Camera
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
