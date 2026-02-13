'use client';

import { useState } from 'react';
import Tesseract from 'tesseract.js';
import { supabase } from '@/lib/supabase';
import Image from 'next/image';

interface ParsedCard {
  name: string;
  company: string;
  phone: string;
  email: string;
  website: string;
  additionalWebsites: string[];
  address: string;
  socialMedia: {
    facebook?: string;
    instagram?: string;
    linkedin?: string;
  };
}

export default function CardScanner() {
  const [image, setImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [extractedText, setExtractedText] = useState<string>('');
  const [parsedData, setParsedData] = useState<ParsedCard | null>(null);

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
      console.log('Extracted text:', text);

      const response = await fetch('/api/parse-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        throw new Error('Failed to parse card');
      }

      const parsed = await response.json();
      setParsedData(parsed);
      console.log('Parsed data:', parsed);

    } catch (error) {
      console.error('Processing Error:', error);
      alert('Failed to process image. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

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
            email: parsedData.email || null,
            website: parsedData.website || null,
            additional_websites: parsedData.additionalWebsites || null,
            address: parsedData.address || null,
            social_media: parsedData.socialMedia || null,
            card_image_url: image, // Save the base64 image for now
          }
        ])
        .select();

      if (error) throw error;

      console.log('Saved:', data);
      alert('Saved to Stash! 🎉');
      
      // Reset form
      setImage(null);
      setParsedData(null);
      setExtractedText('');
      
      // Optionally navigate to a list view (we'll build this next)
      // router.push('/businesses');
      
    } catch (error) {
      console.error('Save error:', error);
      alert('Failed to save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
        {image ? (
          <div className="space-y-4">
            <Image src={image} alt="Business card" width={600} height={400} className="max-w-full h-auto mx-auto rounded" unoptimized />
            <button
              onClick={() => {
                setImage(null);
                setExtractedText('');
                setParsedData(null);
              }}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              Retake
            </button>
          </div>
        ) : (
          <label className="cursor-pointer">
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="space-y-2">
              <div className="text-4xl">📸</div>
              <div className="text-lg font-semibold">Scan Business Card</div>
              <div className="text-sm text-gray-500">Tap to take photo or upload</div>
            </div>
          </label>
        )}
      </div>
      
      {image && !parsedData && (
        <button 
          onClick={processCard}
          disabled={isProcessing}
          className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isProcessing ? 'Processing...' : 'Process Card →'}
        </button>
      )}

      {extractedText && !parsedData && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h3 className="font-semibold text-sm mb-2">Raw OCR Text:</h3>
          <pre className="text-xs whitespace-pre-wrap">{extractedText}</pre>
        </div>
      )}

      {parsedData && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
          <h3 className="font-bold text-lg">Extracted Information</h3>
          
          <div className="space-y-3">
            {parsedData.name && (
              <div>
                <label className="text-sm font-semibold text-gray-600">Name</label>
                <p className="text-gray-900">{parsedData.name}</p>
              </div>
            )}
            
            {parsedData.company && (
              <div>
                <label className="text-sm font-semibold text-gray-600">Company</label>
                <p className="text-gray-900">{parsedData.company}</p>
              </div>
            )}
            
            {parsedData.phone && (
              <div>
                <label className="text-sm font-semibold text-gray-600">Phone</label>
                <p className="text-gray-900">{parsedData.phone}</p>
              </div>
            )}
            
            {parsedData.email && (
              <div>
                <label className="text-sm font-semibold text-gray-600">Email</label>
                <p className="text-gray-900">{parsedData.email}</p>
              </div>
            )}
            
            {parsedData.website && (
              <div>
                <label className="text-sm font-semibold text-gray-600">Website</label>
                <p className="text-gray-900">{parsedData.website}</p>
              </div>
            )}
            
            {parsedData.additionalWebsites && parsedData.additionalWebsites.length > 0 && (
              <div>
                <label className="text-sm font-semibold text-gray-600">Additional Websites</label>
                {parsedData.additionalWebsites.map((url, i) => (
                  <p key={i} className="text-gray-900">{url}</p>
                ))}
              </div>
            )}
            
            {parsedData.address && (
              <div>
                <label className="text-sm font-semibold text-gray-600">Address</label>
                <p className="text-gray-900">{parsedData.address}</p>
              </div>
            )}
          </div>

          <button 
            onClick={saveToStash}
            disabled={isSaving}
            className="w-full px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Saving...' : 'Save to Stash'}
          </button>
        </div>
      )}
    </div>
  );
}