"use client";

import "leaflet/dist/leaflet.css";
import { useMemo, useState } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";
import { formatDate, formatViolationType, Language, mapCopy, separatorFor } from "./uiLanguage";

type LocationItem = {
  location: string;
  count: number;
  lat: number | null;
  lng: number | null;
  dateMin: number | null;
  dateMax: number | null;
  types: { type: string; count: number }[];
};

const DEFAULT_VISIBLE_LOCATIONS = 12;

function formatTypes(types: LocationItem["types"], language: Language) {
  return types.map((type) => `${formatViolationType(type.type, language)} ${type.count}`).join(separatorFor(language));
}

export default function LocationMap({ locations, language = "zh" }: { locations: LocationItem[]; language?: Language }) {
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const t = mapCopy[language];
  const points = useMemo(
    () =>
      locations
        .filter((item) => item.lat !== null && item.lng !== null)
        .sort((a, b) => b.count - a.count || a.location.localeCompare(b.location)),
    [locations]
  );
  const filteredPoints = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return points;
    return points.filter((item) => item.location.toLowerCase().includes(keyword));
  }, [points, search]);
  const visiblePoints = showAll ? filteredPoints : filteredPoints.slice(0, DEFAULT_VISIBLE_LOCATIONS);
  const hiddenCount = Math.max(filteredPoints.length - visiblePoints.length, 0);

  return (
    <div className="ledger-panel grid overflow-hidden md:grid-cols-[340px_1fr]" data-testid="location-map">
      <aside className="border-b border-[var(--line)] bg-[var(--paper-strong)] p-4 md:max-h-[520px] md:overflow-y-auto md:border-b-0 md:border-r">
        <div className="text-sm font-semibold text-[var(--ink)]">{t.title}</div>
        <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{t.subtitle}</p>
        <input value={search} onChange={(event) => setSearch(event.target.value)} className="focus-ring mt-3 w-full border border-[var(--line)] bg-white p-2 text-sm" placeholder={t.searchPlaceholder} data-testid="map-location-search" />
        <div className="mt-3 text-xs text-[var(--muted)]">{t.showing(visiblePoints.length, filteredPoints.length)}</div>
        {hiddenCount ? <div className="mt-1 text-xs text-[var(--muted)]">{t.hidden(hiddenCount)}</div> : null}
        {filteredPoints.length > DEFAULT_VISIBLE_LOCATIONS ? (
          <button type="button" onClick={() => setShowAll((value) => !value)} className="focus-ring mt-3 border border-[var(--ink)] px-3 py-2 text-xs font-medium transition hover:bg-[var(--ink)] hover:text-white" data-testid="map-show-all">
            {showAll ? t.showLess : t.showAll}
          </button>
        ) : null}

        <div className="mt-4 space-y-2">
          {!points.length ? <p className="text-sm text-[var(--muted)]">{t.noGeocoded}</p> : null}
          {points.length && !filteredPoints.length ? <p className="text-sm text-[var(--muted)]">{t.noMatches}</p> : null}
          {visiblePoints.map((item) => {
            const selected = selectedLocation === item.location;
            return (
              <button key={item.location} type="button" onClick={() => setSelectedLocation(item.location)} className={`focus-ring w-full border p-3 text-left text-sm transition ${selected ? "border-[var(--ink)] bg-white shadow-sm" : "border-[var(--line)] bg-[#fbf7ee] hover:border-[var(--civic-green)]"}`}>
                <span className="block font-medium text-[var(--ink)]">{item.location}</span>
                <span className="mt-1 block text-xs text-[var(--muted)]">
                  {t.incidents}: {item.count}
                </span>
                <span className="mt-1 block text-xs text-[var(--muted)]">
                  {t.date}: {formatDate(item.dateMin, language, t.noDate)} {t.to} {formatDate(item.dateMax, language, t.noDate)}
                </span>
                <span className="mt-1 block text-xs text-[var(--muted)]">
                  {t.typeBreakdown}: {formatTypes(item.types, language)}
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      <div className="h-[520px]">
        <MapContainer center={[25.0478, 121.5319]} zoom={12} className="h-full w-full" scrollWheelZoom={false}>
          <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {visiblePoints.map((item) => {
            const selected = selectedLocation === item.location;
            return (
              <CircleMarker
                key={item.location}
                center={[item.lat as number, item.lng as number]}
                radius={Math.min(24, 8 + item.count * 3)}
                pathOptions={{
                  color: selected ? "#1f2937" : "#b42318",
                  fillColor: selected ? "#f59e0b" : "#d92d20",
                  fillOpacity: selected ? 0.72 : 0.48,
                  opacity: 0.9,
                  weight: selected ? 3 : 2,
                }}
                eventHandlers={{ click: () => setSelectedLocation(item.location) }}
              >
                <Popup>
                  <div className="space-y-1 text-sm">
                    <div className="font-semibold">{item.location}</div>
                    <div>
                      {t.incidents}: {item.count}
                    </div>
                    <div>
                      {t.date}: {formatDate(item.dateMin, language, t.noDate)} {t.to} {formatDate(item.dateMax, language, t.noDate)}
                    </div>
                    <div>
                      {t.typeBreakdown}: {formatTypes(item.types, language)}
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
}
