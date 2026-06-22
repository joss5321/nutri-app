export function getYouTubeEmbedId(url: string): string | null {
  const patterns = [
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]+)/,
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/,
    /youtu\.be\/([a-zA-Z0-9_-]+)/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]+)/,
  ];
  for (const re of patterns) {
    const match = url.match(re);
    if (match) return match[1];
  }
  return null;
}

export function isYouTubeShort(url: string): boolean {
  return /youtube\.com\/shorts\//.test(url);
}

export function VideoPlayer({
  src,
  controls = false,
  className = "",
}: {
  src: string;
  controls?: boolean;
  className?: string;
}) {
  const ytId = getYouTubeEmbedId(src);
  if (ytId) {
    const vertical = isYouTubeShort(src);
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <iframe
          src={`https://www.youtube.com/embed/${ytId}`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className={vertical ? "h-full aspect-[9/16] rounded-lg" : "w-full h-full rounded-lg"}
        />
      </div>
    );
  }
  return <video src={src} controls={controls} muted className={className || "w-full h-full object-cover"} />;
}
