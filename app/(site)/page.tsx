import Image from "next/image";
import Link from "next/link";
import { CategoryCard } from "@/components/category-card";
import { getShabbosCatalog } from "@/lib/storefront/catalog";
import { getHeroSlides, getWeeklyRecommendations } from "@/lib/storefront/merchandising";
import { HeroSlider } from "@/components/hero-slider";
import { ProductCard } from "@/components/product-card";
import { Testimonials } from "@/components/testimonials";

export const revalidate = 300;

export default async function Home() {
  const [catalog, slides, recommendations] = await Promise.all([getShabbosCatalog(), getHeroSlides(), getWeeklyRecommendations()]);
  const featured = catalog.filter((category) => ["salatim", "fish", "chicken", "meat", "sides", "salads"].includes(category.slug)).slice(0, 6);
  return (
    <main>
      <HeroSlider slides={slides} />
      {/*
      <section className="grid min-h-[720px] bg-ink text-white lg:grid-cols-[.9fr_1.1fr]">
        <div className="flex items-center px-6 py-16 sm:py-24 lg:px-16"><div className="max-w-2xl"><p className="text-xs font-bold tracking-[.3em] text-honey uppercase">This week at Palate</p><h1 className="display mt-5 t-hero font-semibold">Good food. Friday handled.</h1><p className="mt-7 max-w-xl text-base leading-8 text-white/75">Choose the dishes your table loves. We prepare them with care in Beit Shemesh, ready for pickup or delivery.</p><div className="mt-9 flex flex-wrap gap-3"><Link href="/shabbos" className="focus-ring rounded-full bg-honey px-7 py-4 text-sm font-extrabold text-ink">Explore this week’s menu</Link><Link href="/packages" className="focus-ring rounded-full border border-white/35 px-7 py-4 text-sm font-bold">See complete packages</Link></div></div></div>
        <div className="grid min-h-[560px] grid-cols-2 grid-rows-2 gap-1 bg-cream/20 lg:min-h-[720px]"><div className="relative row-span-2"><Image src="/assets/gallery/gallery1.jpg" alt="A Palate composed salad" fill priority className="object-cover" sizes="35vw" /></div><div className="relative"><Image src="/assets/Shabbos/Balsamic Glazed Brisket.jpg" alt="Palate balsamic glazed brisket" fill priority className="object-cover" sizes="25vw" /></div><div className="relative"><Image src="/assets/Shabbos/Moroccan-Salmon.jpeg" alt="Palate Moroccan salmon" fill className="object-cover" sizes="25vw" /></div></div>
      </section>
      */}

      <section className="px-6 py-16 sm:py-24 lg:px-10"><div className="mx-auto max-w-7xl"><div className="flex flex-col justify-between gap-6 md:flex-row md:items-end"><div><p className="text-xs font-bold tracking-[.25em] text-clay uppercase">Build your table</p><h2 className="display mt-3 max-w-2xl t-h2 font-semibold">Start with what you’re craving.</h2></div><Link href="/shabbos" className="inline-block py-2 text-sm font-bold underline decoration-honey decoration-2 underline-offset-8">Browse the full Shabbos menu</Link></div><div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">{featured.map((category, index) => <CategoryCard key={category.slug} category={category} priority={index < 2} />)}</div></div></section>

      <section className="border-y border-ink/10 bg-white px-6 py-16 sm:py-24 lg:px-10"><div className="mx-auto max-w-7xl"><p className="text-xs font-bold tracking-[.25em] text-clay uppercase">Recommendation of the week</p><h2 className="display mt-3 t-h2 font-semibold">Palate favourites, ready to add.</h2><div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">{recommendations.map((product) => <ProductCard key={product.id} product={product} />)}</div></div></section>

      <Testimonials />

      <section className="bg-moss px-6 py-16 sm:py-24 text-white lg:px-10"><div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-2"><div className="relative min-h-[520px] overflow-hidden rounded-[2.5rem]"><Image src="/assets/gallery/image 14.jpeg" alt="Palate food prepared for a family table" fill className="object-cover" sizes="50vw" /></div><div className="lg:pl-12"><p className="text-xs font-bold tracking-[.25em] text-honey uppercase">One order, a whole table</p><h2 className="display mt-4 t-h2 font-semibold">Friday has enough going on.</h2><p className="mt-6 max-w-lg leading-8 text-white/70">Our complete Shabbos packages bring together salatim, fish, mains and sides in sensible portions—so you can order confidently and get back to everything else.</p><Link href="/packages" className="focus-ring mt-8 inline-block rounded-full bg-cream px-7 py-4 text-sm font-extrabold text-ink">Discover Shabbos packages</Link></div></div></section>

      <section className="paper-grain px-6 py-14 sm:py-20 text-center"><p className="text-xs font-bold tracking-[.25em] text-clay uppercase">Questions before you order?</p><h2 className="display mx-auto mt-4 max-w-3xl t-h2 font-semibold">We’re happy to help you plan the right amount.</h2><a href="https://wa.me/972587280062" className="focus-ring mt-8 inline-block rounded-full border border-ink/25 bg-white px-7 py-4 text-sm font-bold">Talk to Palate on WhatsApp</a></section>
    </main>
  );
}
