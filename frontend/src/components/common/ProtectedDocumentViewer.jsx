import React, { useState, useEffect } from 'react';
import { X, FileText, Download, Loader2, AlertCircle } from 'lucide-react';

export default function ProtectedDocumentViewer({ document: doc, onClose }) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [fileType, setFileType] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Safely extract filename and raw URL/path from various backend models
  const fileName = doc?.name || doc?.filename || doc?.originalName || 'Document';
  const rawPath = typeof doc === 'string' ? doc : (doc?.url || doc?.fileUrl || doc?.path || doc?.filepath);

  useEffect(() => {
    let isMounted = true;
    let activeObjectUrl = null;

    const fetchDocument = async () => {
      if (!rawPath || rawPath === '#') {
        setIsLoading(false);
        setError('No valid file path or URL provided for this document.');
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const token = localStorage.getItem('token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        // Resolve path to full absolute URL if relative
        const targetUrl = rawPath.startsWith('http')
          ? rawPath
          : `${window.location.origin}${rawPath.startsWith('/') ? '' : '/'}${rawPath}`;

        const response = await fetch(targetUrl, { headers });

        if (!response.ok) {
          throw new Error(`Failed to load document (HTTP ${response.status})`);
        }

        const blob = await response.blob();

        if (isMounted) {
          activeObjectUrl = URL.createObjectURL(blob);
          setBlobUrl(activeObjectUrl);
          setFileType(blob.type);
        }
      } catch (err) {
        if (isMounted) {
          console.error('Protected Document Fetch Error:', err);
          setError(err.message || 'Error fetching document');
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchDocument();

    return () => {
      isMounted = false;
      if (activeObjectUrl) {
        URL.revokeObjectURL(activeObjectUrl);
      }
    };
  }, [rawPath]);

  const isImage = fileType.startsWith('image/');

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-4xl w-full h-[85vh] flex flex-col border border-slate-200 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2 truncate pr-4">
            <FileText className="w-5 h-5 text-emerald-700 shrink-0" />
            <h3 className="text-sm font-bold text-slate-900 truncate">{fileName}</h3>
          </div>
          
          <div className="flex items-center gap-2 shrink-0">
            {blobUrl && (
              <a
                href={blobUrl}
                download={fileName}
                className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-600 transition-colors cursor-pointer"
                title="Download Document"
              >
                <Download className="w-4 h-4" />
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Viewer Body */}
        <div className="flex-1 bg-slate-100 flex items-center justify-center p-4 overflow-auto">
          {isLoading ? (
            <div className="flex flex-col items-center gap-2 text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
              <p className="text-xs font-semibold">Fetching secure document...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-2 text-rose-600 text-center max-w-sm bg-white p-6 rounded-2xl border border-rose-100 shadow-xs">
              <AlertCircle className="w-8 h-8 text-rose-500" />
              <p className="text-xs font-semibold">{error}</p>
            </div>
          ) : blobUrl ? (
            isImage ? (
              <div className="w-full h-full flex items-center justify-center overflow-auto p-2">
                <img
                  src={blobUrl}
                  alt={fileName}
                  className="max-w-full max-h-full object-contain rounded-lg shadow-xs"
                />
              </div>
            ) : (
              <iframe
                src={blobUrl}
                title={fileName}
                className="w-full h-full rounded-xl border border-slate-200 bg-white"
              />
            )
          ) : (
            <div className="flex flex-col items-center gap-2 text-slate-500 text-center p-6 bg-white rounded-xl border border-slate-200">
              <FileText className="w-10 h-10 text-slate-400" />
              <p className="text-xs font-bold text-slate-700">{fileName}</p>
              <p className="text-[11px] text-slate-400">No URL available to render document stream preview.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}