import { useState, useCallback, useEffect } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { motion } from "framer-motion";
import { Play, X, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface VideoTestimonial {
  id: string;
  videoId: string;
}

const videoTestimonials: VideoTestimonial[] = [
  { id: "1", videoId: "fqDL_UgZzN8" },
  { id: "2", videoId: "u5oxpbCabQA" },
  { id: "3", videoId: "VJrmQOwOd8g" },
  { id: "4", videoId: "gCaUBtYcGCI" },
  { id: "5", videoId: "JfMduaTKqKo" },
  { id: "6", videoId: "2qqOzTl0t0w" },
  { id: "7", videoId: "d4d5kzBvPmc" },
  { id: "8", videoId: "rW1EvPGcQeo" },
];

const VideoCarousel = () => {
  const [activeVideo, setActiveVideo] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: true,
    align: "center",
    skipSnaps: false,
    dragFree: false,
  });

  const scrollPrev = useCallback(() => {
    if (emblaApi) emblaApi.scrollPrev();
  }, [emblaApi]);

  const scrollNext = useCallback(() => {
    if (emblaApi) emblaApi.scrollNext();
  }, [emblaApi]);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi, onSelect]);

  const getThumbnail = (videoId: string) => 
    `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

  const getEmbedUrl = (videoId: string) =>
    `https://www.youtube.com/embed/${videoId}?autoplay=1`;

  return (
    <div className="relative max-w-6xl mx-auto">
      {/* Navigation Buttons */}
      <Button
        variant="outline"
        size="icon"
        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-background/80 backdrop-blur-sm border-primary/20 hover:bg-primary hover:text-primary-foreground shadow-lg -translate-x-4 sm:-translate-x-6"
        onClick={scrollPrev}
      >
        <ChevronLeft className="h-5 w-5" />
      </Button>
      
      <Button
        variant="outline"
        size="icon"
        className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-background/80 backdrop-blur-sm border-primary/20 hover:bg-primary hover:text-primary-foreground shadow-lg translate-x-4 sm:translate-x-6"
        onClick={scrollNext}
      >
        <ChevronRight className="h-5 w-5" />
      </Button>

      {/* Carousel */}
      <div className="overflow-hidden px-4" ref={emblaRef}>
        <div className="flex gap-4">
          {videoTestimonials.map((video, index) => (
            <div
              key={video.id}
              className="flex-shrink-0 w-[280px] sm:w-[320px] md:w-[360px]"
            >
              <motion.div
                animate={{
                  scale: selectedIndex === index ? 1 : 0.9,
                  opacity: selectedIndex === index ? 1 : 0.6,
                }}
                transition={{ duration: 0.3 }}
              >
                <Card 
                  className="overflow-hidden glass-premium border-primary/20 hover:border-primary/40 transition-all duration-300 group cursor-pointer"
                  onClick={() => setActiveVideo(video.videoId)}
                >
                  <div className="relative aspect-[9/16]">
                    <img
                      src={getThumbnail(video.videoId)}
                      alt={`Depoimento ${index + 1}`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center group-hover:bg-black/30 transition-colors">
                      <motion.div
                        whileHover={{ scale: 1.15 }}
                        whileTap={{ scale: 0.95 }}
                        className="w-16 h-16 bg-primary rounded-full flex items-center justify-center shadow-glow"
                      >
                        <Play className="w-7 h-7 text-primary-foreground ml-1" />
                      </motion.div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            </div>
          ))}
        </div>
      </div>

      {/* Dots Indicator */}
      <div className="flex justify-center gap-2 mt-6">
        {videoTestimonials.map((_, index) => (
          <button
            key={index}
            onClick={() => emblaApi?.scrollTo(index)}
            className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
              selectedIndex === index
                ? "bg-primary w-8"
                : "bg-primary/30 hover:bg-primary/50"
            }`}
          />
        ))}
      </div>

      {/* Video Modal */}
      {activeVideo && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setActiveVideo(null)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative w-full max-w-lg aspect-[9/16] bg-black rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setActiveVideo(null)}
              className="absolute top-4 right-4 z-10 w-10 h-10 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-black/70 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <iframe
              src={getEmbedUrl(activeVideo)}
              title="Video depoimento"
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </motion.div>
        </motion.div>
      )}
    </div>
  );
};

export default VideoCarousel;
