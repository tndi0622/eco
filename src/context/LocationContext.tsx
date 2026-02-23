'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface FavoriteLocation {
    name: string;
    address: string;
    coordinates?: { lat: number; lng: number };
}

interface LocationContextType {
    location: string;
    setLocation: (loc: string) => void;
    detectLocation: () => Promise<{ address: string, coordinates: { lat: number; lng: number } | null, error?: string }>;
    isLoading: boolean;
    coordinates: { lat: number; lng: number } | null;
    favorites: FavoriteLocation[];
    addFavorite: (name: string, address: string, coords?: { lat: number; lng: number }) => void;
    removeFavorite: (name: string) => void;
    updateFavorite: (oldName: string, newName: string, newAddress: string, newCoords?: { lat: number; lng: number }) => void;
    promoteFavorite: (name: string) => void;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export function LocationProvider({ children }: { children: ReactNode }) {
    const [location, setLocationState] = useState<string>("위치 설정이 필요합니다");
    const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [favorites, setFavorites] = useState<FavoriteLocation[]>([]);

    useEffect(() => {
        const saved = localStorage.getItem('userLocation');
        const savedCoords = localStorage.getItem('userCoordinates');
        const savedFavorites = localStorage.getItem('userFavorites');

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
        if (savedFavorites) {
            try {
                setFavorites(JSON.parse(savedFavorites));
            } catch (e) {
                console.error("Failed to parse favorites", e);
            }
        }

        if (!saved) {
            detectLocation(); // Auto detect on first load if no location
        }
    }, []);

    const setLocation = (loc: string) => {
        setLocationState(loc);
        localStorage.setItem('userLocation', loc);
    };

    const updateCoordinates = (lat: number, lng: number) => {
        const coords = { lat, lng };
        setCoordinates(coords);
        localStorage.setItem('userCoordinates', JSON.stringify(coords));
    };

    const addFavorite = (name: string, address: string, coords?: { lat: number; lng: number }) => {
        const newFav = { name, address, coordinates: coords };

        // Check if address already exists
        const existingByAddress = favorites.find(f => f.address === address);

        // Check if name already exists (fallback, though address check takes precedence as per user request)
        const existingByName = favorites.find(f => f.name === name);

        let updated;

        if (existingByAddress) {
            // Same address exists -> Update name (and coords if new ones are better)
            // Remove the old one and add the new one at top (or replace in place? user said "change name")
            // Let's replace it and move to top as it's the "latest" interaction
            const others = favorites.filter(f => f.address !== address);
            updated = [newFav, ...others];
        } else if (existingByName) {
            // Same name exists (but different address) -> Update address
            const others = favorites.filter(f => f.name !== name);
            updated = [newFav, ...others];
        } else {
            // New location
            updated = [newFav, ...favorites];
        }

        setFavorites(updated);
        localStorage.setItem('userFavorites', JSON.stringify(updated));
    };

    const updateFavorite = (oldName: string, newName: string, newAddress: string, newCoords?: { lat: number; lng: number }) => {
        const updated = favorites.map(fav => {
            if (fav.name === oldName) {
                return {
                    name: newName,
                    address: newAddress,
                    coordinates: newCoords || fav.coordinates // Keep old coords if not provided
                };
            }
            return fav;
        });
        setFavorites(updated);
        localStorage.setItem('userFavorites', JSON.stringify(updated));

        // If the updated one was the active location, update the current location state too
        if (location === favorites.find(f => f.name === oldName)?.address) {
            setLocation(newAddress);
            if (newCoords) updateCoordinates(newCoords.lat, newCoords.lng);
        }
    };

    const removeFavorite = (name: string) => {
        const updated = favorites.filter(f => f.name !== name);
        setFavorites(updated);
        localStorage.setItem('userFavorites', JSON.stringify(updated));
    };

    const promoteFavorite = (name: string) => {
        const target = favorites.find(f => f.name === name);
        if (!target) return;
        const others = favorites.filter(f => f.name !== name);
        const updated = [target, ...others];
        setFavorites(updated);
        localStorage.setItem('userFavorites', JSON.stringify(updated));
        // Also update current location context to this address
        setLocation(target.address);
        if (target.coordinates) {
            setCoordinates(target.coordinates);
        }
    };

    const detectLocation = (): Promise<{ address: string, coordinates: { lat: number; lng: number } | null, error?: string }> => {
        return new Promise((resolve) => {
            if (!navigator.geolocation) {
                const msg = "위치 권한 미지원";
                setLocation(msg);
                resolve({ address: msg, coordinates: null, error: msg });
                return;
            }
            setIsLoading(true);

            // 모바일 브라우저의 경우 HTTPS가 아니면 위치 정보 기능을 차단할 수 있습니다.
            if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
                const msg = "보안 연결(HTTPS)이 필요합니다";
                setLocation(msg);
                setIsLoading(false);
                resolve({ address: msg, coordinates: null, error: msg });
                return;
            }

            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const { latitude, longitude } = position.coords;
                    updateCoordinates(latitude, longitude);

                    try {
                        const res = await fetch(
                            `/api/geocoding/reverse?lat=${latitude}&lon=${longitude}`
                        );
                        const data = await res.json();

                        if (data.error) {
                            throw new Error(data.error);
                        }

                        let addr = "";
                        if (data.address) {
                            const a = data.address;
                            // 광역단체: 경기도, 서울특별시 등
                            const province = a.province || a.city || a.state || "";
                            // 기초단체: 수원시, 강남구 등
                            const city = a.city || a.county || a.district || "";
                            // 구: 영통구 등 (city_district가 있는 경우)
                            const district = a.city_district || "";
                            // 동/읍/면: 영통동, 매탄동 등
                            const town = a.town || a.village || a.suburb || a.neighbourhood || a.hamlet || "";
                            // 도로명/지번
                            const road = a.road || a.pedestrian || "";
                            const houseNumber = a.house_number || "";
                            const building = a.building || a.amenity || a.office || "";

                            // 주소 조각 모으기 (중복 제거 포함)
                            const parts: string[] = [];
                            if (province) parts.push(province);
                            if (city && city !== province) parts.push(city);
                            if (district && district !== city) parts.push(district);
                            if (town && !parts.includes(town)) parts.push(town);
                            if (road && !parts.includes(road)) parts.push(road);
                            if (houseNumber) parts.push(houseNumber);

                            addr = parts.join(" ").trim();

                            if (building && !addr.includes(building)) {
                                addr += ` (${building})`;
                            }
                        }

                        if (!addr) {
                            addr = data.display_name || "위치 정보를 찾을 수 없습니다";
                        }

                        setLocation(addr);
                        resolve({ address: addr, coordinates: { lat: latitude, lng: longitude } });
                    } catch (error) {
                        console.error("Geocoding error", error);
                        const msg = "위치 확인 실패";
                        setLocation(msg);
                        resolve({ address: msg, coordinates: { lat: latitude, lng: longitude }, error: msg });
                    } finally {
                        setIsLoading(false);
                    }
                },
                (error) => {
                    console.error("Geolocation error", error);
                    let msg = "위치 파악 실패";
                    if (error.code === 1) msg = "위치 권한을 허용해주세요";
                    else if (error.code === 3) msg = "위치 확인 시간 초과";

                    setLocation(msg);
                    setIsLoading(false);
                    resolve({ address: msg, coordinates: null, error: msg });
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                }
            );
        });
    };

    return (
        <LocationContext.Provider value={{
            location,
            setLocation,
            detectLocation,
            isLoading,
            coordinates,
            favorites,
            addFavorite,
            removeFavorite,
            updateFavorite,
            promoteFavorite
        }}>
            {children}
        </LocationContext.Provider>
    );
}

export function useLocation() {
    const context = useContext(LocationContext);
    if (!context) throw new Error('useLocation must be used within LocationProvider');
    return context;
}
