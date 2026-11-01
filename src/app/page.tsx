import Image from 'next/image';
import { ArrowRight, CalendarCheck, Leaf, Truck } from 'lucide-react';
import { CatalogueSection } from '@/components/catalogue-section';
import { SiteShell } from '@/components/site-header';
import { ButtonLink } from '@/components/ui';

const heroImage =
  'https://images.unsplash.com/photo-1442512595331-e89e73853f31?auto=format&fit=crop&w=1600&q=80';

const promises = [
  { icon: Leaf, title: 'Single-estate sourcing', text: 'Coffee and tea traced to the Indian estates that grow them.' },
  { icon: Truck, title: 'Delivered to your door', text: 'Order online and track every order from your account.' },
  { icon: CalendarCheck, title: 'Reserve a table', text: 'Book a seat at a Coffee-T café in a few taps.' },
];

export default function HomePage() {
  return (
    <SiteShell>
      <section className="mx-auto grid max-w-7xl items-center gap-10 px-4 pb-16 pt-10 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:px-8 lg:pb-24 lg:pt-16">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-sun-soft px-3 py-1.5 text-xs font-semibold text-sun-ink">
            <span className="size-1.5 rounded-full bg-sun-strong" />
            Grown in India. Made for your everyday.
          </p>
          <h1 className="mt-6 font-display text-5xl leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
            Find your kind of{' '}
            <span className="relative inline-block">
              <span className="relative z-10">brew.</span>
              <span className="absolute inset-x-0 bottom-1 -z-0 h-4 rounded-sm bg-sun sm:h-5" aria-hidden="true" />
            </span>
          </h1>
          <p className="mt-6 max-w-md text-lg leading-8 text-muted">
            Coffee and tea with a sense of place, sourced from the landscapes we call home.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="#shop" size="lg">
              Shop the collection <ArrowRight size={18} aria-hidden="true" />
            </ButtonLink>
            <ButtonLink href="/cafe" size="lg" variant="secondary">
              Reserve a table
            </ButtonLink>
          </div>
        </div>
        <div className="relative">
          <div className="absolute -right-3 -top-3 h-full w-full rounded-[2rem] bg-sun sm:-right-5 sm:-top-5" aria-hidden="true" />
          <div className="relative aspect-[4/3] overflow-hidden rounded-[2rem] bg-cloud lg:aspect-[5/4]">
            <Image
              alt="Freshly brewed coffee being poured in a sunlit café"
              className="object-cover"
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 50vw"
              src={heroImage}
            />
          </div>
        </div>
      </section>

      <section className="border-y border-line bg-cloud">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:grid-cols-3 sm:px-6 lg:px-8">
          {promises.map(({ icon: Icon, title, text }) => (
            <div className="flex gap-4" key={title}>
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-sun text-ink">
                <Icon size={20} aria-hidden="true" />
              </span>
              <div>
                <p className="font-semibold">{title}</p>
                <p className="mt-1 text-sm leading-6 text-muted">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <CatalogueSection />

      <section className="px-4 pb-16 sm:px-6 lg:px-8 lg:pb-24">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 rounded-[2rem] bg-sun px-6 py-10 sm:px-10 md:flex-row md:items-center lg:px-14 lg:py-14">
          <div>
            <h2 className="font-display text-3xl leading-tight sm:text-4xl">Every cup carries a place.</h2>
            <p className="mt-2 max-w-lg text-base leading-7 text-ink-soft">
              Visit a Coffee-T café, order from your table, and taste the season it came from.
            </p>
          </div>
          <ButtonLink href="/cafe" size="lg" variant="dark">
            Find a café <ArrowRight size={18} aria-hidden="true" />
          </ButtonLink>
        </div>
      </section>
    </SiteShell>
  );
}
