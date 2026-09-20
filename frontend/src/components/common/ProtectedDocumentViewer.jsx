import React, { useState, useEffect } from 'react';
import { X, FileText, Download, Loader2, AlertCircle } from 'lucide-react';

export default function ProtectedDocumentViewer({ document, onClose }) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const docUrl = document?.url || document?.fileUrl;
  const fileName = document?.name || document?.filename || 'Document';

  useEffect(() => {
    let isMounted = true;
    let objectUrl = null;

    const fetchDocument = async () => {
      if (!docUrl || docUrl === '#') {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        const token = localStorage.getItem('token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        const response = await fetch(docUrl, { headers });
        if (!response.ok) {
          throw new Error('Failed to load protected document');
        }

        const blob = await response.blob();
        if (isMounted) {
          objectUrl = URL.createObjectURL(blob);
          setBlobUrl(objectUrl);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Error fetching document');
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchDocument();

    return () => {
      isMounted = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [docUrl]);

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-3xl w-full h-[80vh] flex flex-col border border-slate-200 shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-900 truncate max-w-md">{fileName}</h3>
          </div>
          <div className="flex items-center gap-2">
            {blobUrl && (
              <a
                href={blobUrl}
                download={fileName}
                className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-600 transition-colors"
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
              <Loader2 className="w-7 h-7 animate-spin text-emerald-600" />
              <p className="text-xs font-medium">Fetching secure document...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-2 text-rose-600 text-center max-w-sm">
              <AlertCircle className="w-8 h-8" />
              <p className="text-xs font-semibold">{error}</p>
            </div>
          ) : blobUrl ? (
            <iframe
              src={blobUrl}
              title={fileName}
              className="w-full h-full rounded-lg border border-slate-200 bg-white"
            />
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