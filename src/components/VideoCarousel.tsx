import { useState, useCallback, useEffect } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
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
    `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=0&loop=1&playlist=${videoId}&controls=1&modestbranding=1&rel=0&showinfo=0`;

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
                  className="overflow-hidden glass-premium border-primary/20 hover:border-primary/40 transition-all duration-300"
                >
                  <div className="relative aspect-[9/16]">
                    {selectedIndex === index ? (
                      <iframe
                        src={getEmbedUrl(video.videoId)}
                        title={`Depoimento ${index + 1}`}
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    ) : (
                      <img
                        src={getThumbnail(video.videoId)}
                        alt={`Depoimento ${index + 1}`}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    )}
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
    </div>
  );
};

export default VideoCarousel;
