"use client";

import { animate } from "motion/react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { useMotionUITheme } from "./motion-ui/ui-theme";
import NewTabHint from "./new-tab-hint";
import { Stagger, StaggerItem } from "./stagger";

/**
 * In the press — the closing band of press mentions, modeled on the Griffin
 * "stories" layout: a 3-up row of cards, each a grayscale story photo over a
 * headline with the publication's wordmark beneath. The grayscale imagery
 * and the flattened marks read as one monochrome surface on either ground.
 *
 * Three cards show at desktop width; a prev/next pager (top-right, where
 * a "view all" link would sit) scrolls the snap-track to reach the rest.
 * Editorial photography reports rather than depicts, so it sits outside
 * the Depicted-World Exception: photos are desaturated by CSS to hold the
 * No-Colour Rule, and publication wordmarks are flattened to Ink
 * (--press-mark in globals.css).
 *
 * The ground is Paper. It was `bg-black text-white` on the reasoning that it
 * "sits on Ink like the reference-implementations section it follows" — and
 * that section stopped sitting on Ink on 2026-08-16, when a whole band stuck
 * dark was rejected for reading as a bug rather than a decision. This band was
 * the same defect one section later: the page ran white document, hard black
 * slab, black footer, and the `rgba(255,255,255,0.08)` top hairline it used to
 * separate itself from the black section above had nothing left to do. It is
 * not on the fixed-value list in globals.css, and DESIGN.md §5 reserves the
 * Twilight Stack for the closing CTA and footer, so the dark run starts at the
 * footer and not here.
 */

type Story = {
  href: string;
  title: string;
  image: string;
  imageAlt: string;
  logo?: string;
  publication: string;
  logoClass?: string;
};

const STORIES: Story[] = [
  {
    href: "https://cryptobriefing.com/ducat-unit-stablecoin-cashu-turbo-unit/",
    title: "Ducat brings its UNIT stablecoin to Cashu ecash as Turbo UNIT",
    image: "/press/cryptobriefing-ducat.png",
    imageAlt: "A US hundred-dollar bill dissolving into green binary digits",
    publication: "Crypto Briefing",
  },
  {
    href: "https://www.forbes.com/sites/digital-assets/2024/02/14/bypassing-financial-gatekeepers-with-bitcoin/",
    title: "Bypassing financial gatekeepers with Bitcoin",
    image: "/press/forbes.jpg",
    imageAlt: "A neon Bitcoin sign in a shop window beside a chalkboard menu",
    logo: "/press/forbes.svg",
    publication: "Forbes",
  },
  {
    href: "https://www.thestreet.com/crypto/jack-dorsey-whatsapp-rival-signal-bitcoin-payments",
    title: "Jack Dorsey wants WhatsApp rival to use Bitcoin",
    image: "/press/thestreet.jpg",
    imageAlt: "Jack Dorsey speaking into a microphone",
    logo: "/press/thestreet.svg",
    publication: "TheStreet",
  },
  {
    href: "https://www.bitget.com/news/detail/12560605065105",
    title:
      "The censorship-resistant Cashu protocol powering Cuba's financial revolution",
    image: "/press/bitget.jpg",
    imageAlt: "A stylised night street scene illustrating the Cashu protocol",
    logo: "/press/bitget.svg",
    publication: "Bitget",
  },
  {
    href: "https://bitcoinmagazine.com/technical/cashu-a-vision-for-a-bitcoin-powered-ecash-ecosystem",
    title: "Cashu: a vision for a Bitcoin-powered ecash ecosystem",
    image: "/press/bitcoinmagazine.jpg",
    imageAlt: "A bowl of cashews on a wooden table",
    logo: "/press/bitcoinmagazine.png",
    publication: "Bitcoin Magazine",
    logoClass: "press-logo--tall",
  },
];

function Chevron({ dir }: { dir: "prev" | "next" }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
      <path
        d={dir === "next" ? "M9 5l7 7-7 7" : "M15 5l-7 7 7 7"}
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="square"
      />
    </svg>
  );
}

/* How long the rail keeps coasting after the pointer lets go, in ms of the
   release velocity. This is a projection distance, not a duration — the glide
   itself is a spring. 220ms is `--dur-base`: the rail carries on for about as
   long as a button takes to change its ground, which is enough to feel thrown
   rather than dropped and short enough that a hard flick still lands on the
   next card rather than three cards away. */
const COAST_MS = 220;

