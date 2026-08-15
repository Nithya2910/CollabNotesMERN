import { useState, useEffect } from 'react';
import { uploadAPI } from '../services/api';
import toast from 'react-hot-toast';

/**
 * ImageGalleryModal
 * Shows previously uploaded images and lets the user upload a new one.
 * Calls onInsert(markdownString) when an image is selected.
 */
const ImageGalleryModal = ({ onInsert, onClose }) => {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [tab, setTab] = useState('gallery'); // 'gallery' | 'upload'

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await uploadAPI.getImages();
        // The Java backend returns an array of string URLs. Map them to the object shape the UI needs.
        const mapped = (data.images || []).map(item => {
          if (typeof item === 'string') {
            return { url: item, filename: item.split('/').pop() };
          }
          return item; // Fallback if it's already an object
        });
        setImages(mapped);
      } catch {
        toast.error('Failed to load image gallery');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Only image files are allowed here');
      return;
    }
    setUploading(true);
    const toastId = toast.loading('Uploading image…');
    try {
      const { data } = await uploadAPI.uploadFile(file);
      setImages((prev) => [{ filename: file.name, url: data.url }, ...prev]);
      toast.success('Image uploaded', { id: toastId });
      setTab('gallery');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed', { id: toastId });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleSelect = (img) => {
    const encodedUrl = encodeURI(img.url);
    const md = `![${img.filename}](${encodedUrl})`;
    onInsert(md);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[80vh] overflow-hidden animate-slide-up border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Insert Image</h2>
          <button
            id="gallery-close-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-5 pt-3">
          {['gallery', 'upload'].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all capitalize ${
                tab === t
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {t === 'gallery' ? '🖼 Gallery' : '⬆ Upload New'}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'gallery' ? (
            loading ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="aspect-square rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
                ))}
              </div>
            ) : images.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <div className="text-5xl mb-3">🖼</div>
                <p className="text-sm">No images uploaded yet.</p>
                <button
                  onClick={() => setTab('upload')}
                  className="mt-3 text-brand-600 dark:text-brand-400 text-sm font-medium hover:underline"
                >
                  Upload your first image →
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {images.map((img) => (
                  <button
                    key={img.url}
                    onClick={() => handleSelect(img)}
                    className="group aspect-square rounded-xl overflow-hidden border-2 border-transparent
                               hover:border-brand-500 transition-all focus:outline-none focus:border-brand-600 relative"
                  >
                    <img
                      src={img.url}
                      alt={img.filename}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <svg className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                  </button>
                ))}
              </div>
            )
          ) : (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <div className="w-24 h-24 rounded-2xl bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center">
                <svg className="w-10 h-10 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="text-center">
                <p className="font-medium text-gray-800 dark:text-white mb-1">Upload an image</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">JPEG, PNG, GIF, WebP — up to 10 MB</p>
              </div>
              <label
                htmlFor="gallery-upload-input"
                className={`btn-primary cursor-pointer ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
              >
                {uploading ? 'Uploading…' : 'Choose File'}
              </label>
              <input
                id="gallery-upload-input"
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={handleUpload}
                className="hidden"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImageGalleryModal;
