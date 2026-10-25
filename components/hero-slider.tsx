"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { HeroSlide } from "@/lib/storefront/merchandising";

/**
 * On a desktop this is a two-column split: words left, photograph right.
 *
 * That layout collapsed badly on a phone, where the two columns stack — the
 * reader got roughly 700px of text and then a 520px photograph, so the first
 * thing they could actually order sat about two full screens down. Below
 * `lg` the photograph becomes the background and the words sit on top of it,
 * which fits the hero into one screen and puts the call to action in reach of
 * a thumb.
 */
export function HeroSlider({ slides }: { slides: HeroSlide[] }) {
  const [active, setActive] = useState(0);
  const touchX = useRef<number | null>(null);
  const touchY = useRef(0);

  useEffect(() => {
    if (slides.length < 2) return;
    const timer = window.setInterval(() => setActive((value) => (value + 1) % slides.length), 7000);
    return () => clearInterval(timer);
  }, [slides.length]);

  const slide = slides[active];
  const go = (delta: number) => setActive((value) => (value + delta + slides.length) % slides.length);

  return (
    <section
      className="relative grid min-h-[82dvh] bg-ink text-white lg:min-h-[700px] lg:grid-cols-[.9fr_1.1fr]"
      onTouchStart={(event) => { touchX.current = event.touches[0].clientX; touchY.current = event.touches[0].clientY; }}
      onTouchEnd={(event) => {
        if (touchX.current === null || slides.length < 2) return;
        const dx = event.changedTouches[0].clientX - touchX.current;
        const dy = event.changedTouches[0].clientY - touchY.current;
        // Only treat it as a swipe when it is clearly sideways, so scrolling
        // the page past the hero never flips the slide.
        if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
        touchX.current = null;
      }}
    >
      <div className="relative z-10 flex items-end px-5 pt-24 pb-10 sm:px-8 lg:items-center lg:px-16 lg:py-24">
        <div className="max-w-2xl">
          <p className="text-[11px] font-bold tracking-[.3em] text-honey uppercase">{slide.eyebrow}</p>
          <h1 className="display t-hero mt-4 font-semibold">{slide.headline}</h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-white/80 sm:mt-7 sm:leading-8">{slide.body}</p>
          <Link href={slide.ctaHref} className="focus-ring mt-7 block rounded-full bg-honey px-7 py-4 text-center text-sm font-extrabold text-ink sm:inline-block sm:w-auto">
            {slide.ctaLabel}
          </Link>
          {/* The dot is small but its button is not: padding carries each
              target to roughly 36x44 so it can be hit with a thumb. */}
          {slides.length > 1 && (
            <div className="-mx-3.5 mt-4 flex" aria-label="Hero slides">
              {slides.map((item, index) => (
                <button
                  key={item.id}
                  onClick={() => setActive(index)}
                  className="focus-ring flex h-11 items-center px-3.5"
                  aria-label={`Show slide ${index + 1}`}
                  aria-current={index === active}
                >
                  <span className={`block h-2 rounded-full transition-all ${index === active ? "w-8 bg-honey" : "w-2 bg-white/40"}`} />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="absolute inset-0 lg:relative lg:min-h-[700px]">
        <Image
          src={slide.imageUrl}
          alt=""
          fill
          priority
          className="object-cover"
          sizes="(min-width: 1024px) 60vw, 100vw"
        />
        {/* Carries the text on a phone, where it sits over the photograph. */}
        <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-ink via-ink/75 to-ink/25 lg:hidden" />
      </div>
    </section>
  );
}
