"use client";
import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet icon issue
const fixLeafletIcon = () => {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });
};

function LocationMarker({ lat, lng, setLat, setLng }: { lat: string, lng: string, setLat: any, setLng: any }) {
  const map = useMapEvents({
    click(e: any) {
      setLat(e.latlng.lat.toFixed(6));
      setLng(e.latlng.lng.toFixed(6));
      map.flyTo(e.latlng, 16);
    },
  });

  useEffect(() => {
    fixLeafletIcon();
    if (lat && lng && !isNaN(Number(lat)) && !isNaN(Number(lng))) {
      map.flyTo([Number(lat), Number(lng)], map.getZoom() > 10 ? map.getZoom() : 16);
    }
  }, [lat, lng, map]);

  return lat && lng && !isNaN(Number(lat)) && !isNaN(Number(lng)) ? (
    <Marker position={[Number(lat), Number(lng)]}></Marker>
  ) : null;
}

export default function PartnerMap({ latitude, longitude, setLatitude, setLongitude }: any) {
  return (
    <MapContainer 
      center={latitude && longitude && !isNaN(Number(latitude)) && !isNaN(Number(longitude)) ? [Number(latitude), Number(longitude)] : [20.5937, 78.9629]} 
      zoom={latitude && longitude ? 16 : 4} 
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <LocationMarker lat={latitude} lng={longitude} setLat={setLatitude} setLng={setLongitude} />
    </MapContainer>
  );
}