/* Movement past which a pointer gesture stops being a click and becomes a
   drag. Below this the rail should not move and the card underneath must still
   open; above it the rail moves and the click that follows is swallowed. 4px
   is the usual browser-ish threshold and it is comfortably under the smallest
   deliberate drag while sitting above hand tremor on a trackpad. */
const DRAG_THRESHOLD_PX = 4;

export default function InThePress() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(true);
  /* The first real consumer of the Motion UI theme provider mounted in
     layout.tsx, which until now supplied a context nothing read. `ui` is the
     theme's own name for "menus, cards, reveals" and it is the right weight for
     a rail: verified not to overshoot (peak 1.0000 in its sampled linear()), so
     it costs nothing against the site's no-bounce doctrine. */
  const theme = useMotionUITheme();

  const update = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanPrev(scrollLeft > 4);
    setCanNext(scrollLeft + clientWidth < scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    // Defer the initial measure past render so it doesn't set state
    // synchronously within the effect.
    const raf = requestAnimationFrame(update);
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [update]);

  /* One card plus one gap — the distance between two snap points. Shared by
     the pager and the drag so they cannot disagree about where a card is. */
  const unitOf = useCallback((el: HTMLElement) => {
    const card = el.querySelector<HTMLElement>("[data-press-card]");
    const gap = parseFloat(getComputedStyle(el).columnGap) || 24;
    return card ? card.offsetWidth + gap : el.clientWidth * 0.8;
  }, []);

  /*
   * DRAG THE RAIL (2026-08-21). The press rail is the one component on the site
   * a reader manipulates directly, and it responded like a document rather than
   * an object: native snap points, a pager, no weight.
   *
   * THIS IS ADDITIVE, WHICH IS THE WHOLE DESIGN. The track stays a real scroll
   * container — touch scrolling, trackpad, keyboard, and the pager all keep
   * working untouched, and none of them go through this code. Motion's `drag`
   * was the obvious reach and is deliberately NOT used: it wants a transform-
   * driven rail, and converting to one would trade native touch and keyboard
   * scrolling for a mouse affordance. So this drives `scrollLeft` directly and
   * only ever attaches to a fine pointer.
   *
   * SNAP IS SUSPENDED FOR THE LENGTH OF THE DRAG. With `scroll-snap-type: x
   * mandatory` the browser re-snaps on every scrollLeft write, so dragging
   * against it feels like pulling something over a ratchet. It is restored the
   * moment the glide lands — and the glide lands ON a snap point, so restoring
   * it is a no-op rather than a correction the reader can see. That is the same
   * reasoning `step()` states below for using scrollTo over scrollBy.
   */
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    /* Coarse pointers already have momentum scrolling from the platform, and it
       is better than this. Attaching here would mean re-implementing iOS. */
    if (!window.matchMedia("(pointer: fine)").matches) return;

    let dragging = false;
    let startX = 0;
    let startScroll = 0;
    let lastX = 0;
    let lastT = 0;
    let velocity = 0; // px/ms of scrollLeft, positive = scrolling right
    let travelled = 0;
    let glide: { stop: () => void } | null = null;

    const restoreSnap = () => {
      el.style.scrollSnapType = "";
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || event.pointerType !== "mouse") return;
      glide?.stop();
      glide = null;
      dragging = true;
      travelled = 0;
      velocity = 0;
      startX = lastX = event.clientX;
      startScroll = el.scrollLeft;
      lastT = event.timeStamp;
      el.style.scrollSnapType = "none";
      el.classList.add("is-dragging");
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return;
      const dx = event.clientX - lastX;
      const dt = Math.max(1, event.timeStamp - lastT);
      /* Negated because dragging the content LEFT scrolls the rail RIGHT. */
      velocity = -dx / dt;
      lastX = event.clientX;
      lastT = event.timeStamp;
      travelled += Math.abs(dx);
      el.scrollLeft = startScroll - (event.clientX - startX);
    };

    const onPointerUp = () => {
      if (!dragging) return;
      dragging = false;
      el.classList.remove("is-dragging");

      if (travelled < DRAG_THRESHOLD_PX) {
        restoreSnap();
        return;
      }

      /* Project where the coast would end, round that to the nearest snap
         point, and spring to it. Rounding before animating is what lets snap
         come back without a visible correction. */
      const unit = unitOf(el);
      const max = el.scrollWidth - el.clientWidth;
      const projected = el.scrollLeft + velocity * COAST_MS;
      const target = Math.min(
        max,
        Math.max(0, Math.round(projected / unit) * unit),
      );

      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        /* Substitute, don't kill: the rail still lands on the card the throw
           was aimed at, it just gets there without the glide. */
        el.scrollLeft = target;
        restoreSnap();
        return;
      }

      glide = animate(el.scrollLeft, target, {
        type: "spring",
        stiffness: theme.transitions.ui.stiffness,
        damping: theme.transitions.ui.damping,
        onUpdate: (value) => {
          el.scrollLeft = value;
        },
        onComplete: restoreSnap,
      });
    };

    /* Swallow the click that a drag ends on. Every card is a link covering most
       of the track, so without this a throw that happens to finish over a card
       opens a news site. Capture phase, so it runs before the anchor's own
       handling; the threshold is what keeps an ordinary click working. */
    const onClickCapture = (event: MouseEvent) => {
      if (travelled >= DRAG_THRESHOLD_PX) {
        event.preventDefault();
        event.stopPropagation();
        travelled = 0;
      }
    };

    el.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    el.addEventListener("click", onClickCapture, true);
    return () => {
      glide?.stop();
      el.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      el.removeEventListener("click", onClickCapture, true);
      restoreSnap();
      el.classList.remove("is-dragging");
    };
  }, [theme, unitOf]);

  const step = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    const unit = unitOf(el);
    // scrollTo an exact card-aligned position rather than scrollBy a delta:
    // with scroll-snap-type mandatory on the track, a smooth scrollBy gets
    // resolved back to the nearest snap point (the card it started on) and
    // the track barely moves. Landing exactly on a snap point keeps the
    // snap model and the animation in agreement.
    const idx = Math.round(el.scrollLeft / unit) + dir;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    el.scrollTo({
      left: Math.max(0, idx * unit),
      behavior: reduced ? "auto" : "smooth",
    });
  };

  return (
    <section
      className="bg-paper text-ink section-y-default press"
      aria-labelledby="press-heading"
    >
      {/* One container: the heading, its arrows and the rail are one band, and
          the rail is the only part of it anyone scrolls. The stagger between
          the two is Motion's `staggerChildren`, not a CSS delay table. */}
      <Stagger inView className="page-shell flex flex-col gap-10 lg:gap-14">
        <StaggerItem className="press-head">
          <div className="flex items-end justify-between gap-6">
            <h2 id="press-heading" className="t-headline">
              In the press
            </h2>
            <div className="press-nav" aria-hidden={!canPrev && !canNext}>
              <button
                type="button"
                className="press-arrow focus-ring"
                onClick={() => step(-1)}
                disabled={!canPrev}
                aria-label="Previous stories"
              >
                <Chevron dir="prev" />
              </button>
              <button
                type="button"
                className="press-arrow focus-ring"
                onClick={() => step(1)}
                disabled={!canNext}
                aria-label="Next stories"
              >
                <Chevron dir="next" />
              </button>
            </div>
          </div>
        </StaggerItem>

        <StaggerItem className="press-rail">
          {/* `data-cursor-zone` is read by site-cursor.tsx, which sizes the
              custom cursor into a horizontal bar over the rail. It exists
              because that component's `* { cursor: none }` erases the `grab`
              stated on .press-track, and `grab` is the only cursor on this
              site that was carrying information. */}
          <div
            ref={trackRef}
            data-cursor-zone="rail"
            className="press-track scrollbar-none"
          >
            {STORIES.map((story) => (
              <a
                key={story.href}
                data-press-card
                href={story.href}
                target="_blank"
                rel="noopener noreferrer"
                className="press-card focus-ring"
              >
                <div className="press-media">
                  <Image
                    src={story.image}
                    alt={story.imageAlt}
                    fill
                    sizes="(max-width: 768px) 85vw, (max-width: 1024px) 45vw, 30vw"
                    className="press-media__img"
                  />
                </div>
                <h3 className="t-title press-card__title">{story.title}</h3>
                {/* Static SVG wordmark as a plain <img> so Next's optimizer
                    (which blocks SVG) stays out of the path; flattened to Ink
                    by CSS (--press-mark). */}
                {story.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={story.logo}
                    alt={story.publication}
                    className={`press-logo${story.logoClass ? ` ${story.logoClass}` : ""}`}
                    loading="lazy"
                  />
                ) : (
                  <span className="text-lg font-semibold">{story.publication}</span>
                )}
                <NewTabHint />
              </a>
            ))}
          </div>
        </StaggerItem>
      </Stagger>
    </section>
  );
}
