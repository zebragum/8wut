export default function Logo({ className = "", width = 80, height = 80 }: { className?: string; width?: number | string; height?: number | string }) {
  return (
    <img 
      src="/8logo.svg" 
      alt="8wut Logo" 
      className={className} 
      style={{ width: `${width}px`, height: `${height}px`, objectFit: 'contain' }} 
    />
  );
}
