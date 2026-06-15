import React, { useState, useMemo } from "react";

// ---- Tarif-Annahmen (Stand 2026, grobe Werte) ----
const RATES = {
  miles: { km: 0.89, silber: 0.10, unlock: 1, pp: 2 }, // M-Modell, Silber -10% auf km
  sixt: { minute: 0.09, day: 49, inclKm: 200, extraKm: 0.29, unlock: 1 }, // 200 km/Tag inkl., dynamisch
  cambio: { dayCap: 33, hour: 2, km: 0.28 },            // stationsbasiert, Sprit inkl.
  rental: { tiers: [[1, 39], [3, 33], [6, 30], [999, 26]], fuelPerKm: 0.12 }, // + Sprit
};

const OPTIONS = [
  { key: "miles", name: "MILES M", tag: "Free-Floating", color: "#0f766e", spontaneous: true,
    note: "Spontan, Parken & Sprit inklusive. Auto zwischendurch abstellen kostet 0,09 €/min – darum bei langen Tagen teuer." },
  { key: "sixt", name: "SIXT share", tag: "Free-Floating Tagespaket", color: "#E1581E", spontaneous: true,
    note: "Tagespaket ~49 € mit 200 km inkl. (oder Minutentarif 0,09 €/min) – Sprit & Parken inklusive. Preise schwanken nach Uhrzeit/Auslastung; in der App prüfen." },
  { key: "cambio", name: "cambio", tag: "stationsbasiert", color: "#2563a8", spontaneous: false,
    note: "Günstig bei wenig km. Auto an fester Station abholen & zurückbringen – nur sinnvoll mit Station in der Nähe." },
  { key: "rental", name: "Mietwagen", tag: "klassisch, vorab buchen", color: "#9A6A2E", spontaneous: false,
    note: "Unbegrenzte km, Versicherung inkl. – Sprit zahlst du selbst. Bei langen Strecken / mehreren Tagen am günstigsten. 2–3 Wochen vorher übers Portal buchen." },
];

const PRESETS = [
  { label: "Kurz in der Stadt", km: 12, hours: 2 },
  { label: "Tagesausflug", km: 120, hours: 8 },
  { label: "Wochenende Familie", km: 660, hours: 56 },
  { label: "Eine Woche", km: 1500, hours: 168 },
];

