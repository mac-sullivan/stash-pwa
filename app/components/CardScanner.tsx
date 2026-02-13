'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Tesseract from 'tesseract.js';
import { Html5Qrcode } from 'html5-qrcode';
import { supabase } from '@/lib/supabase';
import Image from 'next/image';

const PRESET_CATEGORIES = [
  'Restaurant', 'Retail', 'Service', 'Health', 'Tech',
  'Finance', 'Creative', 'Education', 'Real Estate', 'Other',
];

interface ParsedCard {
  name: string;
  company: string;
  phone: string;
  additionalPhone: string;
  email: string;
  website: string;
  additionalWebsite: string;
  address: string;
  socialMedia: {
    facebook?: string;
    instagram?: string;
    linkedin?: string;
  };
  notes: string;
  categories: string[];
}

type ScanMode = 'card' | 'qr';

export default function CardScanner() {
  const [mode, setMode] = useState<ScanMode>('card');
  const [image, setImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [extractedText, setExtractedText] = useState<string>('');
  const [parsedData, setParsedData] = useState<ParsedCard | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [customCategory, setCustomCategory] = useState('');

  // QR state
  const [cameraActive, setCameraActive] = useState(false);
  const [qrDecodedText, setQrDecodedText] = useState<string>('');
  const qrScannerRef = useRef<Html5Qrcode | null>(null);
  const qrContainerRef = useRef<HTMLDivElement>(null);

  const stopCamera = useCallback(async () => {
    if (qrScannerRef.current) {
      try {
        const state = qrScannerRef.current.getState();
        if (state === 2) {
          await qrScannerRef.current.stop();
        }
      } catch {
        // ignore stop errors
      }
      qrScannerRef.current = null;
    }
    setCameraActive(false);
  }, []);

  useEffect(() => {
    return () => {
      if (qrScannerRef.current) {
        try {
          const state = qrScannerRef.current.getState();
          if (state === 2) {
            qrScannerRef.current.stop();
          }
        } catch {
          // ignore
        }
      }
    };
  }, []);

  useEffect(() => {
    if (mode === 'card') {
      stopCamera();
    }
  }, [mode, stopCamera]);

  // Sync categories when parsedData arrives
  useEffect(() => {
    if (parsedData?.categories) {
      setSelectedCategories(parsedData.categories);
    }
  }, [parsedData]);

  const resetAll = () => {
    setImage(null);
    setExtractedText('');
    setParsedData(null);
    setQrDecodedText('');
    setSelectedCategories([]);
    setCustomCategory('');
    stopCamera();
  };

  const switchMode = (newMode: ScanMode) => {
    resetAll();
    setMode(newMode);
  };

  const toggleCategory = (cat: string) => {
    setSelectedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const addCustomCategory = () => {
    const trimmed = customCategory.trim();
    if (trimmed && !selectedCategories.includes(trimmed)) {
      setSelectedCategories(prev => [...prev, trimmed]);
    }
    setCustomCategory('');
  };

  // --- Card mode handlers ---

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
        setExtractedText('');
        setParsedData(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const processCard = async () => {
    if (!image) return;

    setIsProcessing(true);

    try {
      const result = await Tesseract.recognize(image, 'eng', {
        logger: (m) => console.log(m),
      });

      const text = result.data.text;
      setExtractedText(text);

      const response = await fetch('/api/parse-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, source: 'ocr' }),
      });

      if (!response.ok) throw new Error('Failed to parse card');

      const parsed = await response.json();
      setParsedData(parsed);
    } catch (error) {
      console.error('Processing Error:', error);
      alert('Failed to process image. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // --- QR mode handlers ---

  const startCamera = async () => {
    const containerId = 'qr-reader';
    if (!document.getElementById(containerId)) return;

    if (!window.isSecureContext) {
      alert('Camera requires HTTPS. Please access this site over HTTPS to use camera scanning.');
      return;
    }

    const html5Qrcode = new Html5Qrcode(containerId);
    qrScannerRef.current = html5Qrcode;

    const qrConfig = { fps: 10, qrbox: { width: 250, height: 250 } };
    const onSuccess = (decodedText: string) => {
      setQrDecodedText(decodedText);
      stopCamera();
      parseQrText(decodedText);
    };
    const onFailure = () => {};

    try {
      // Try back camera first
      await html5Qrcode.start(
        { facingMode: 'environment' },
        qrConfig,
        onSuccess,
        onFailure
      );
      setCameraActive(true);
    } catch {
      // Fall back to any available camera
      try {
        await html5Qrcode.start(
          { facingMode: 'user' },
          qrConfig,
          onSuccess,
          onFailure
        );
        setCameraActive(true);
      } catch (err) {
        console.error('Camera error:', err);
        alert('Could not access camera. Make sure you have granted camera permissions and are using HTTPS.');
        qrScannerRef.current = null;
      }
    }
  };

  const handleQrFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const html5Qrcode = new Html5Qrcode('qr-reader-hidden');

    try {
      const result = await html5Qrcode.scanFile(file, true);
      setQrDecodedText(result);
      parseQrText(result);
    } catch {
      alert('No QR code found in the image. Please try another image.');
    }
  };

  const parseQrText = async (text: string) => {
    setIsProcessing(true);

    try {
      const response = await fetch('/api/parse-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, source: 'qr' }),
      });

      if (!response.ok) throw new Error('Failed to parse QR data');

      const parsed = await response.json();
      setParsedData(parsed);
    } catch (error) {
      console.error('QR Parse Error:', error);
      alert('Failed to parse QR code data. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // --- Save ---

  const saveToStash = async () => {
    if (!parsedData) return;

    setIsSaving(true);

    try {
      const { data, error } = await supabase
        .from('stash')
        .insert([
          {
            name: parsedData.name || null,
            company: parsedData.company || null,
            phone: parsedData.phone || null,
            additional_phone: parsedData.additionalPhone || null,
            email: parsedData.email || null,
            website: parsedData.website || null,
            additional_website: parsedData.additionalWebsite || null,
            address: parsedData.address || null,
            social_media: parsedData.socialMedia || null,
            notes: parsedData.notes || null,
            card_image_url: image,
            categories: selectedCategories.length > 0 ? selectedCategories : null,
          }
        ])
        .select();

      if (error) throw error;

      console.log('Saved:', data);
      alert('Saved to Stash!');
      resetAll();
    } catch (error) {
      console.error('Save error:', error);
      alert('Failed to save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // --- Category picker (shared) ---

  const renderCategoryPicker = () => (
    <div className="space-y-3">
      <label className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>Categories</label>
      <div className="flex flex-wrap gap-2">
        {PRESET_CATEGORIES.map(cat => (
          <button
            key={cat}
            type="button"
            onClick={() => toggleCategory(cat)}
            className="px-3 py-1 rounded-full text-xs font-semibold transition-all duration-200"
            style={{
              background: selectedCategories.includes(cat) ? 'var(--accent)' : 'var(--border)',
              color: selectedCategories.includes(cat) ? '#ffffff' : 'var(--text-muted)',
            }}
          >
            {cat}
          </button>
        ))}
      </div>
      {/* Custom categories shown as removable tags */}
      {selectedCategories.filter(c => !PRESET_CATEGORIES.includes(c)).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedCategories.filter(c => !PRESET_CATEGORIES.includes(c)).map(cat => (
            <span
              key={cat}
              className="px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1"
              style={{ background: 'var(--accent)', color: '#ffffff' }}
            >
              {cat}
              <button type="button" onClick={() => toggleCategory(cat)} className="ml-1 opacity-75 hover:opacity-100">&times;</button>
            </span>
          ))}
        </div>
      )}
      {/* Custom category input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={customCategory}
          onChange={(e) => setCustomCategory(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomCategory(); } }}
          placeholder="Add custom category..."
          className="flex-1 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2"
          style={{
            background: 'var(--input-bg)',
            border: '1px solid var(--input-border)',
            color: 'var(--text)',
          }}
        />
        <button
          type="button"
          onClick={addCustomCategory}
          className="px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors duration-200"
          style={{ background: 'var(--border)', color: 'var(--text)' }}
        >
          Add
        </button>
      </div>
    </div>
  );

  // --- Parsed data display (shared between modes) ---

  const renderParsedData = () => {
    if (!parsedData) return null;

    const fields: { key: keyof ParsedCard; label: string }[] = [
      { key: 'name', label: 'Name' },
      { key: 'company', label: 'Company' },
      { key: 'phone', label: 'Phone' },
      { key: 'additionalPhone', label: 'Additional Phone' },
      { key: 'email', label: 'Email' },
      { key: 'website', label: 'Website' },
      { key: 'additionalWebsite', label: 'Additional Website' },
      { key: 'address', label: 'Address' },
    ];

    return (
      <div className="glass-card rounded-xl p-6 space-y-4">
        <h3 className="font-bold text-lg" style={{ color: 'var(--text)' }}>Extracted Information</h3>

        <div className="space-y-3">
          {fields.map(({ key, label }) => {
            const value = parsedData[key];
            if (!value || typeof value === 'object') return null;
            return (
              <div key={key}>
                <label className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>{label}</label>
                <p style={{ color: 'var(--text)' }}>{value}</p>
              </div>
            );
          })}
        </div>

        {renderCategoryPicker()}

        <button
          onClick={saveToStash}
          disabled={isSaving}
          className="w-full px-6 py-3 text-white rounded-xl font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: isSaving ? 'var(--text-muted)' : 'var(--accent)' }}
        >
          {isSaving ? 'Saving...' : 'Save to Stash'}
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Mode Toggle */}
      <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
        <button
          onClick={() => switchMode('card')}
          className="flex-1 px-4 py-2.5 text-sm font-semibold transition-all duration-200"
          style={{
            background: mode === 'card' ? 'var(--accent)' : 'var(--bg-card)',
            color: mode === 'card' ? '#ffffff' : 'var(--text-muted)',
          }}
        >
          📸 Scan Card
        </button>
        <button
          onClick={() => switchMode('qr')}
          className="flex-1 px-4 py-2.5 text-sm font-semibold transition-all duration-200"
          style={{
            background: mode === 'qr' ? 'var(--accent)' : 'var(--bg-card)',
            color: mode === 'qr' ? '#ffffff' : 'var(--text-muted)',
          }}
        >
          QR Code
        </button>
      </div>

      {/* Card Mode */}
      {mode === 'card' && (
        <>
          <div className="upload-area glass-card rounded-xl p-8 text-center">
            {image ? (
              <div className="space-y-4">
                <Image src={image} alt="Business card" width={600} height={400} className="max-w-full h-auto mx-auto rounded-lg" unoptimized />
                <button
                  onClick={resetAll}
                  className="px-4 py-2 rounded-lg font-semibold text-sm transition-colors duration-200"
                  style={{ background: 'var(--border)', color: 'var(--text)' }}
                >
                  Retake
                </button>
              </div>
            ) : (
              <label className="cursor-pointer block">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="space-y-2 py-4">
                  <div className="text-4xl">📸</div>
                  <div className="text-lg font-semibold" style={{ color: 'var(--text)' }}>Scan Business Card</div>
                  <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Tap to take photo or upload</div>
                </div>
              </label>
            )}
          </div>

          {image && !parsedData && (
            <button
              onClick={processCard}
              disabled={isProcessing}
              className="w-full px-6 py-3 text-white rounded-xl font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: isProcessing ? 'var(--text-muted)' : 'var(--accent)' }}
            >
              {isProcessing ? 'Processing...' : 'Process Card →'}
            </button>
          )}

          {extractedText && !parsedData && (
            <div className="glass-card rounded-xl p-4">
              <h3 className="font-semibold text-sm mb-2" style={{ color: 'var(--text)' }}>Raw OCR Text:</h3>
              <pre className="text-xs whitespace-pre-wrap" style={{ color: 'var(--text-muted)' }}>{extractedText}</pre>
            </div>
          )}
        </>
      )}

      {/* QR Mode */}
      {mode === 'qr' && (
        <>
          {!qrDecodedText && !isProcessing && (
            <div className="space-y-4">
              <div className="glass-card rounded-xl overflow-hidden">
                <div
                  id="qr-reader"
                  ref={qrContainerRef}
                  style={{ width: '100%', minHeight: cameraActive ? 300 : 0 }}
                />
                {!cameraActive && (
                  <div className="p-8 text-center space-y-4">
                    <div className="text-4xl">📱</div>
                    <div className="text-lg font-semibold" style={{ color: 'var(--text)' }}>Scan QR Code</div>
                    <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      Use your camera or upload an image
                    </div>
                    <div className="flex gap-3 justify-center pt-2">
                      <button
                        onClick={startCamera}
                        className="px-5 py-2.5 text-white rounded-xl font-semibold text-sm transition-all duration-200"
                        style={{ background: 'var(--accent)' }}
                      >
                        Open Camera
                      </button>
                      <label
                        className="px-5 py-2.5 rounded-xl font-semibold text-sm cursor-pointer transition-all duration-200"
                        style={{ background: 'var(--border)', color: 'var(--text)' }}
                      >
                        Upload Image
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleQrFileUpload}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                )}
                {cameraActive && (
                  <div className="p-3 text-center">
                    <button
                      onClick={stopCamera}
                      className="px-4 py-2 rounded-lg font-semibold text-sm transition-colors duration-200"
                      style={{ background: 'var(--border)', color: 'var(--text)' }}
                    >
                      Stop Camera
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          <div id="qr-reader-hidden" style={{ display: 'none' }} />

          {isProcessing && !parsedData && (
            <div className="glass-card rounded-xl p-8 text-center">
              <div className="text-lg font-semibold" style={{ color: 'var(--text)' }}>Processing QR data...</div>
              <div className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Extracting contact information</div>
            </div>
          )}

          {qrDecodedText && !parsedData && !isProcessing && (
            <div className="glass-card rounded-xl p-4">
              <h3 className="font-semibold text-sm mb-2" style={{ color: 'var(--text)' }}>Decoded QR Text:</h3>
              <pre className="text-xs whitespace-pre-wrap" style={{ color: 'var(--text-muted)' }}>{qrDecodedText}</pre>
              <button
                onClick={resetAll}
                className="mt-3 px-4 py-2 rounded-lg font-semibold text-sm transition-colors duration-200"
                style={{ background: 'var(--border)', color: 'var(--text)' }}
              >
                Try Again
              </button>
            </div>
          )}
        </>
      )}

      {/* Parsed data display (shared) */}
      {parsedData && (
        <>
          {renderParsedData()}
          <button
            onClick={resetAll}
            className="w-full px-4 py-2 rounded-xl font-semibold text-sm transition-colors duration-200"
            style={{ background: 'var(--border)', color: 'var(--text)' }}
          >
            Scan Another
          </button>
        </>
      )}
    </div>
  );
}
