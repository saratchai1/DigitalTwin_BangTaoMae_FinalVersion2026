import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import view01 from "../assets/project-gallery/view-01.webp";
import view02 from "../assets/project-gallery/view-02.webp";
import view03 from "../assets/project-gallery/view-03.webp";
import view04 from "../assets/project-gallery/view-04.webp";
import view05 from "../assets/project-gallery/view-05.webp";
import view06 from "../assets/project-gallery/view-06.webp";
import "./ProjectGallery.css";

const PROJECT_GALLERY = [view01, view02, view03, view04, view05, view06] as const;

export function ProjectGallery() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const previous = () => setIndex((current) => (current - 1 + PROJECT_GALLERY.length) % PROJECT_GALLERY.length);
  const next = () => setIndex((current) => (current + 1) % PROJECT_GALLERY.length);

  useEffect(() => {
    if (paused) return;
    const timer = window.setInterval(next, 5000);
    return () => window.clearInterval(timer);
  }, [paused]);

  return (
    <section
      className="cc2-project-gallery"
      aria-label="ภาพแบบจำลองพื้นที่โครงการ"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div
        className="cc2-project-gallery-track"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {PROJECT_GALLERY.map((image, imageIndex) => (
          <figure className="cc2-project-gallery-slide" key={image}>
            <img
              src={image}
              alt={`ภาพแบบจำลองพื้นที่โครงการ มุมมอง ${imageIndex + 1}`}
              loading={imageIndex === 0 ? "eager" : "lazy"}
              decoding="async"
              draggable={false}
            />
          </figure>
        ))}
      </div>

      <button type="button" className="cc2-project-gallery-arrow previous" onClick={previous} aria-label="ภาพก่อนหน้า">
        <ChevronLeft size={18} />
      </button>
      <button type="button" className="cc2-project-gallery-arrow next" onClick={next} aria-label="ภาพถัดไป">
        <ChevronRight size={18} />
      </button>

      <div className="cc2-project-gallery-dots" aria-label="เลือกภาพ">
        {PROJECT_GALLERY.map((_, dotIndex) => (
          <button
            type="button"
            key={dotIndex}
            className={dotIndex === index ? "active" : ""}
            onClick={() => setIndex(dotIndex)}
            aria-label={`แสดงภาพ ${dotIndex + 1}`}
            aria-current={dotIndex === index ? "true" : undefined}
          />
        ))}
      </div>
    </section>
  );
}
