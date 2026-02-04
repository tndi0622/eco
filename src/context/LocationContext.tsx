'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface LocationContextType {
    location: string;
    setLocation: (loc: string) => void;
    detectLocation: () => void;
    isLoading: boolean;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export function LocationProvider({ children }: { children: ReactNode }) {
    const [location, setLocationState] = useState<string>("위치 설정이 필요합니다");
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const saved = localStorage.getItem('userLocation');
        if (saved) {
            setLocationState(saved);
        } else {
            // Auto detect on first load if no location
            detectLocation();
        }
    }, []);

    const setLocation = (loc: string) => {
        setLocationState(loc);
        localStorage.setItem('userLocation', loc);
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
                try {
                    const res = await fetch(
                        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`
                    );
                    const data = await res.json();

                    let addr = "";
                    if (data.address) {
                        const city = data.address.city || data.address.town || data.address.county || "";
                        const district = data.address.suburb || data.address.borough || data.address.neighbourhood || "";
                        const road = data.address.road || "";
                        addr = `${city} ${district} ${road}`.trim();
                        if (!addr) addr = data.display_name.split(",")[0];
                    } else {
                        addr = "알 수 없는 위치";
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
        <LocationContext.Provider value={{ location, setLocation, detectLocation, isLoading }}>
            {children}
        </LocationContext.Provider>
    );
}

export function useLocation() {
    const context = useContext(LocationContext);
    if (!context) throw new Error('useLocation must be used within LocationProvider');
    return context;
}
