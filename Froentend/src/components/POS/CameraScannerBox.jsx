import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { playBarcodeBeep } from '../../utils/audio';
import { toast } from 'react-toastify';

export default function CameraScannerBox({
    onDetected,
    onClose,
    containerId = 'camera-barcode-viewfinder',
    title = 'Live Camera Barcode Scanner',
    autoCloseOnScan = false,
    compact = false
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
    const [hasTorch, setHasTorch] = useState(false);
    const [isTorchOn, setIsTorchOn] = useState(false);

    const html5QrCodeRef = useRef(null);
    const lastScanRef = useRef({ code: '', time: 0 });
    const isScanLockedRef = useRef(false);
    const lastScannedBarcodeRef = useRef('');
    const isMountedRef = useRef(true);
    const fileInputRef = useRef(null);
    const autoScanCandidateRef = useRef({ code: '', count: 0, time: 0 });

    const isStartingRef = useRef(false);

    // Detect mobile browser environment
    const isMobileDevice = typeof navigator !== 'undefined' &&
        (/android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(navigator.userAgent || ''));

    useEffect(() => {
        isMountedRef.current = true;
        isScanLockedRef.current = false;
        autoScanCandidateRef.current = { code: '', count: 0, time: 0 };
        initializeScanner();

        return () => {
            isMountedRef.current = false;
            stopScanner();
        };
    }, []);

    const stopScanner = async () => {
        isScanLockedRef.current = true;
        if (isTorchOn) {
            try {
                const videoElem = document.querySelector(`#${containerId} video`);
                const track = videoElem?.srcObject?.getVideoTracks()?.[0];
                if (track && track.applyConstraints) {
                    await track.applyConstraints({ advanced: [{ torch: false }] });
                }
            } catch (e) {}
            setIsTorchOn(false);
        }

        if (html5QrCodeRef.current) {
            const scanner = html5QrCodeRef.current;
            html5QrCodeRef.current = null;
            try {
                if (scanner.isScanning) {
                    await scanner.stop();
                }
            } catch (e) {
                console.warn('Scanner stop warn:', e);
            }
            try {
                scanner.clear();
            } catch (e) {}
        }

        // Clean up DOM and stop tracks ONLY when actually turning off / unmounting scanner
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
        if (isStartingRef.current) return;
        isStartingRef.current = true;

        await stopScanner();
        if (!isMountedRef.current) {
            isStartingRef.current = false;
            return;
        }

        isScanLockedRef.current = false;
        autoScanCandidateRef.current = { code: '', count: 0, time: 0 };
        setIsStarting(true);
        setScannerError(null);

        // Pre-clear DOM so container starts fresh
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = '';
        }

        // Check if live camera stream is available
        if (!navigator?.mediaDevices?.getUserMedia) {
            setScannerError('mediaDevices_unavailable');
            setIsStarting(false);
            isStartingRef.current = false;
            return;
        }

        try {
            // NOTE: ITF and CODE_93 are intentionally excluded to completely eliminate
            // false-positive partial misreads on Indian and international retail barcodes.
            const html5QrCode = new Html5Qrcode(containerId, {
                formatsToSupport: [
                    Html5QrcodeSupportedFormats.EAN_13,
                    Html5QrcodeSupportedFormats.EAN_8,
                    Html5QrcodeSupportedFormats.UPC_A,
                    Html5QrcodeSupportedFormats.UPC_E,
                    Html5QrcodeSupportedFormats.CODE_128,
                    Html5QrcodeSupportedFormats.CODE_39,
                    Html5QrcodeSupportedFormats.QR_CODE
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
                // Discard noise and accidental glitch decodes
                if (!clean || clean.length < 4) return;

                // Mode A: Single-item inventory barcode fill mode (autoCloseOnScan = true)
                if (autoCloseOnScan) {
                    // Check if candidate matches previous frame
                    if (autoScanCandidateRef.current.code === clean) {
                        autoScanCandidateRef.current.count += 1;
                    } else {
                        autoScanCandidateRef.current = { code: clean, count: 1, time: now };
                    }

                    // Strict retail check: Standard EAN-13, EAN-8, UPC-A have built-in algebraic modulo-10
                    // checksums so 1 valid decode is authentic. Other formats require 2 consecutive frames.
                    const isStrictRetailEAN = (clean.length === 13 || clean.length === 12 || clean.length === 8) && /^\d+$/.test(clean);
                    if (autoScanCandidateRef.current.count >= 2 || isStrictRetailEAN) {
                        isScanLockedRef.current = true;
                        setLastScanned(clean);
                        setJustScanned(true);

                        // Exactly ONE crisp beep immediately
                        playBarcodeBeep();

                        // Immediately shut off scanner hardware
                        stopScanner();

                        // Pass confirmed genuine code to form
                        onDetected(clean);

                        if (onClose) onClose();
                        return;
                    }
                    return;
                }

                // Mode B: Continuous POS billing scanner mode (autoCloseOnScan = false)
                // 1. Never re-scan the exact same barcode within 2200ms
                if (lastScannedBarcodeRef.current === clean && (now - lastScanRef.current.time < 2200)) {
                    return;
                }
                // 2. Never scan ANY barcode faster than 1200ms
                if (now - lastScanRef.current.time < 1200) {
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

                // Release lock after cooldown for next item
                setTimeout(() => {
                    if (isMountedRef.current) {
                        isScanLockedRef.current = false;
                        setJustScanned(false);
                    }
                }, 1200);
            };

            const onScanFailure = () => {};

            const cameraTarget = specificCameraId ? specificCameraId : { facingMode: 'environment' };

            // Full HD 1080p sensor configuration for effortless distance scanning:
            // 20 FPS: instantaneous scan response with native GPU/hardware BarcodeDetector
            // ideal: 1920x1080: gives 3x more pixel density so barcodes 2-4 feet away resolve razor-sharp
            const config = {
                fps: 30,
                qrbox: (viewfinderWidth, viewfinderHeight) => {
                    const w = Math.floor(viewfinderWidth * 0.95);
                    const h = Math.floor(viewfinderHeight * 0.85);
                    return {
                        width: Math.max(260, Math.min(w, 520)),
                        height: Math.max(160, Math.min(h, 320))
                    };
                },
                videoConstraints: {
                    facingMode: { ideal: 'environment' },
                    width: { ideal: 1920, min: 1280 },
                    height: { ideal: 1080, min: 720 },
                    focusMode: { ideal: 'continuous' }
                }
            };

            try {
                await html5QrCode.start(cameraTarget, config, onScanSuccess, onScanFailure);
            } catch (firstErr) {
                console.warn('Full HD start failed, falling back to standard...', firstErr);
                if (container) {
                    const extraVideos = container.querySelectorAll('video');
                    if (extraVideos.length > 1) {
                        for (let i = 1; i < extraVideos.length; i++) {
                            extraVideos[i].remove();
                        }
                    }
                }
                await html5QrCode.start(
                    cameraTarget,
                    {
                        fps: 15,
                        qrbox: (viewfinderWidth, viewfinderHeight) => {
                            const w = Math.floor(viewfinderWidth * 0.95);
                            const h = Math.floor(viewfinderHeight * 0.85);
                            return {
                                width: Math.max(250, Math.min(w, 480)),
                                height: Math.max(150, Math.min(h, 280))
                            };
                        },
                        videoConstraints: {
                            facingMode: { ideal: 'environment' },
                            width: { ideal: 1280 },
                            height: { ideal: 720 },
                            focusMode: { ideal: 'continuous' }
                        }
                    },
                    onScanSuccess,
                    onScanFailure
                );
            }

            if (!isMountedRef.current) return;
            setIsStarting(false);

            // Configure single video element attributes & check hardware capabilities
            try {
                if (container) {
                    const allVideos = container.querySelectorAll('video');
                    if (allVideos.length > 1) {
                        for (let i = 1; i < allVideos.length; i++) {
                            allVideos[i].remove();
                        }
                    }
                    const videoElem = allVideos[0];
                    if (videoElem) {
                        videoElem.setAttribute('playsinline', 'true');
                        videoElem.setAttribute('webkit-playsinline', 'true');
                        videoElem.setAttribute('muted', 'true');
                        videoElem.setAttribute('autoplay', 'true');
                        videoElem.muted = true;
                        videoElem.style.transform = `scale(${zoomLevel})`;
                        videoElem.style.transformOrigin = 'center center';

                        const playPromise = videoElem.play();
                        if (playPromise !== undefined) {
                            playPromise.catch(() => {});
                        }
                        videoElem.onloadedmetadata = () => {
                            videoElem.play().catch(() => {});
                        };

                        // Check capabilities for hardware torch & zoom
                        if (videoElem.srcObject) {
                            const track = videoElem.srcObject.getVideoTracks()[0];
                            if (track && track.getCapabilities) {
                                const caps = track.getCapabilities();
                                if (caps.torch) {
                                    setHasTorch(true);
                                }
                            }
                        }
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
        } finally {
            isStartingRef.current = false;
        }
    };

    // Torch / Flashlight Toggle for low light & distant scanning
    const toggleTorch = async () => {
        try {
            const videoElem = document.querySelector(`#${containerId} video`);
            const track = videoElem?.srcObject?.getVideoTracks()?.[0];
            if (track && track.applyConstraints) {
                const nextState = !isTorchOn;
                await track.applyConstraints({
                    advanced: [{ torch: nextState }]
                });
                setIsTorchOn(nextState);
            }
        } catch (err) {
            console.warn('Torch toggle error:', err);
        }
    };

    // Mobile Snap Camera Handler: Uses Phone's Native Camera (Works 100% on HTTP)
    const handleSnapPhoto = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsProcessingSnap(true);
        try {
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
            toast.warning('Barcode was not detected in this snap. Please hold camera closer and steady.');
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
                            const targetZoom = Math.min(Math.max(newZoom, capabilities.zoom.min || 1), capabilities.zoom.max || 5);
                            await track.applyConstraints({
                                advanced: [{ zoom: targetZoom }]
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
        <div className="card border-0 shadow-sm rounded-4 mb-3 bg-white overflow-hidden scanner-card-wrap">
            {/* Native Mobile Camera File Input (Zero HTTP restrictions) */}
            <input
                type="file"
                accept="image/*"
                capture="environment"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handleSnapPhoto}
            />

            {/* Header Toolbar - Modern, Compact & Mobile-First */}
            <div className={`card-header py-2 px-3 d-flex justify-content-between align-items-center transition-all ${justScanned ? 'bg-primary text-white' : 'bg-dark text-white border-bottom'}`}>
                <div className="d-flex align-items-center gap-2 text-truncate me-2">
                    <span className="scan-pulse" style={{ width: '8px', height: '8px' }}></span>
                    <i className="bi bi-camera-fill text-primary"></i>
                    <strong className="small text-truncate" style={{ maxWidth: '220px' }}>{title}</strong>
                    {lastScanned && (
                        <span className="badge bg-warning text-dark font-mono px-2 py-0 shadow-sm flex-shrink-0" style={{ fontSize: '0.72rem' }}>
                            {lastScanned}
                        </span>
                    )}
                </div>

                <div className="d-flex align-items-center gap-1 flex-shrink-0">
                    {/* Camera Select Dropdown */}
                    {cameras.length > 1 && (
                        <select
                            className="form-select form-select-sm bg-light text-dark py-0 px-2 fw-semibold border"
                            style={{ fontSize: '0.72rem', width: 'auto' }}
                            value={selectedCameraId}
                            onChange={handleCameraSwitch}
                        >
                            {cameras.map((c, i) => (
                                <option key={c.id} value={c.id}>
                                    Cam {i + 1}
                                </option>
                            ))}
                        </select>
                    )}

                    {/* Turn Off Camera Button */}
                    <button
                        type="button"
                        className="btn btn-sm btn-outline-danger fw-bold d-flex align-items-center gap-1 py-1 px-2"
                        style={{ fontSize: '0.72rem' }}
                        onClick={handleTurnOffCamera}
                        title="Close Camera"
                    >
                        <i className="bi bi-x-lg"></i>
                        <span>Close</span>
                    </button>
                </div>
            </div>

            {/* Viewfinder & Controls Container */}
            <div className={`card-body p-2 ${compact ? 'p-1 bg-dark' : 'bg-light'}`}>
                {compact ? (
                    /* COMPACT MOBILE VIEW: Dedicated 1-Column Camera Scanner */
                    <div className="w-100">
                        <div
                            className="scanner-viewport-box shadow-inner position-relative mx-auto rounded-3 overflow-hidden"
                            style={{ height: '200px', maxHeight: '200px', width: '100%' }}
                        >
                            {/* Live Video Target */}
                            <div
                                id={containerId}
                                style={{ width: '100%', height: '200px', overflow: 'hidden' }}
                            ></div>

                            {/* Viewfinder Targeting Reticle */}
                            {!isStarting && !scannerError && (
                                <div className="scanner-reticle-box">
                                    <div className="scanner-corner top-left"></div>
                                    <div className="scanner-corner top-right"></div>
                                    <div className="scanner-corner bottom-left"></div>
                                    <div className="scanner-corner bottom-right"></div>
                                </div>
                            )}

                            {/* Single Laser Sweep Line */}
                            {!isStarting && !scannerError && (
                                <div className="scanner-laser-line"></div>
                            )}

                            {/* Processing Snap Indicator */}
                            {isProcessingSnap && (
                                <div className="position-absolute top-0 start-0 w-100 h-100 bg-dark bg-opacity-75 d-flex flex-column justify-content-center align-items-center text-white" style={{ zIndex: 25 }}>
                                    <div className="spinner-border spinner-border-sm text-warning mb-1" role="status"></div>
                                    <span className="small fw-bold">Reading barcode...</span>
                                </div>
                            )}

                            {/* Mobile / Insecure HTTP Viewfinder Fallback (Direct Snap) */}
                            {scannerError && (
                                <div className="position-absolute top-0 start-0 w-100 h-100 bg-dark p-2 text-center text-white d-flex flex-column justify-content-center align-items-center" style={{ zIndex: 20 }}>
                                    <i className="bi bi-camera text-warning fs-3 mb-1"></i>
                                    <h6 className="fw-bold text-white mb-1" style={{ fontSize: '0.85rem' }}>
                                        {isMobileDevice ? 'Mobile Camera Ready' : 'Camera Feed Blocked'}
                                    </h6>
                                    <p className="small text-light mb-2 px-1" style={{ fontSize: '0.72rem', maxWidth: '320px' }}>
                                        Tap below to scan with native camera:
                                    </p>
                                    <button
                                        type="button"
                                        className="btn btn-primary btn-sm fw-bold px-3 py-1 shadow-sm"
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        <i className="bi bi-camera-fill me-1"></i> Snap Barcode
                                    </button>
                                </div>
                            )}

                            {/* Loading state indicator */}
                            {isStarting && !scannerError && (
                                <div className="position-absolute top-0 start-0 w-100 h-100 bg-dark bg-opacity-75 d-flex flex-column justify-content-center align-items-center text-white" style={{ zIndex: 15 }}>
                                    <div className="spinner-border spinner-border-sm text-primary mb-1" role="status"></div>
                                    <span className="small" style={{ fontSize: '0.75rem' }}>Starting lens...</span>
                                </div>
                            )}
                        </div>

                        {/* Mobile Single-Row Controls: Zoom, Torch, Snap Photo */}
                        <div className="d-flex justify-content-between align-items-center mt-2 px-1">
                            <div className="d-flex align-items-center gap-1">
                                <span className="text-muted small fw-bold me-1" style={{ fontSize: '0.72rem' }}>
                                    Zoom:
                                </span>
                                <div className="btn-group btn-group-sm" role="group">
                                    <button
                                        type="button"
                                        className={`btn btn-xs py-1 px-2 fw-bold ${zoomLevel === 1 ? 'btn-primary text-white' : 'btn-outline-secondary text-light'}`}
                                        style={{ fontSize: '0.72rem' }}
                                        onClick={() => handleApplyZoom(1)}
                                    >
                                        1x
                                    </button>
                                    <button
                                        type="button"
                                        className={`btn btn-xs py-1 px-2 fw-bold ${zoomLevel === 2 ? 'btn-primary text-white' : 'btn-outline-secondary text-light'}`}
                                        style={{ fontSize: '0.72rem' }}
                                        onClick={() => handleApplyZoom(2)}
                                        title="2x Far"
                                    >
                                        🎯 2x
                                    </button>
                                    <button
                                        type="button"
                                        className={`btn btn-xs py-1 px-2 fw-bold ${zoomLevel === 3 ? 'btn-primary text-white' : 'btn-outline-secondary text-light'}`}
                                        style={{ fontSize: '0.72rem' }}
                                        onClick={() => handleApplyZoom(3)}
                                    >
                                        3x
                                    </button>
                                </div>
                            </div>

                            <div className="d-flex align-items-center gap-1">
                                {hasTorch && (
                                    <button
                                        type="button"
                                        className={`btn btn-xs py-1 px-2 fw-bold d-flex align-items-center gap-1 ${isTorchOn ? 'btn-warning text-dark' : 'btn-outline-secondary text-light'}`}
                                        style={{ fontSize: '0.72rem' }}
                                        onClick={toggleTorch}
                                        title="Toggle Flashlight / Torch"
                                    >
                                        <i className="bi bi-lightbulb-fill"></i>
                                        <span>{isTorchOn ? 'Torch ON' : 'Torch'}</span>
                                    </button>
                                )}

                                <button
                                    type="button"
                                    className="btn btn-outline-info btn-xs fw-bold px-2 py-1 shadow-sm d-flex align-items-center gap-1"
                                    style={{ fontSize: '0.72rem' }}
                                    onClick={() => fileInputRef.current?.click()}
                                    title="Open phone camera to snap barcode directly"
                                >
                                    <i className="bi bi-camera-fill"></i>
                                    <span>Snap</span>
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* DESKTOP 2-COLUMN VIEW */
                    <div className="row g-2 align-items-center">
                        {/* Viewfinder Column (220px clear height) */}
                        <div className="col-md-6 col-12">
                            <div
                                className="scanner-viewport-box shadow-inner position-relative mx-auto"
                                style={{ height: '220px', maxHeight: '220px', width: '100%' }}
                            >
                                {/* Live Video Target */}
                                <div
                                    id={containerId}
                                    style={{ width: '100%', height: '220px', overflow: 'hidden' }}
                                ></div>

                                {/* Viewfinder Targeting Reticle */}
                                {!isStarting && !scannerError && (
                                    <div className="scanner-reticle-box">
                                        <div className="scanner-corner top-left"></div>
                                        <div className="scanner-corner top-right"></div>
                                        <div className="scanner-corner bottom-left"></div>
                                        <div className="scanner-corner bottom-right"></div>
                                    </div>
                                )}

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
                                            className="btn btn-primary btn-sm fw-bold px-3 py-1 shadow-sm"
                                            onClick={() => fileInputRef.current?.click()}
                                        >
                                            <i className="bi bi-camera-fill me-1"></i> Snap Barcode Now
                                        </button>
                                    </div>
                                )}

                                {/* Loading state indicator */}
                                {isStarting && !scannerError && (
                                    <div className="position-absolute top-0 start-0 w-100 h-100 bg-dark bg-opacity-75 d-flex flex-column justify-content-center align-items-center text-white" style={{ zIndex: 15 }}>
                                        <div className="spinner-border spinner-border-sm text-primary mb-1" role="status"></div>
                                        <span className="small" style={{ fontSize: '0.75rem' }}>Opening high-resolution lens...</span>
                                    </div>
                                )}
                            </div>

                            {/* Distance Zoom Bar, Torch & Quick Snap Toolbar */}
                            <div className="d-flex justify-content-between align-items-center mt-2 px-1 flex-wrap gap-1">
                                <div className="d-flex align-items-center gap-1">
                                    <span className="text-muted small fw-bold me-1" style={{ fontSize: '0.72rem' }}>
                                        Zoom:
                                    </span>
                                    <div className="btn-group btn-group-sm" role="group">
                                        <button
                                            type="button"
                                            className={`btn btn-sm px-2 py-1 fw-bold ${zoomLevel === 1 ? 'btn-primary text-white' : 'btn-outline-secondary'}`}
                                            style={{ fontSize: '0.72rem' }}
                                            onClick={() => handleApplyZoom(1)}
                                        >
                                            1x
                                        </button>
                                        <button
                                            type="button"
                                            className={`btn btn-sm px-2 py-1 fw-bold ${zoomLevel === 2 ? 'btn-primary text-white' : 'btn-outline-secondary'}`}
                                            style={{ fontSize: '0.72rem' }}
                                            onClick={() => handleApplyZoom(2)}
                                            title="2x Hardware Distance Zoom"
                                        >
                                            🎯 2x Far
                                        </button>
                                        <button
                                            type="button"
                                            className={`btn btn-sm px-2 py-1 fw-bold ${zoomLevel === 3 ? 'btn-primary text-white' : 'btn-outline-secondary'}`}
                                            style={{ fontSize: '0.72rem' }}
                                            onClick={() => handleApplyZoom(3)}
                                        >
                                            3x
                                        </button>
                                    </div>
                                </div>

                                <div className="d-flex align-items-center gap-1">
                                    {hasTorch && (
                                        <button
                                            type="button"
                                            className={`btn btn-sm px-2 py-1 fw-bold d-flex align-items-center gap-1 ${isTorchOn ? 'btn-warning text-dark' : 'btn-outline-secondary'}`}
                                            style={{ fontSize: '0.72rem' }}
                                            onClick={toggleTorch}
                                            title="Toggle Flashlight / Torch"
                                        >
                                            <i className="bi bi-lightbulb-fill"></i>
                                            <span>{isTorchOn ? 'Torch ON' : 'Torch'}</span>
                                        </button>
                                    )}

                                    <button
                                        type="button"
                                        className="btn btn-outline-primary btn-sm fw-bold px-2 py-1 shadow-sm d-flex align-items-center gap-1"
                                        style={{ fontSize: '0.72rem' }}
                                        onClick={() => fileInputRef.current?.click()}
                                        title="Open phone camera to snap barcode directly"
                                    >
                                        <i className="bi bi-camera-fill"></i>
                                        <span>Snap Photo</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Controls & Manual Input Column */}
                        <div className="col-md-6 col-12">
                            <div className="p-3 bg-white rounded-3 border h-100 d-flex flex-column justify-content-between">
                                <div>
                                    <label className="form-label small fw-bold text-muted mb-1 text-uppercase" style={{ fontSize: '0.72rem' }}>
                                        Barcode / Manual SKU:
                                    </label>
                                    <div className="input-group input-group-sm mb-2">
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

                                <div className="d-flex gap-2 mt-2">
                                    <button
                                        type="button"
                                        className="btn btn-outline-primary btn-sm fw-bold w-50 py-1"
                                        style={{ fontSize: '0.75rem' }}
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        <i className="bi bi-phone me-1"></i> Phone Snap
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-outline-danger btn-sm fw-bold w-50 py-1"
                                        style={{ fontSize: '0.75rem' }}
                                        onClick={handleTurnOffCamera}
                                    >
                                        <i className="bi bi-power me-1"></i> Stop Camera
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
