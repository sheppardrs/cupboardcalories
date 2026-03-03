'use client';

import { useState, useRef } from 'react';
import { processNutritionLabel, ExtractedNutrition } from '@/lib/ocr';

interface ImageUploaderProps {
  onExtracted: (data: ExtractedNutrition) => void;
}

export function ImageUploader({ onExtracted }: ImageUploaderProps) {
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPreview(URL.createObjectURL(file));
    setError(null);
    setProcessing(true);

    try {
      const { nutrition } = await processNutritionLabel(file);
      onExtracted(nutrition);
    } catch (err) {
      console.error('OCR error:', err);
      setError('Failed to extract nutrition data. Please enter manually.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
      
      {preview ? (
        <div className="mb-4">
          <img src={preview} alt="Preview" className="max-h-48 mx-auto rounded" />
        </div>
      ) : (
        <div className="mb-4">
          <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
            <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}
      
      {processing ? (
        <p className="text-blue-600">Processing image...</p>
      ) : error ? (
        <div>
          <p className="text-red-600 mb-2">{error}</p>
          <button
            onClick={() => {
              setPreview(null);
              setError(null);
              if (fileInputRef.current) fileInputRef.current.value = '';
            }}
            className="text-blue-600 hover:underline"
          >
            Try again
          </button>
        </div>
      ) : (
        <button
          onClick={() => fileInputRef.current?.click()}
          className="text-blue-600 hover:underline"
        >
          {preview ? 'Choose different image' : 'Upload nutrition label image'}
        </button>
      )}
      
      <p className="text-xs text-gray-500 mt-2">
        Takes a photo of the nutrition facts label to auto-fill values
      </p>
    </div>
  );
}
