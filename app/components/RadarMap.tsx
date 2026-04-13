"use client";
import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

function ChangeView({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.flyTo(center, 15, { duration: 1.5 });
  }, [center, map]);
  return null;
}

// ✨ CUSTOM HTML AVATAR GENERATOR
const createAvatarIcon = (name: string) => {
  const initial = name ? name.charAt(0).toUpperCase() : '?';
  const firstName = name ? name.split(' ')[0] : 'User';

  return L.divIcon({
    className: 'bg-transparent border-none', // Removes default Leaflet white square styling
    html: `
      <div style="display: flex; flex-direction: column; align-items: center; width: 80px; transform: translateX(-22px);">
        <div style="background: linear-gradient(135deg, #6366f1, #a855f7); color: white; height: 36px; width: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 16px; border: 3px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.3); z-index: 10;">
          ${initial}
        </div>
        <div style="background: rgba(15, 23, 42, 0.85); color: white; font-size: 10px; font-weight: 800; padding: 4px 8px 3px 8px; border-radius: 12px; margin-top: -6px; text-align: center; white-space: nowrap; backdrop-filter: blur(4px); border: 1px solid rgba(255,255,255,0.2); box-shadow: 0 2px 4px rgba(0,0,0,0.2); z-index: 5; padding-top: 8px;">
          ${firstName}
        </div>
      </div>
    `,
    iconSize: [36, 50],
    iconAnchor: [18, 25], // Perfect center anchoring
    popupAnchor: [0, -25] // Makes the popup open just above the avatar
  });
};

export default function RadarMap({ myLatestCoords, liveMembers }: { myLatestCoords: [number, number] | null, liveMembers: any[] }) {
  
  useEffect(() => {
    // Fix default Leaflet icons (fallback just in case)
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });
  }, []);

  return (
    <MapContainer 
      center={myLatestCoords || [20.5937, 78.9629]} 
      zoom={myLatestCoords ? 15 : 4} 
      style={{ height: '100%', width: '100%', zIndex: 0 }}
      zoomControl={false}
    >
      <TileLayer
        attribution='© <a href="https://stadiamaps.com/">Stadia Maps</a>'
        url="https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png"
      />
      
      {myLatestCoords && <ChangeView center={myLatestCoords} />}

      {/* Render all active members with Custom Avatars */}
      {liveMembers.map((member, i) => (
        <Marker 
          key={i} 
          position={[member.lat, member.lng]} 
          icon={createAvatarIcon(member.userName)}
        >
          <Popup>
            <div className="p-2 font-sans text-center min-w-[130px]">
              <h5 className="font-black text-slate-900 m-0 text-sm">{member.userName}</h5>
              <p className="text-[9px] font-bold text-emerald-500 m-0 uppercase tracking-widest mt-1 mb-4 flex items-center justify-center">
                <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full mr-1.5 animate-pulse"></span> Live Now
              </p>
              
              {/* ✨ NEW: ONE-CLICK NAVIGATION BUTTON */}
              <a 
                href={`https://www.google.com/maps/dir/?api=1&destination=${member.lat},${member.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center w-full bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest px-3 py-2.5 rounded-lg hover:bg-indigo-500 transition-colors shadow-md shadow-indigo-500/30 no-underline"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5">
                  <polygon points="3 11 22 2 13 21 11 13 3 11"></polygon>
                </svg>
                Navigate
              </a>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}