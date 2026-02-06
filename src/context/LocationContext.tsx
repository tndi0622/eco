'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface LocationContextType {
    location: string;
    setLocation: (loc: string) => void;
    detectLocation: () => void;
    isLoading: boolean;
    coordinates: { lat: number; lng: number } | null;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export function LocationProvider({ children }: { children: ReactNode }) {
    const [location, setLocationState] = useState<string>("위치 설정이 필요합니다");
    const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const saved = localStorage.getItem('userLocation');
        // Retrieve saved coordinates if available (optional, but good for persistence)
        // For now, let's just rely on re-detection or re-setting. 
        // Or better yet, save coordinates to localStorage too.
        const savedCoords = localStorage.getItem('userCoordinates');

        if (saved) {
            setLocationState(saved);
        }
        if (savedCoords) {
            try {
                setCoordinates(JSON.parse(savedCoords));
            } catch (e) {
                console.error("Failed to parse saved coordinates", e);
            }
        }

        if (!saved) {
            // Auto detect on first load if no location
            detectLocation();
        }
    }, []);

    const setLocation = (loc: string) => {
        setLocationState(loc);
        localStorage.setItem('userLocation', loc);
    };

    // Helper to manually set coordinates (e.g. if we add a map picker later)
    // For now, mostly internal use.
    const updateCoordinates = (lat: number, lng: number) => {
        const coords = { lat, lng };
        setCoordinates(coords);
        localStorage.setItem('userCoordinates', JSON.stringify(coords));
    };

    const detectLocation = () => {
        if (!navigator.geolocation) {
            setLocation("위치 권한 미지원");
            return;
        }
        setIsLoading(true);
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                // Store coordinates immediately!
                updateCoordinates(latitude, longitude);

                try {
                    const res = await fetch(
                        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`
                    );
                    const data = await res.json();

                    let addr = "";
                    if (data.address) {
                        const city = data.address.city || data.address.town || data.address.county || data.address.province || "";
                        const district = data.address.suburb || data.address.borough || data.address.neighbourhood || data.address.district || "";
                        const road = data.address.road || "";
                        const houseNumber = data.address.house_number || "";
                        const building = data.address.building || data.address.amenity || data.address.shop || "";

                        // Construct: City District Road HouseNumber (Building)
                        const parts = [city, district, road, houseNumber].filter(Boolean);
                        addr = parts.join(" ");

                        if (building) {
                            addr += ` (${building})`;
                        }
                    } else {
                        addr = data.display_name ? data.display_name.split(",").slice(0, 4).join(" ") : "알 수 없는 위치";
                    }
                    setLocation(addr);
                } catch (error) {
                    console.error("Geocoding error", error);
                    setLocation("위치 확인 실패");
                } finally {
                    setIsLoading(false);
                }
            },
            (error) => {
                console.error("Geolocation error", error);
                const msg = error.code === 1 ? "위치 권한을 허용해주세요" : "위치 파악 실패";
                setLocation(msg);
                setIsLoading(false);
            }
        );
    };

    return (
        <LocationContext.Provider value={{ location, setLocation, detectLocation, isLoading, coordinates }}>
            {children}
        </LocationContext.Provider>
    );
}

export function useLocation() {
    const context = useContext(LocationContext);
    if (!context) throw new Error('useLocation must be used within LocationProvider');
    return context;
}
