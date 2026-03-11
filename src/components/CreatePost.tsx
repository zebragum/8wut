import { useState, useRef, useCallback } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import getCroppedImg from '../utils/cropImage';
import { createPost } from '../api/posts';
import { uploadImage } from '../api/users';
import toast from 'react-hot-toast';
import { createPortal } from 'react-dom';
import { useAuth } from '../AuthContext';

type ColorPreset = 'transparent' | 'skyblue' | 'lavender' | 'orange';

const colors: ColorPreset[] = ['transparent', 'skyblue', 'orange', 'lavender'];

export default function CreatePost() {
  const { currentUser } = useAuth();
  const [caption, setCaption] = useState('');
  const [bgColor, setBgColor] = useState<ColorPreset>('skyblue');
  
  const [scope, setScope] = useState<'everyone' | 'friends' | 'groups'>(
    currentUser?.topics && currentUser.topics.length > 0 ? 'groups' : 'everyone'
  );
  const [customDate, setCustomDate] = useState(
    new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 16)
  );

  const [images, setImages] = useState<string[]>([]);
  
  const [rawFiles, setRawFiles] = useState<File[]>([]);
  const [cropIndex, setCropIndex] = useState(-1);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    if (images.length + files.length > 5) {
      toast.error('Max 5 images per post');
      return;
    }
    setRawFiles(files);
    setCropIndex(0);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  };

  const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleApplyCrop = async () => {
    if (cropIndex < 0 || !rawFiles[cropIndex] || !croppedAreaPixels) return;
    setUploading(true);
    const toastId = toast.loading('Applying crop...');
    try {
      const fileUrl = URL.createObjectURL(rawFiles[cropIndex]);
      const croppedFile = await getCroppedImg(fileUrl, croppedAreaPixels);
      URL.revokeObjectURL(fileUrl);
      
      if (!croppedFile) throw new Error('Failed to crop');
      
      const uploadedUrl = await uploadImage(croppedFile);
      setImages(prev => [...prev, uploadedUrl]);
      
      toast.success('Added image', { id: toastId });
      
      if (cropIndex + 1 < rawFiles.length) {
        setCropIndex(cropIndex + 1);
        setCrop({ x: 0, y: 0 });
        setZoom(1);
      } else {
        setRawFiles([]);
        setCropIndex(-1);
      }
    } catch {
      toast.error('Failed to crop/upload image', { id: toastId });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleCancelCrop = () => {
    setRawFiles([]);
    setCropIndex(-1);
    if (fileRef.current) fileRef.current.value = '';
  };

  const removeImage = (idx: number) => {
    setImages(prev => prev.filter((_, i) => i !== idx));
  };

  const handleShare = async () => {
    if (submitting || uploading) return;
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
        textBackground: bgColor, // This dictates feed text bg OR feed image border color
        scope,
        created_at: new Date(customDate).toISOString()
      });
      toast.success('Posted! 🎉', { id: toastId });
      window.dispatchEvent(new CustomEvent('navigate', { detail: 'feed' }));
    } catch {
      toast.error('Could not post. Try again.', { id: toastId });
    } finally {
      setSubmitting(false);
    }
  };

  const hasImages = images.length > 0;
  const isCropping = cropIndex >= 0;

  return (
    <div className="create-post-view" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '20px 20px 80px 20px', overflowY: 'auto' }}>
      
      {/* Dynamic Image Area */}
      {isCropping ? (
        <div style={{ position: 'relative', width: '100%', aspectRatio: '1', borderRadius: '12px', overflow: 'hidden', background: 'rgba(0,0,0,0.4)', marginBottom: '16px' }}>
          <Cropper
            image={URL.createObjectURL(rawFiles[cropIndex])}
            crop={crop}
            zoom={zoom}
            aspect={1}
            onCropChange={setCrop}
            onCropComplete={onCropComplete}
            onZoomChange={setZoom}
          />
        </div>
      ) : hasImages ? (
        <div style={{ position: 'relative', width: '100%', aspectRatio: '1', borderRadius: '12px', overflow: 'hidden', border: `3px solid var(--color-${bgColor})`, marginBottom: '16px' }}>
          <img src={images[0]} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <button
            onClick={() => removeImage(0)}
            style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', fontSize: '1rem', zIndex: 10 }}
          >✕</button>
          {images.length > 1 && (
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', gap: '4px', padding: '4px', flexWrap: 'nowrap', background: 'rgba(0,0,0,0.6)', overflowX: 'auto' }}>
              {images.slice(1).map((src, i) => (
                <div key={i} style={{ position: 'relative', flexShrink: 0 }}>
                  <img src={src} alt={`${i+2}`} style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '6px' }} />
                  <button
                    onClick={() => removeImage(i + 1)}
                    style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.8)', color: 'white', border: 'none', borderRadius: '50%', width: 18, height: 18, cursor: 'pointer', fontSize: '0.7rem', lineHeight: 1 }}
                  >✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {/* Input Controls */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
        
        {isCropping ? (
          <>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem', margin: '0 0 12px 0' }}>
              {rawFiles.length > 1 ? `Crop image ${cropIndex + 1} of ${rawFiles.length}` : 'Drag to crop'}
            </p>
            <div style={{ display: 'flex', gap: '12px', width: '100%', maxWidth: '300px' }}>
              <button
                onClick={handleCancelCrop}
                disabled={uploading}
                style={{ flex: 1, padding: '12px', borderRadius: '8px', background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', fontWeight: 'bold' }}
              >
                Cancel
              </button>
              <button
                onClick={handleApplyCrop}
                disabled={uploading}
                style={{ flex: 1, padding: '12px', borderRadius: '8px', background: 'var(--color-skyblue)', border: 'none', color: 'white', fontWeight: 'bold' }}
              >
                {uploading ? 'Processing...' : 'Apply Format'}
              </button>
            </div>
          </>
        ) : (
          <>
            {/* The single unified caption input */}
            <textarea
              className="caption-input"
              placeholder="Write a caption..."
              value={caption}
              onChange={e => setCaption(e.target.value)}
              style={{
                borderRadius: '12px', width: '100%', minHeight: '100px',
                padding: '16px', background: 'rgba(0,0,0,0.6)', color: 'white',
                border: 'none', fontFamily: 'inherit', fontSize: '1.2rem',
                resize: 'none', outline: 'none'
              }}
            />

            {/* Color Palette (Always visible to choose feed text bg OR feed image border) */}
            <div className="color-palette" style={{ display: 'flex', gap: '16px', justifyContent: 'center', width: '100%', marginTop: '24px' }}>
              {colors.map(color => (
                <button
                  key={color}
                  style={{
                    backgroundColor: `var(--color-${color})`,
                    width: bgColor === color ? '44px' : '36px',
                    height: bgColor === color ? '44px' : '36px',
                    borderRadius: '50%', flexShrink: 0,
                    border: color === 'transparent' ? '1.5px solid rgba(255,255,255,0.7)' : 'none',
                    boxShadow: bgColor === color ? '0 0 0 3px white inset, 0 4px 12px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.2)',
                    transition: 'all 0.2s ease',
                    cursor: 'pointer'
                  }}
                  onClick={() => setBgColor(color)}
                />
              ))}
            </div>

            {/* 3-way Privacy Toggle */}
            <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', borderRadius: '20px', padding: '4px', marginTop: '24px' }}>
              <button 
                type="button"
                onClick={() => setScope('everyone')}
                style={{ 
                  padding: '6px 16px', borderRadius: '16px', border: 'none', 
                  background: scope === 'everyone' ? 'var(--color-orange)' : 'transparent',
                  color: 'white', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.9rem'
                }}
              >
                Everyone
              </button>
              <button 
                type="button"
                onClick={() => setScope('friends')}
                style={{ 
                  padding: '6px 16px', borderRadius: '16px', border: 'none', 
                  background: scope === 'friends' ? 'var(--color-orange)' : 'transparent',
                  color: 'white', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.9rem'
                }}
              >
                Friends
              </button>
              <button 
                type="button"
                onClick={() => setScope('groups')}
                style={{ 
                  padding: '6px 16px', borderRadius: '16px', border: 'none', 
                  background: scope === 'groups' ? 'var(--color-orange)' : 'transparent',
                  color: 'white', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.9rem'
                }}
              >
                Groups
              </button>
            </div>

            {/* Custom Timestamp */}
            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <label style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem' }}>Post Timestamp</label>
              <input 
                type="datetime-local"
                value={customDate}
                onChange={e => setCustomDate(e.target.value)}
                style={{
                  background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px', padding: '8px 12px', color: 'white', fontFamily: 'inherit'
                }}
              />
            </div>

            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', minHeight: '120px' }}>
              {/* BIG Central Camera Button */}
              <button
                className="btn-camera"
                style={{
                  width: '100px', height: '100px', borderRadius: '50%',
                  background: 'var(--color-lavender)',
                  border: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                  transition: 'transform 0.2s',
                  opacity: uploading ? 0.5 : 1
                }}
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                {/* Camera Aperture SVG */}
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="14.31" y1="8" x2="20.05" y2="17.94" />
                  <line x1="9.69" y1="8" x2="21.17" y2="8" />
                  <line x1="7.38" y1="12" x2="13.12" y2="2.06" />
                  <line x1="9.69" y1="16" x2="3.95" y2="6.06" />
                  <line x1="14.31" y1="16" x2="2.83" y2="16" />
                  <line x1="16.62" y1="12" x2="10.88" y2="21.94" />
                </svg>
              </button>
            </div>
            
            <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple style={{ display: 'none' }} onChange={handleFileChange} />

            {/* Fixed Share Button Centered Bottom, Portaled to escape transform traps */}
            {createPortal(
              <button
                onClick={handleShare}
                disabled={submitting}
                style={{
                  position: 'fixed',
                  bottom: 'calc(max(env(safe-area-inset-bottom, 12px), 16px) + 0px)', // + 0px so it perfectly overlays the 50x50 button spot in BottomNav (whose bottom padding pushes items up exactly this much)
                  left: '50%',
                  transform: 'translateX(-50%)',
                  zIndex: 9999,
                  width: '50px', height: '50px',
                  background: 'var(--color-orange)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: 'none', borderRadius: '50%', cursor: submitting ? 'wait' : 'pointer',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                  transition: 'transform 0.2s',
                  opacity: submitting ? 0.7 : 1
                }}
              >
                {submitting ? (
                  <div style={{ width: '24px', height: '24px', border: '3px solid #388e3c', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                ) : (
                  <svg width="26" height="26" viewBox="0 0 24 24" fill={hasImages ? "red" : "#388e3c"} className={hasImages ? "rainbow-strobe-filter" : ""} style={{ marginLeft: '4px' }}>
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                  </svg>
                )}
              </button>,
              document.body
            )}
          </>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes hueRotate { to { filter: hue-rotate(360deg) brightness(1.5) saturate(2); } }
        .rainbow-strobe-filter {
          animation: hueRotate 0.3s linear infinite;
        }
      `}</style>
    </div>
  );
}
