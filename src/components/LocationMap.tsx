"use client";

import "leaflet/dist/leaflet.css";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";

type Language = "zh" | "en";

type LocationItem = {
  location: string;
  count: number;
  lat: number | null;
  lng: number | null;
  dateMin: number | null;
  dateMax: number | null;
  types: { type: string; count: number }[];
};

const copy = {
  zh: {
    incidents: "事件數",
    date: "日期",
    to: "至",
    noDate: "無日期",
    separator: "、",
  },
  en: {
    incidents: "Incidents",
    date: "Date",
    to: "to",
    noDate: "No date",
    separator: ", ",
  },
} as const;

const typeLabels: Record<string, Record<Language, string>> = {
  酒駕: { zh: "酒駕", en: "Drunk driving" },
  毒駕: { zh: "毒駕", en: "Drug-impaired driving" },
  藥駕: { zh: "藥駕", en: "Drug-impaired driving" },
  吸食毒品: { zh: "吸食毒品", en: "Drug use" },
  拒測: { zh: "拒測", en: "Test refusal" },
  無照: { zh: "無照", en: "Unlicensed" },
};

function formatDate(value: number | null, language: Language) {
  return value ? new Intl.DateTimeFormat(language === "zh" ? "zh-TW" : "en-US").format(new Date(value)) : copy[language].noDate;
}

function formatType(type: string, language: Language) {
  return typeLabels[type]?.[language] ?? type;
}

export default function LocationMap({ locations, language = "zh" }: { locations: LocationItem[]; language?: Language }) {
  const points = locations.filter((item) => item.lat && item.lng);
  const t = copy[language];

  return (
    <div className="ledger-panel h-[520px] overflow-hidden" data-testid="location-map">
      <MapContainer center={[25.0478, 121.5319]} zoom={12} className="h-full w-full" scrollWheelZoom={false}>
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {points.map((item) => (
          <Marker key={item.location} position={[item.lat as number, item.lng as number]}>
            <Popup>
              <div className="space-y-1 text-sm">
                <div className="font-semibold">{item.location}</div>
                <div>
                  {t.incidents}: {item.count}
                </div>
                <div>
                  {t.date}: {formatDate(item.dateMin, language)} {t.to} {formatDate(item.dateMax, language)}
                </div>
                <div>{item.types.map((type) => `${formatType(type.type, language)} ${type.count}`).join(t.separator)}</div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
