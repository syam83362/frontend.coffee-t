import Image from 'next/image';
import Link from 'next/link';
import { ArrowDownRight, ArrowUpRight, UserRound } from 'lucide-react';

const coffeeImage =
  'https://images.unsplash.com/photo-1442512595331-e89e73853f31?auto=format&fit=crop&w=2200&q=85';
const teaImage =
  'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=1400&q=85';

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-paper text-ink">
      <div className="bg-coral px-4 py-2 text-center text-[10px] font-bold uppercase text-white sm:text-xs">
        A little India in every cup <span className="px-2 text-sun">/</span> Coffee-T
      </div>

      <header className="mx-auto flex h-[76px] max-w-[1440px] items-center justify-between px-5 sm:px-8 lg:px-14">
        <Link className="flex items-center gap-3" href="/" aria-label="Coffee-T home">
          <span className="grid size-10 place-items-center bg-leaf font-display text-lg text-white">C</span>
          <span className="font-display text-[27px] leading-none">coffee-t</span>
        </Link>
        <nav className="hidden items-center gap-10 text-sm font-semibold md:flex" aria-label="Main navigation">
          <a className="transition-colors hover:text-coral" href="#coffee">Coffee</a>
          <a className="transition-colors hover:text-coral" href="#tea">Tea</a>
          <a className="transition-colors hover:text-coral" href="#story">Our roots</a>
        </nav>
        <Link
          className="inline-flex min-h-11 items-center gap-2 border border-ink/15 px-4 text-sm font-semibold transition-colors hover:border-leaf hover:bg-leaf hover:text-white"
          href="/account"
        >
          <UserRound size={17} strokeWidth={1.8} aria-hidden="true" />
          <span className="hidden sm:inline">Your account</span>
          <span className="sm:hidden">Account</span>
        </Link>
      </header>

      <section className="relative isolate mx-auto min-h-[590px] max-w-[1440px] overflow-hidden bg-leaf sm:min-h-[660px] lg:min-h-[700px]" aria-labelledby="store-title">
        <Image
          alt="Freshly brewed coffee being poured in a sunlit cafe"
          className="object-cover object-center"
          fill
          priority
          sizes="100vw"
          src={coffeeImage}
        />
        <div className="absolute inset-0 bg-ink/48" />
        <div className="absolute inset-y-0 left-0 w-[14px] bg-sun" />
        <div className="relative flex min-h-[590px] flex-col items-start justify-center px-8 py-16 text-white sm:min-h-[660px] sm:px-14 lg:min-h-[700px] lg:px-24">
          <p className="mb-7 inline-flex items-center gap-3 text-[11px] font-bold uppercase text-sun sm:text-xs">
            <span className="h-px w-9 bg-sun" />
            Grown in India. Made for your everyday.
          </p>
          <h1 id="store-title" className="max-w-[820px] font-display text-[58px] leading-[0.98] sm:text-[76px] lg:text-[92px]">
            Find your kind
            <br />
            of <span className="text-sun">brew.</span>
          </h1>
          <p className="mt-7 max-w-[445px] text-base leading-7 text-white/85 sm:text-lg sm:leading-8">
            Coffee and tea with a sense of place, sourced from the landscapes we call home.
          </p>
          <a
            className="mt-9 inline-flex min-h-[54px] items-center gap-8 bg-sun px-6 text-sm font-bold text-ink transition-colors hover:bg-white"
            href="#collections"
          >
            Explore the collection
            <ArrowDownRight size={18} strokeWidth={2} aria-hidden="true" />
          </a>
          <span className="absolute bottom-8 right-8 hidden text-[10px] font-bold uppercase text-white/75 sm:block lg:right-12">
            12° 58&apos; N / 77° 35&apos; E
          </span>
        </div>
      </section>

      <section className="mx-auto max-w-[1440px] px-5 pb-20 pt-20 sm:px-8 sm:pb-28 sm:pt-28 lg:px-14" id="collections">
        <div className="mb-9 flex flex-col justify-between gap-5 sm:mb-12 sm:flex-row sm:items-end">
          <div>
            <p className="mb-3 text-[11px] font-bold uppercase text-coral">The good stuff</p>
            <h2 className="font-display text-[43px] leading-none sm:text-[56px]">Choose your ritual.</h2>
          </div>
          <p className="max-w-[330px] text-sm leading-6 text-muted">
            Two paths through India&apos;s most loved growing regions. Your next favourite starts here.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 md:gap-6">
          <a className="group relative min-h-[370px] overflow-hidden bg-leaf sm:min-h-[460px]" href="#coffee" id="coffee">
            <Image
              alt="A cup of freshly brewed coffee on a wooden table"
              className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              src="https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=85"
            />
            <div className="absolute inset-0 bg-ink/30 transition-colors group-hover:bg-ink/40" />
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-6 text-white sm:p-9">
              <div>
                <p className="mb-2 text-[10px] font-bold uppercase text-sun">From the highlands</p>
                <h3 className="font-display text-[44px] leading-none sm:text-[54px]">Coffee</h3>
              </div>
              <span className="grid size-12 place-items-center border border-white/60 transition-colors group-hover:bg-sun group-hover:text-ink">
                <ArrowUpRight size={20} strokeWidth={1.8} aria-hidden="true" />
              </span>
            </div>
          </a>

          <a className="group relative min-h-[370px] overflow-hidden bg-leaf sm:min-h-[460px]" href="#tea" id="tea">
            <Image
              alt="A glass of tea with delicate leaves and warm light"
              className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              src={teaImage}
            />
            <div className="absolute inset-0 bg-ink/30 transition-colors group-hover:bg-ink/40" />
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-6 text-white sm:p-9">
              <div>
                <p className="mb-2 text-[10px] font-bold uppercase text-sun">Leaves with a story</p>
                <h3 className="font-display text-[44px] leading-none sm:text-[54px]">Tea</h3>
              </div>
              <span className="grid size-12 place-items-center border border-white/60 transition-colors group-hover:bg-sun group-hover:text-ink">
                <ArrowUpRight size={20} strokeWidth={1.8} aria-hidden="true" />
              </span>
            </div>
          </a>
        </div>
        <p className="mt-4 text-xs text-muted">Collection browsing and product details are coming in the next development phase.</p>
      </section>

      <section className="bg-mint px-5 py-16 sm:px-8 sm:py-20 lg:px-14" id="story">
        <div className="mx-auto grid max-w-[1440px] gap-8 md:grid-cols-[1fr_1.3fr] md:items-end">
          <p className="text-[11px] font-bold uppercase text-coral">A little closer to home</p>
          <h2 className="max-w-[780px] font-display text-[38px] leading-[1.12] sm:text-[52px]">
            Every cup carries a place, a season, and the hands that made it.
          </h2>
        </div>
      </section>

      <footer className="mx-auto flex max-w-[1440px] flex-col gap-4 px-5 py-8 text-xs font-semibold text-muted sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-14">
        <span className="font-display text-lg text-ink">coffee-t</span>
        <span>Good things grow close to home.</span>
        <Link className="inline-flex items-center gap-2 text-ink hover:text-coral" href="/account">
          Your account <ArrowUpRight size={14} aria-hidden="true" />
        </Link>
      </footer>
    </main>
  );
}