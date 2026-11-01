'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { CalendarCheck, Clock, MapPin, Store, Users } from 'lucide-react';
import { errorMessage, isAbortError } from '@/lib/api';
import {
  CafeAvailability,
  CafeLocation,
  createReservation,
  getCafes,
  getReservationAvailability,
  ReservationSlot,
} from '@/lib/cafe-api';
import { addDays, formatDateTime, formatTime, todayIn } from '@/lib/format';
import { useSession } from './session-provider';
import { useToast } from './toast';
import { Alert, Badge, Button, Card, cx, EmptyState, QuantityStepper, Skeleton } from './ui';

// Mirrors the API default BOOKING_ADVANCE_DAYS; the API remains the source of truth.
const ADVANCE_DAYS = 30;
const QUICK_DAYS = 7;

export function CafeDiscovery() {
  const { status } = useSession();
  const router = useRouter();
  const toast = useToast();
  const [cafes, setCafes] = useState<CafeLocation[] | null>(null);
  const [cafesError, setCafesError] = useState('');
  const [cafeId, setCafeId] = useState('');
  const [date, setDate] = useState('');
  const [partySize, setPartySize] = useState(2);
  const [availability, setAvailability] = useState<CafeAvailability | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState('');
  const [selectedSlot, setSelectedSlot] = useState<ReservationSlot | null>(null);
  const [booking, setBooking] = useState(false);
  const [confirmation, setConfirmation] = useState('');

  useEffect(() => {
    getCafes()
      .then((result) => {
        setCafes(result);
        const firstActive = result.find((cafe) => cafe.status === 'active');
        if (firstActive) setCafeId(firstActive.id);
      })
      .catch((error: unknown) => setCafesError(errorMessage(error, 'Cafés could not be loaded.')));
  }, []);

  const cafe = cafes?.find((candidate) => candidate.id === cafeId);
  const today = useMemo(() => (cafe ? todayIn(cafe.timezone) : ''), [cafe]);

  useEffect(() => {
    if (today && (!date || date < today)) setDate(today);
  }, [today, date]);

  useEffect(() => {
    if (!cafeId || !date) return;
    const controller = new AbortController();
    setLoadingSlots(true);
    setSlotsError('');
    setSelectedSlot(null);
    getReservationAvailability(cafeId, date, partySize, controller.signal)
      .then(setAvailability)
      .catch((error: unknown) => {
        if (!isAbortError(error)) {
          setAvailability(null);
          setSlotsError(errorMessage(error, 'Availability could not be loaded.'));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingSlots(false);
      });
    return () => controller.abort();
  }, [cafeId, date, partySize]);

  async function confirmBooking(): Promise<void> {
    if (!selectedSlot || !availability) return;
    if (status !== 'authenticated') {
      router.push(`/account?next=${encodeURIComponent('/cafe')}`);
      return;
    }
    setBooking(true);
    try {
      const reservation = await createReservation(cafeId, selectedSlot.startsAt, partySize);
      const when = formatDateTime(reservation.startsAt, availability.cafe.timezone);
      setConfirmation(`${availability.cafe.name} · ${when} · ${partySize} ${partySize === 1 ? 'guest' : 'guests'}`);
      toast.show('Your table is booked');
      setAvailability((current) =>
        current
          ? {
              ...current,
              slots: current.slots
                .map((slot) =>
                  slot.startsAt === selectedSlot.startsAt ? { ...slot, tablesAvailable: slot.tablesAvailable - 1 } : slot,
                )
                .filter((slot) => slot.tablesAvailable > 0),
            }
          : current,
      );
      setSelectedSlot(null);
    } catch (error) {
      toast.show(errorMessage(error, 'The reservation could not be completed.'), 'danger');
    } finally {
      setBooking(false);
    }
  }

  const active = cafes?.filter((candidate) => candidate.status === 'active') ?? [];
  const upcoming = cafes?.filter((candidate) => candidate.status === 'upcoming') ?? [];
  const quickDates = today ? Array.from({ length: QUICK_DAYS }, (_, index) => addDays(today, index)) : [];
  const maxDate = today ? addDays(today, ADVANCE_DAYS) : undefined;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sun-ink">Coffee-T cafés</p>
      <h1 className="mt-2 font-display text-4xl leading-tight sm:text-5xl">Reserve a table.</h1>
      <p className="mt-2 max-w-xl text-muted">Choose a café, pick a day and a time, and we will keep a table ready for you.</p>

      {confirmation && (
        <Alert
          className="mt-8"
          tone="success"
          title="Reservation confirmed"
          action={
            <Link className="text-sm font-semibold underline" href="/account?tab=reservations">
              View
            </Link>
          }
        >
          {confirmation}
        </Alert>
      )}

      <div className="mt-10 grid items-start gap-8 lg:grid-cols-[360px_1fr]">
        <section aria-labelledby="locations-title">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted" id="locations-title">
            1 · Choose a café
          </h2>
          <div className="mt-4 grid gap-3">
            {cafesError ? (
              <Alert tone="danger">{cafesError}</Alert>
            ) : !cafes ? (
              Array.from({ length: 3 }, (_, index) => <Skeleton className="h-20 rounded-2xl" key={index} />)
            ) : !cafes.length ? (
              <EmptyState icon={<Store size={22} aria-hidden="true" />} title="No cafés yet">
                We are opening our first cafés soon.
              </EmptyState>
            ) : (
              <>
                {active.map((candidate) => (
                  <button
                    aria-pressed={candidate.id === cafeId}
                    className={cx(
                      'flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-colors',
                      candidate.id === cafeId ? 'border-ink bg-sun-soft' : 'border-line bg-white hover:border-ink/40',
                    )}
                    key={candidate.id}
                    onClick={() => setCafeId(candidate.id)}
                    type="button"
                  >
                    <span className={cx('grid size-11 shrink-0 place-items-center rounded-xl', candidate.id === cafeId ? 'bg-sun' : 'bg-cloud')}>
                      <MapPin size={18} aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-semibold">{candidate.name}</span>
                      <span className="block truncate text-sm text-muted">{candidate.city ?? 'Coffee-T café'}</span>
                    </span>
                  </button>
                ))}
                {upcoming.map((candidate) => (
                  <div className="flex items-center gap-4 rounded-2xl border border-dashed border-line p-4" key={candidate.id}>
                    <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-cloud text-muted">
                      <MapPin size={18} aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-ink-soft">{candidate.name}</span>
                      <span className="block text-sm text-muted">{candidate.city}</span>
                    </span>
                    <Badge tone="soft">Opening soon</Badge>
                  </div>
                ))}
              </>
            )}
          </div>
        </section>

        <section aria-labelledby="booking-title">
          <Card className="p-5 sm:p-7">
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted" id="booking-title">
              2 · Pick a day &amp; party size
            </h2>
            {!cafe ? (
              <p className="mt-4 text-sm text-muted">Choose a café to see available times.</p>
            ) : (
              <>
                <div className="-mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1">
                  {quickDates.map((value, index) => {
                    const day = new Date(`${value}T12:00:00Z`);
                    return (
                      <button
                        aria-pressed={value === date}
                        className={cx(
                          'flex min-w-16 shrink-0 flex-col items-center rounded-2xl border px-3 py-2.5 transition-colors',
                          value === date ? 'border-ink bg-ink text-white' : 'border-line bg-white hover:border-ink/40',
                        )}
                        key={value}
                        onClick={() => setDate(value)}
                        type="button"
                      >
                        <span className={cx('text-[11px] font-semibold uppercase', value === date ? 'text-sun' : 'text-muted')}>
                          {index === 0 ? 'Today' : day.toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'UTC' })}
                        </span>
                        <span className="text-lg font-bold leading-tight">{day.getUTCDate()}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-5 flex flex-wrap items-end gap-6">
                  <label className="grid gap-1.5 text-xs font-semibold text-ink-soft">
                    Or choose a date
                    <input
                      className="min-h-11 rounded-xl border border-line bg-white px-3 text-sm outline-none focus:border-ink focus:ring-4 focus:ring-sun/40"
                      max={maxDate}
                      min={today}
                      onChange={(event) => event.target.value && setDate(event.target.value)}
                      type="date"
                      value={date}
                    />
                  </label>
                  <div className="grid gap-1.5">
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-ink-soft">
                      <Users size={14} aria-hidden="true" /> Guests
                    </span>
                    <QuantityStepper label="Party size" max={12} min={1} onChange={setPartySize} value={partySize} />
                  </div>
                </div>

                <h2 className="mt-8 text-sm font-semibold uppercase tracking-[0.12em] text-muted">3 · Choose a time</h2>
                {availability && (
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                    <Clock size={13} aria-hidden="true" /> Local time ({availability.cafe.timezone}) · tables are held for{' '}
                    {availability.durationMinutes} minutes
                  </p>
                )}
                <div className="mt-4">
                  {slotsError ? (
                    <Alert tone="danger">{slotsError}</Alert>
                  ) : loadingSlots ? (
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-6">
                      {Array.from({ length: 12 }, (_, index) => (
                        <Skeleton className="h-14" key={index} />
                      ))}
                    </div>
                  ) : availability?.slots.length ? (
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-6" role="radiogroup" aria-label="Available times">
                      {availability.slots.map((slot) => {
                        const selected = selectedSlot?.startsAt === slot.startsAt;
                        return (
                          <button
                            aria-checked={selected}
                            className={cx(
                              'flex min-h-14 flex-col items-center justify-center rounded-xl border px-2 transition-colors',
                              selected ? 'border-ink bg-sun' : 'border-line bg-white hover:border-ink/40',
                            )}
                            key={slot.startsAt}
                            onClick={() => setSelectedSlot(slot)}
                            role="radio"
                            type="button"
                          >
                            <span className="text-sm font-bold">{formatTime(slot.startsAt, availability.cafe.timezone)}</span>
                            <span className={cx('text-[11px]', selected ? 'text-ink-soft' : 'text-muted')}>
                              {slot.tablesAvailable} {slot.tablesAvailable === 1 ? 'table' : 'tables'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <EmptyState icon={<CalendarCheck size={22} aria-hidden="true" />} title="No tables left">
                      Try another day or a smaller party.
                    </EmptyState>
                  )}
                </div>

                {selectedSlot && availability && (
                  <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-cloud p-4">
                    <p className="text-sm">
                      <span className="font-semibold">{availability.cafe.name}</span>
                      <br />
                      {formatDateTime(selectedSlot.startsAt, availability.cafe.timezone)} · {partySize}{' '}
                      {partySize === 1 ? 'guest' : 'guests'}
                    </p>
                    <Button loading={booking} onClick={() => void confirmBooking()} size="lg">
                      {status === 'authenticated' ? 'Confirm booking' : 'Sign in to book'}
                    </Button>
                  </div>
                )}
              </>
            )}
          </Card>
        </section>
      </div>
    </div>
  );
}
