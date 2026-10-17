'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowUpRight, CalendarDays, MapPin } from 'lucide-react';
import { getCsrfToken, getCurrentUser } from '@/lib/auth-api';
import {
  CafeAvailability,
  CafeLocation,
  createReservation,
  getActiveCafes,
  getReservationAvailability,
} from '@/lib/cafe-api';

const today = new Date();
const initialDate = new Date(today.getTime() - today.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);

export function CafeDiscovery() {
  const [cafes, setCafes] = useState<CafeLocation[]>([]);
  const [selectedCafe, setSelectedCafe] = useState('');
  const [date, setDate] = useState(initialDate);
  const [partySize, setPartySize] = useState(2);
  const [availability, setAvailability] = useState<CafeAvailability | null>(null);
  const [csrfToken, setCsrfToken] = useState('');
  const [signedIn, setSignedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    getActiveCafes().then((result) => { if (active) setCafes(result); }).catch(() => {
      if (active) setError('Cafés could not be loaded.');
    });
    Promise.all([getCsrfToken(), getCurrentUser()]).then(([token]) => {
      if (active) { setCsrfToken(token); setSignedIn(true); }
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!selectedCafe || !date) return;
    let active = true;
    setLoading(true);
    setError('');
    getReservationAvailability(selectedCafe, date, partySize)
      .then((result) => { if (active) setAvailability(result); })
      .catch((requestError: unknown) => {
        if (active) setError(requestError instanceof Error ? requestError.message : 'Availability could not be loaded.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [selectedCafe, date, partySize]);

  async function book(startsAt: string): Promise<void> {
    if (!signedIn) {
      setError('Sign in before booking a table.');
      return;
    }
    setError('');
    setNotice('');
    try {
      const reservation = await createReservation(selectedCafe, startsAt, partySize, csrfToken);
      setNotice(`Reservation confirmed for ${new Date(reservation.startsAt).toLocaleString('en-IN', { timeZone: availability?.cafe.timezone })}.`);
      setAvailability((current) => current ? {
        ...current,
        slots: current.slots.map((slot) => slot.startsAt === startsAt ? { ...slot, tablesAvailable: Math.max(0, slot.tablesAvailable - 1) } : slot).filter((slot) => slot.tablesAvailable > 0),
      } : current);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'The reservation could not be completed.');
    }
  }

  const activeCafes = cafes.filter((cafe) => cafe.status === 'active');
  const upcomingCafes = cafes.filter((cafe) => cafe.status === 'upcoming');

  return (
    <main className="min-h-dvh bg-paper text-ink">
      <header className="bg-leaf px-5 py-5 text-white sm:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between"><Link className="inline-flex items-center gap-2 text-sm font-semibold" href="/"><ArrowLeft size={16} /> Shop</Link><Link className="text-sm font-bold" href="/account">Your account <ArrowUpRight className="inline" size={14} /></Link></div>
      </header>
      <section className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
        <p className="text-[11px] font-bold uppercase text-coral">Coffee-T cafés</p>
        <h1 className="mt-3 font-display text-5xl">Find your table.</h1>
        <div className="mt-9 grid gap-8 lg:grid-cols-[0.85fr_1.15fr]">
          <section aria-labelledby="locations-title">
            <h2 className="border-b border-ink/20 pb-3 font-display text-2xl" id="locations-title">Locations</h2>
            <div className="divide-y divide-ink/10">
              {activeCafes.map((cafe) => (
                <button aria-pressed={selectedCafe === cafe.id} className={`block w-full py-4 text-left ${selectedCafe === cafe.id ? 'text-leaf' : ''}`} key={cafe.id} onClick={() => setSelectedCafe(cafe.id)} type="button">
                  <span className="flex items-center justify-between gap-3"><strong>{cafe.name}</strong><MapPin size={16} aria-hidden="true" /></span>
                  <span className="mt-1 block text-xs text-muted">{cafe.city}</span>
                </button>
              ))}
              {upcomingCafes.map((cafe) => <div className="py-4" key={cafe.id}><p className="font-semibold">{cafe.name}</p><p className="mt-1 text-xs text-muted">{cafe.city} · Opening soon</p></div>)}
              {!cafes.length && <p className="py-4 text-sm text-muted">No café locations are listed yet.</p>}
            </div>
          </section>
          <section aria-labelledby="booking-title">
            <div className="flex items-end justify-between gap-3 border-b border-ink/20 pb-3"><h2 className="font-display text-2xl" id="booking-title">Reserve a table</h2><CalendarDays size={20} /></div>
            <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_1fr]">
              <label className="grid gap-2 text-xs font-bold uppercase">Date<input className="min-h-11 border border-ink/20 bg-white px-3 text-sm normal-case" min={initialDate} onChange={(event) => setDate(event.target.value)} type="date" value={date} /></label>
              <label className="grid gap-2 text-xs font-bold uppercase">Party size<select className="min-h-11 border border-ink/20 bg-white px-3 text-sm normal-case" onChange={(event) => setPartySize(Number(event.target.value))} value={partySize}>{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1} {index === 0 ? 'guest' : 'guests'}</option>)}</select></label>
            </div>
            {availability && <p className="mt-4 text-xs text-muted">Times shown in {availability.cafe.timezone} · {availability.durationMinutes} minutes</p>}
            {error && <p className="mt-5 border-l-4 border-coral bg-white px-4 py-3 text-sm" role="alert">{error} {!signedIn && <Link className="font-bold underline" href="/account">Sign in</Link>}</p>}
            {notice && <p className="mt-5 border-l-4 border-leaf bg-mint px-4 py-3 text-sm" role="status">{notice}</p>}
            {loading ? <p className="py-8 text-sm text-muted">Checking times…</p> : availability ? (
              availability.slots.length ? <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">{availability.slots.map((slot) => (
                <button className="min-h-14 border border-ink/20 bg-white px-3 text-left transition-colors hover:border-leaf hover:bg-mint disabled:opacity-50" key={slot.startsAt} onClick={() => void book(slot.startsAt)} type="button">
                  <span className="block font-bold">{new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: availability.cafe.timezone }).format(new Date(slot.startsAt))}</span>
                  <span className="mt-1 block text-[10px] text-muted">{slot.tablesAvailable} available</span>
                </button>
              ))}</div> : <p className="border-y border-ink/15 py-8 text-sm text-muted">No tables are available for this date and party size.</p>
            ) : <p className="py-8 text-sm text-muted">Choose a café to see available times.</p>}
          </section>
        </div>
      </section>
    </main>
  );
}