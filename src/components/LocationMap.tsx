"use client";

import "leaflet/dist/leaflet.css";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";

type LocationItem = {
  location: string;
  count: number;
  lat: number | null;
  lng: number | null;
  dateMin: number | null;
  dateMax: number | null;
  types: { type: string; count: number }[];
};

function formatDate(value: number | null) {
  return value ? new Intl.DateTimeFormat("zh-TW").format(new Date(value)) : "無日期";
}

export default function LocationMap({ locations }: { locations: LocationItem[] }) {
  const points = locations.filter((item) => item.lat && item.lng);
  return (
    <div className="ledger-panel h-[520px] overflow-hidden" data-testid="location-map">
      <MapContainer center={[25.0478, 121.5319]} zoom={12} className="h-full w-full" scrollWheelZoom={false}>
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {points.map((item) => (
          <Marker key={item.location} position={[item.lat as number, item.lng as number]}>
            <Popup>
              <div className="space-y-1 text-sm">
                <div className="font-semibold">{item.location}</div>
                <div>事件數：{item.count}</div>
                <div>日期：{formatDate(item.dateMin)} 至 {formatDate(item.dateMax)}</div>
                <div>{item.types.map((type) => `${type.type} ${type.count}`).join("、")}</div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
