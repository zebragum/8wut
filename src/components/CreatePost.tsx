import { useState, useRef } from 'react';
import { createPost } from '../api/posts';
import { uploadImage } from '../api/users';
import toast from 'react-hot-toast';

type ColorPreset = 'transparent' | 'skyblue' | 'lavender' | 'orange';

const bgStyles: Record<ColorPreset, React.CSSProperties> = {
  transparent: { backgroundColor: 'rgba(0,0,0,0.4)' },
  skyblue: { backgroundColor: 'var(--color-skyblue)' },
  lavender: { backgroundColor: 'var(--color-lavender)' },
  orange: { border: '1px solid rgba(255,255,255,0.2)', backgroundColor: 'var(--color-orange)' },
};

export default function CreatePost() {
  const [caption, setCaption] = useState('');
  const [images, setImages] = useState<string[]>([]);      // Cloudinary URLs
  const [previews, setPreviews] = useState<string[]>([]);  // Local blob URLs for preview
  const [bgColor, setBgColor] = useState<ColorPreset>('skyblue');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    if (images.length + files.length > 5) {
      toast.error('Max 5 images per post');
      return;
    }
    setUploading(true);
    const toastId = toast.loading(`Uploading ${files.length} image${files.length > 1 ? 's' : ''}...`);
    try {
      const uploaded = await Promise.all(files.map(f => uploadImage(f)));
      const localPreviews = files.map(f => URL.createObjectURL(f));
      setImages(prev => [...prev, ...uploaded]);
      setPreviews(prev => [...prev, ...localPreviews]);
      toast.success('Images uploaded!', { id: toastId });
    } catch {
      toast.error('Upload failed. Try again.', { id: toastId });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const removeImage = (idx: number) => {
    setImages(prev => prev.filter((_, i) => i !== idx));
    setPreviews(prev => { URL.revokeObjectURL(prev[idx]); return prev.filter((_, i) => i !== idx); });
  };

  const handleShare = async () => {
    if (submitting) return;
    if (!images.length && !caption.trim()) {
      toast.error('Add a photo or write something!');
      return;
    }

    setSubmitting(true);
    const toastId = toast.loading('Sharing...');
    try {
      await createPost({
        caption: caption.trim(),
        images: images.length ? images : undefined,
        textBackground: images.length ? undefined : bgColor,
      });
      toast.success('Posted! 🎉', { id: toastId });
      // Navigate back to feed
      window.dispatchEvent(new CustomEvent('navigate', { detail: 'feed' }));
    } catch {
      toast.error('Could not post. Try again.', { id: toastId });
    } finally {
      setSubmitting(false);
    }
  };

  const hasImages = images.length > 0;

  return (
    <div className="create-post-view" style={{ display: 'flex', flexDirection: 'column', height: '100%', paddingTop: '20px' }}>
      {/* Image previews or text editor */}
      {hasImages ? (
        <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden' }}>
          <img src={previews[0]} alt="Preview" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover' }} />
          <button
            onClick={() => removeImage(0)}
            style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', fontSize: '1rem', zIndex: 10 }}
          >✕</button>
          {previews.length > 1 && (
            <div style={{ display: 'flex', gap: '4px', padding: '4px', flexWrap: 'wrap', background: 'rgba(0,0,0,0.3)' }}>
              {previews.slice(1).map((src, i) => (
                <div key={i} style={{ position: 'relative' }}>
                  <img src={src} alt={`${i+2}`} style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '6px' }} />
                  <button
                    onClick={() => removeImage(i + 1)}
                    style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.7)', color: 'white', border: 'none', borderRadius: '50%', width: 18, height: 18, cursor: 'pointer', fontSize: '0.7rem', lineHeight: 1 }}
                  >✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div
          className="text-post-preview"
          style={{ ...bgStyles[bgColor], transition: 'background 0.3s ease', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', aspectRatio: '1 / 1', overflow: 'hidden' }}
        >
          <textarea
            className="text-post-input"
            placeholder="Type your post..."
            value={caption}
            onChange={e => setCaption(e.target.value)}
            style={{
              width: '100%', padding: '24px', fontSize: '1.5rem',
              textAlign: 'center', fontFamily: 'inherit', resize: 'none',
              background: 'transparent', border: 'none', color: 'white',
              height: 'auto', minHeight: '80px', lineHeight: '1.5', outline: 'none'
            }}
            rows={3}
          />
        </div>
      )}

      {/* Color palette OR caption box */}
      {hasImages ? (
        <div className="caption-input" style={{ marginTop: '12px' }}>
          <textarea
            placeholder="Write a caption..."
            value={caption}
            onChange={e => setCaption(e.target.value)}
            rows={2}
            style={{ borderRadius: '8px', width: '100%', padding: '12px', background: 'rgba(0,0,0,0.6)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', fontFamily: 'inherit', fontSize: '1rem', resize: 'none', outline: 'none' }}
          />
        </div>
      ) : (
        <div className="color-palette" style={{ marginTop: '20px', display: 'flex', gap: '12px', flexWrap: 'nowrap', justifyContent: 'center', width: '100%', padding: '8px 0' }}>
          {(['transparent', 'skyblue', 'orange', 'lavender'] as ColorPreset[]).map(color => (
            <button
              key={color}
              style={{
                ...bgStyles[color],
                width: bgColor === color ? '48px' : '40px',
                height: bgColor === color ? '48px' : '40px',
                borderRadius: '50%', flexShrink: 0,
                border: bgColor === color ? 'none' : '2px solid white',
                boxShadow: bgColor === color ? '0 0 0 3px white inset, 0 4px 12px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.2)',
                transition: 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                cursor: 'pointer'
              }}
              onClick={() => setBgColor(color)}
            />
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="create-actions" style={{ flex: 1, marginTop: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-evenly', width: '100%' }}>
        {/* Camera button */}
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <button
            className="btn-camera"
            style={{
              width: '80px', height: '80px', borderRadius: '50%',
              background: uploading ? 'rgba(206,147,216,0.5)' : 'var(--color-lavender)',
              border: '2px solid white', color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: uploading ? 'wait' : 'pointer',
              boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
              transition: 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
            }}
            onClick={() => !uploading && fileRef.current?.click()}
          >
            {uploading ? (
              <div style={{ width: '24px', height: '24px', border: '3px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            ) : (
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                <circle cx="12" cy="13" r="3" />
              </svg>
            )}
          </button>
          {hasImages && images.length < 5 && (
            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem' }}>
              +{5 - images.length} more
            </span>
          )}
        </div>

        <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleFileChange} />

        <button
          onClick={handleShare}
          disabled={submitting || uploading}
          style={{
            padding: '16px 80px', borderRadius: '32px',
            background: (submitting || uploading) ? 'rgba(255,183,77,0.5)' : 'var(--color-orange)',
            border: 'none', color: 'white', fontWeight: 'bold', fontSize: '1.4rem',
            cursor: (submitting || uploading) ? 'wait' : 'pointer',
            boxShadow: '0 6px 16px rgba(0,0,0,0.2)',
            textAlign: 'center', width: '100%', maxWidth: '300px',
            fontFamily: 'inherit', transition: 'all 0.2s ease'
          }}
        >
          {submitting ? 'Posting...' : 'Share'}
        </button>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