const eur = (n) => n.toLocaleString("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const eur2 = (n) => n.toLocaleString("de-DE", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 });

function rentalDayRate(days) {
  for (const [maxD, rate] of RATES.rental.tiers) if (days <= maxD) return rate;
  return 26;
}

function compute(km, hours, opts) {
  const days = Math.max(1, Math.ceil(hours / 24));
  const r = RATES;
  const milesRate = r.miles.km * (1 - (opts.silber ? r.miles.silber : 0));
  const milesKm = km * milesRate;
  const milesUnlock = 2 * r.miles.unlock;
  const milesPP = opts.pp ? 2 * r.miles.pp : 0;
  const miles = { total: milesKm + milesUnlock + milesPP, lines: [
    [km + " km × " + eur2(milesRate), milesKm],
    ["2× Unlock", milesUnlock],
    ...(opts.pp ? [["2× Protection Plus", milesPP]] : []),
  ] };

  const sxMins = hours * 60;
  const sxMinExtra = Math.max(0, km - r.sixt.inclKm) * r.sixt.extraKm;
  const sxMinTotal = sxMins * r.sixt.minute + sxMinExtra + r.sixt.unlock;
  const sxDayBase = days * r.sixt.day, sxDayIncl = days * r.sixt.inclKm;
  const sxDayExtra = Math.max(0, km - sxDayIncl) * r.sixt.extraKm;
  const sxDayTotal = sxDayBase + sxDayExtra + r.sixt.unlock;
  const sixt = sxDayTotal <= sxMinTotal
    ? { total: sxDayTotal, lines: [
        [days + " Tagespaket × " + eur(r.sixt.day) + " (je 200 km inkl.)", sxDayBase],
        ...(sxDayExtra > 0 ? [["+" + (km - sxDayIncl) + " km extra × " + eur2(r.sixt.extraKm), sxDayExtra]] : []),
        ["Unlock", r.sixt.unlock],
      ] }
    : { total: sxMinTotal, lines: [
        [sxMins + " Min × " + eur2(r.sixt.minute) + " (200 km inkl.)", sxMins * r.sixt.minute],
        ...(sxMinExtra > 0 ? [["+" + (km - r.sixt.inclKm) + " km extra × " + eur2(r.sixt.extraKm), sxMinExtra]] : []),
        ["Unlock", r.sixt.unlock],
      ] };

  const camTime = Math.min(hours * r.cambio.hour, days * r.cambio.dayCap), camKm = km * r.cambio.km;
  const cambio = { total: camTime + camKm, lines: [
    ["Zeit (gedeckelt " + days + "× " + eur(r.cambio.dayCap) + ")", camTime],
    [km + " km × " + eur2(r.cambio.km) + " (Sprit inkl.)", camKm],
  ] };

  const dr = rentalDayRate(days), rentBase = days * dr, fuel = km * r.rental.fuelPerKm;
  const rental = { total: rentBase + fuel, lines: [
    [days + " Tag" + (days > 1 ? "e" : "") + " × " + eur(dr) + " (unbegr. km)", rentBase],
    ["Sprit ~" + km + " km × " + eur2(r.rental.fuelPerKm), fuel],
  ] };

  return { miles, sixt, cambio, rental };
}

export default function FahrtRechner() {
  const [km, setKm] = useState(120);
  const [hours, setHours] = useState(8);
  const [silber, setSilber] = useState(true);
  const [pp, setPp] = useState(true);
  const [spontanOnly, setSpontanOnly] = useState(false);

  const results = useMemo(() => compute(Number(km) || 0, Number(hours) || 0, { silber, pp }), [km, hours, silber, pp]);

  const ranked = useMemo(() => OPTIONS.map((o) => ({ ...o, ...results[o.key] }))
    .filter((o) => (spontanOnly ? o.spontaneous : true))
    .sort((a, b) => a.total - b.total), [results, spontanOnly]);

  const maxCost = Math.max(...ranked.map((o) => o.total), 1);
  const cheapest = ranked[0];
  const runner = ranked[1];

  const recommendation = useMemo(() => {
    if (!cheapest) return null;
    const miles = ranked.find((o) => o.key === "miles");
    const short = Number(km) <= 40 && Number(hours) <= 3;
    if (short && miles && miles.total <= cheapest.total + 6)
      return { pick: miles, reason: "Kurz und spontan – MILES ist hier am praktischsten und kaum teurer." };
    let reason;
    if (cheapest.key === "rental") reason = "Lange Strecke bzw. mehrere Tage – der klassische Mietwagen mit unbegrenzten km gewinnt klar.";
    else if (cheapest.key === "sixt") reason = "Tagestour mit etwas Distanz – der Free-Floating-Tagestarif ist günstig und spontan.";
    else if (cheapest.key === "cambio") reason = "Wenig Kilometer – cambio ist am günstigsten, sofern eine Station in der Nähe ist.";
    else reason = "Kurz und spontan – MILES ist hier die beste Wahl.";
    return { pick: cheapest, reason };
  }, [ranked, cheapest, km, hours]);

  const Toggle = ({ on, set, label, sub }) => (
    <button onClick={() => set(!on)} className="flex items-center gap-3 text-left w-full">
      <span className={"relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors " + (on ? "bg-teal-700" : "bg-stone-300")}>
        <span className={"absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transform transition-transform " + (on ? "translate-x-5" : "translate-x-0")} />
      </span>
      <span>
        <span className="block text-xs font-medium text-stone-800">{label}</span>
        {sub && <span className="block text-stone-500 leading-tight" style={{ fontSize: "11px" }}>{sub}</span>}
      </span>
    </button>
  );

  return (
    <div className="min-h-screen w-full bg-stone-100 text-stone-900" style={{ fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif" }}>
      <div className="mx-auto max-w-2xl px-4 py-8">

        <header className="mb-6">
          <div className="text-xs font-semibold uppercase tracking-widest text-teal-700">Fahrt-Rechner · Berlin</div>
          <h1 className="mt-1 text-3xl font-bold leading-tight tracking-tight">Welches Angebot für diese Fahrt?</h1>
          <p className="mt-2 text-sm text-stone-600">Strecke und Dauer eingeben – der Rechner vergleicht MILES, SIXT share, cambio und Mietwagen und empfiehlt das passende.</p>
        </header>

        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-200">
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => {
              const active = Number(km) === p.km && Number(hours) === p.hours;
              return (
                <button key={p.label} onClick={() => { setKm(p.km); setHours(p.hours); }}
                  className={"rounded-full px-3 py-1.5 text-xs font-medium transition-colors " + (active ? "bg-teal-700 text-white" : "bg-stone-100 text-stone-700 hover:bg-stone-200")}>
                  {p.label}
                </button>
              );
            })}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs font-medium text-stone-500">Strecke gesamt (hin & zurück)</span>
              <div className="mt-1 flex items-baseline gap-1.5 border-b-2 border-stone-200 focus-within:border-teal-700">
                <input type="number" min="0" value={km} onChange={(e) => setKm(e.target.value)}
                  className="w-full bg-transparent py-1 text-2xl font-semibold tabular-nums outline-none" />
                <span className="text-sm text-stone-400">km</span>
              </div>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-stone-500">Wie lange brauchst du es?</span>
              <div className="mt-1 flex items-baseline gap-1.5 border-b-2 border-stone-200 focus-within:border-teal-700">
                <input type="number" min="0" value={hours} onChange={(e) => setHours(e.target.value)}
                  className="w-full bg-transparent py-1 text-2xl font-semibold tabular-nums outline-none" />
                <span className="text-sm text-stone-400">Std.</span>
              </div>
            </label>
          </div>

          <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-stone-100 pt-4">
            <Toggle on={silber} set={setSilber} label="Silber Pass" sub="−10 % auf km-Tarif" />
            <Toggle on={pp} set={setPp} label="Protection Plus" sub="senkt Selbstbeteiligung" />
            <Toggle on={spontanOnly} set={setSpontanOnly} label="Nur spontan" sub="ohne Vorbuchen" />
          </div>
        </section>

        {recommendation && (
          <section className="mt-5 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-stone-200">
            <div className="flex items-center gap-3 px-5 py-4" style={{ background: recommendation.pick.color }}>
              <div className="text-white">
                <div className="text-xs font-semibold uppercase tracking-widest" style={{ opacity: 0.85 }}>Empfehlung</div>
                <div className="text-xl font-bold leading-tight">{recommendation.pick.name}</div>
              </div>
              <div className="ml-auto text-right text-white">
                <div className="text-2xl font-bold tabular-nums">{eur(recommendation.pick.total)}</div>
                <div className="text-xs" style={{ opacity: 0.85 }}>für diese Fahrt</div>
              </div>
            </div>
            <p className="px-5 py-3 text-sm text-stone-700">
              {recommendation.reason}
              {runner && recommendation.pick.key !== runner.key && (
                <> Nächstgünstig: <span className="font-medium">{runner.name}</span> ({eur(runner.total)}).</>
              )}
            </p>
          </section>
        )}

        <section className="mt-5">
          <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-stone-500">Alle Optionen im Vergleich</div>
          <div className="space-y-2.5">
            {ranked.map((o, i) => (
              <div key={o.key} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200"
                style={i === 0 ? { boxShadow: "0 0 0 2px " + o.color } : {}}>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: o.color }} />
                  <span className="font-semibold">{o.name}</span>
                  <span className="rounded-full bg-stone-100 px-2 py-0.5 font-medium text-stone-500" style={{ fontSize: "10.5px" }}>{o.tag}</span>
                  {i === 0 && <span className="rounded-full px-2 py-0.5 font-semibold text-white" style={{ fontSize: "10.5px", background: o.color }}>günstigste</span>}
                  <span className="ml-auto text-lg font-bold tabular-nums">{eur(o.total)}</span>
                </div>
                <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-stone-100">
                  <div className="h-full rounded-full transition-all" style={{ width: Math.max(4, (o.total / maxCost) * 100) + "%", background: o.color }} />
                </div>
                <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-0.5">
                  {o.lines.map(([label, val], k) => (
                    <span key={k} className="text-stone-500" style={{ fontSize: "11.5px" }}>
                      {label}: <span className="tabular-nums text-stone-700">{eur2(val)}</span>
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-stone-500 leading-snug" style={{ fontSize: "11.5px" }}>{o.note}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-2xl bg-teal-50 p-4 ring-1 ring-teal-200">
          <div className="text-xs font-semibold uppercase tracking-widest text-teal-700">Kurz gemerkt</div>
          <ul className="mt-2 space-y-1.5 text-sm text-stone-700">
            <li>· <b>Kurz &amp; spontan in der Stadt</b> → MILES M (+ Protection Plus)</li>
            <li>· <b>Tagesausflug mit Distanz</b> → SIXT share Tagestarif (unbegrenzte km)</li>
            <li>· <b>Wenig km, Station um die Ecke</b> → cambio</li>
            <li>· <b>Lange Strecke / mehrere Tage</b> (Familie, Urlaub) → Mietwagen vorab buchen</li>
          </ul>
        </section>

        <details className="mt-4 text-xs text-stone-500">
          <summary className="cursor-pointer font-medium text-stone-600">Annahmen &amp; Tarife anzeigen</summary>
          <div className="mt-2 space-y-1 leading-relaxed">
            <p>MILES M: {eur2(RATES.miles.km)}/km (Silber −10 %), 1 € Unlock, Protection Plus ~2 €/Anmietung; Hin- &amp; Rückfahrt als 2 Anmietungen gerechnet. Parken &amp; Sprit inkl.</p>
            <p>SIXT share: Tagespaket ab ~{eur(RATES.sixt.day)} mit {RATES.sixt.inclKm} km inkl. (oder {eur2(RATES.sixt.minute)}/Min), Extra-km ~{eur2(RATES.sixt.extraKm)}, Unlock ~{eur(RATES.sixt.unlock)}; Sprit inkl. Dynamisch – App-Preis prüfen.</p>
            <p>cambio: Zeit ~{eur(RATES.cambio.hour)}/Std. (gedeckelt ~{eur(RATES.cambio.dayCap)}/Tag) + {eur2(RATES.cambio.km)}/km inkl. Sprit; stationsbasiert.</p>
            <p>Mietwagen: ~26–39 €/Tag je nach Dauer, unbegrenzte km, Versicherung inkl., Sprit extra (~{eur2(RATES.rental.fuelPerKm)}/km).</p>
            <p className="pt-1 text-stone-400">Grobe Schätzwerte (Stand 2026), keine Finanzberatung. Tagesaktuelle Preise in der jeweiligen App prüfen.</p>
          </div>
        </details>
      </div>
    </div>
  );
}
