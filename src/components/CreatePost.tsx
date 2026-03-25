import { useState, useRef, useCallback } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import getCroppedImg from '../utils/cropImage';
import { createPost } from '../api/posts';
import { uploadImage } from '../api/users';
import toast from 'react-hot-toast';
import { createPortal } from 'react-dom';

type ColorPreset = 'transparent' | 'skyblue' | 'lavender' | 'orange';

const colors: ColorPreset[] = ['transparent', 'skyblue', 'orange', 'lavender'];

export default function CreatePost() {
  const [caption, setCaption] = useState('');
  const [bgColor, setBgColor] = useState<ColorPreset>('skyblue');
  
  const [scope, setScope] = useState<'everyone' | 'private'>('everyone');
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

  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);


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
      if (cameraRef.current) cameraRef.current.value = '';
      if (galleryRef.current) galleryRef.current.value = '';
    }
  };

  const handleCancelCrop = () => {
    setRawFiles([]);
    setCropIndex(-1);
    if (cameraRef.current) cameraRef.current.value = '';
    if (galleryRef.current) galleryRef.current.value = '';
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
        textBackground: bgColor,
        scope,
        created_at: new Date(customDate).toISOString()
      } as any); // cast since api type might not reflect the updated private scope immediately
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
    <div className="create-post-view" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '12px 16px 80px 16px', overflowY: 'auto' }}>
      
      {/* 1. Dynamic Image Area / Preview */}
      {isCropping ? (
        <div style={{ position: 'relative', width: '100%', aspectRatio: '1', borderRadius: '12px', overflow: 'hidden', background: 'rgba(0,0,0,0.4)', marginBottom: '16px', filter: 'saturate(1.3)' }}>
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
        <div style={{ position: 'relative', width: '100%', aspectRatio: '1', borderRadius: '12px', overflow: 'hidden', border: `3px solid var(--color-${bgColor})`, marginBottom: '12px' }}>
          <img src={images[0]} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <button
            onClick={() => removeImage(0)}
            style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', fontSize: '1rem', zIndex: 10 }}
          >✕</button>
          
          {/* Add Image (+) button moved here */}
          <button
            onClick={() => galleryRef.current?.click()}
            style={{ 
              position: 'absolute', bottom: 12, right: 12,
              background: 'var(--color-lavender)', color: 'white', border: 'none', borderRadius: '50%', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)', zIndex: 20
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>

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

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%' }}>
        
        {isCropping ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
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
                {uploading ? 'Processing...' : 'Crop'}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}>
            
            {/* FLEX SPACER: Dynamically eats all remaining top space, pushing EVERYTHING below to the bottom */}
            <div style={{ flex: 1, minHeight: '20px' }} />
            
            {/* 2. CAMERA AND GALLERY BUTTONS */}
            {!hasImages && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', width: '100%', paddingBottom: '4px' }}>
                  <button
                    className="btn-camera"
                    style={{
                      width: '90px', height: '90px', borderRadius: '50%',
                      background: 'var(--color-lavender)',
                      border: 'none',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px',
                      cursor: 'pointer',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                      transition: 'transform 0.2s',
                      opacity: uploading ? 0.5 : 1,
                      color: 'white', fontWeight: 'bold', fontSize: '0.9rem'
                    }}
                    onClick={() => cameraRef.current?.click()}
                    disabled={uploading}
                  >
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                      <circle cx="12" cy="13" r="4"></circle>
                    </svg>
                    Camera
                  </button>

                  <button
                    className="btn-gallery"
                    style={{
                      width: '90px', height: '90px', borderRadius: '50%',
                      background: 'var(--color-skyblue)',
                      border: 'none',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px',
                      cursor: 'pointer',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                      transition: 'transform 0.2s',
                      opacity: uploading ? 0.5 : 1,
                      color: 'white', fontWeight: 'bold', fontSize: '0.9rem'
                    }}
                    onClick={() => galleryRef.current?.click()}
                    disabled={uploading}
                  >
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                      <circle cx="8.5" cy="8.5" r="1.5"></circle>
                      <polyline points="21 15 16 10 5 21"></polyline>
                    </svg>
                    Gallery
                  </button>
                </div>
            )}
            
            {/* 3. BUNDLED CONTROLS AT BOTTOM */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '16px' }}>
              
              <textarea
                className="caption-input"
                placeholder="Write a caption..."
                value={caption}
                onChange={e => setCaption(e.target.value)}
                style={{
                  borderRadius: '12px', width: '100%', minHeight: '80px',
                  padding: '12px', background: 'rgba(0,0,0,0.6)', color: 'white',
                  border: 'none', fontFamily: 'inherit', fontSize: '1.1rem',
                  resize: 'none', outline: 'none'
                }}
              />

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'center' }}>
                {/* Color Palette - ONLY if no images */}
                {!hasImages && (
                  <div style={{ display: 'flex', gap: '10px' }}>
                    {colors.map(color => (
                      <button
                        key={color}
                        style={{
                          backgroundColor: `var(--color-${color})`,
                          width: bgColor === color ? '32px' : '26px',
                          height: bgColor === color ? '32px' : '26px',
                          borderRadius: '50%', flexShrink: 0,
                          border: color === 'transparent' ? '1px solid rgba(255,255,255,0.5)' : 'none',
                          boxShadow: bgColor === color ? '0 0 0 2px white inset' : 'none',
                          cursor: 'pointer'
                        }}
                        onClick={() => setBgColor(color)}
                      />
                    ))}
                  </div>
                )}

                {/* Scope Toggle - CENTERED */}
                <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', borderRadius: '16px', padding: '3px', margin: '0 auto' }}>
                  {(['everyone', 'private'] as const).map(s => (
                    <button 
                      key={s}
                      type="button"
                      onClick={() => {
                        setScope(s);
                        if (s === 'private' && localStorage.getItem('8wut_seenPrivateTutorial') !== 'true') {
                          alert('Private posts only show on your profile');
                          localStorage.setItem('8wut_seenPrivateTutorial', 'true');
                        }
                      }}
                      style={{ 
                        padding: '4px 16px', borderRadius: '14px', border: 'none', 
                        background: scope === s ? 'var(--color-orange)' : 'transparent',
                        color: 'white', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.85rem'
                      }}
                    >
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Multi-Topic Selection (only if scope is groups) */}

              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <input 
                  type="datetime-local"
                  value={customDate}
                  onChange={e => setCustomDate(e.target.value)}
                  style={{
                    background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px', padding: '6px 10px', color: 'white', fontFamily: 'inherit', fontSize: '0.8rem'
                  }}
                />
              </div>

            </div>
            
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" multiple style={{ display: 'none' }} onChange={handleFileChange} />
            <input ref={galleryRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleFileChange} />

            {/* Fixed Share Button Centered Bottom, Portaled to escape transform traps */}
            {createPortal(
              <button
                onClick={handleShare}
                disabled={submitting}
                style={{
                  position: 'fixed',
                  bottom: 'calc(max(env(safe-area-inset-bottom, 12px), 16px) + 0px)',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  zIndex: 9999,
                  width: '56px', height: '56px',
                  background: 'var(--color-orange)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: 'none', borderRadius: '50%', cursor: submitting ? 'wait' : 'pointer',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                  transition: 'transform 0.2s',
                  opacity: submitting ? 0.7 : 1
                }}
              >
                {submitting ? (
                  <div style={{ width: '24px', height: '24px', border: '3px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                ) : (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill={hasImages ? "red" : "white"} className={hasImages ? "rainbow-strobe-filter" : ""} style={{ marginLeft: '4px' }}>
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                  </svg>
                )}
              </button>,
              document.body
            )}
          </div>
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
