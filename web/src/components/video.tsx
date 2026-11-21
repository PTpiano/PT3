import { useEffect, useMemo, useState } from "react";
import { useSrc } from "@/store/media";
import { parseVideoUrl, thumbnailFallbackChain, thumbnailForVideoUrl } from "@/store/video";

/**
 * Miniatura con fallback automatico.
 *
 * Se la miniatura YouTube salvata non esiste (caso `maxresdefault`),
 * l'immagine prova automaticamente le qualità inferiori finché non ne
 * trova una visibile.
 */
export function GalleryThumbnail({
  src,
  videoUrl,
  alt = "",
  className = "",
  style,
}: {
  src?: string;
  videoUrl?: string;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const resolved = useSrc(src);
  const derived = !resolved ? thumbnailForVideoUrl(videoUrl || "") : "";
  const initial = resolved || derived;
  const [url, setUrl] = useState(initial);
  const [step, setStep] = useState(0);
  const chain = useMemo(() => (url ? thumbnailFallbackChain(url) : null), [url]);

  useEffect(() => {
    setUrl(resolved || derived);
    setStep(0);
  }, [resolved, derived]);

  if (!url) {
    return (
      <div
        className={className}
        style={{ background: "linear-gradient(135deg,#2a1a10,#0a0705)", ...style }}
      />
    );
  }

  return (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={className}
      style={style}
      onError={() => {
        const next = chain?.[step];
        if (!next) return;
        setStep((value) => value + 1);
        setUrl(next);
      }}
    />
  );
}

/** Player del video: iframe per YouTube/Vimeo, <video> per i file diretti. */
export function VideoPlayer({ url, className = "" }: { url: string; className?: string }) {
  const meta = parseVideoUrl(url);
  if (!meta) return null;

  if (meta.provider === "file") {
    return <video src={meta.src} controls autoPlay playsInline className={className} />;
  }

  return (
    <iframe
      src={meta.embed}
      title="Video"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
      className={className}
    />
  );
}
