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
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const { latitude, longitude } = position.coords;
                    updateCoordinates(latitude, longitude);

                    try {
                        const res = await fetch(
                            `/api/geocoding/reverse?lat=${latitude}&lon=${longitude}`
                        );
                        const data = await res.json();

                        let addr = "";
                        if (data.address) {
                            const province = data.address.province || data.address.city || data.address.state || "";
                            let city = data.address.city || data.address.county || "";
                            if (city === province) city = "";
                            const district = data.address.borough || data.address.suburb || data.address.district || "";
                            const town = data.address.town || "";
                            const village = data.address.village || data.address.hamlet || "";
                            const neighborhood = data.address.neighbourhood || data.address.quarter || "";
                            const road = data.address.road || data.address.pedestrian || data.address.highway || "";
                            const houseNumber = data.address.house_number || "";
                            const building = data.address.building || data.address.amenity || data.address.leisure || data.address.tourism || data.address.shop || "";

                            const parts = [
                                province, city, district, town, neighborhood, village, road, houseNumber
                            ].filter((part, index, self) =>
                                Boolean(part) && self.indexOf(part) === index
                            );

                            addr = parts.join(" ");
                            if (building && !addr.includes(building)) {
                                addr += ` (${building})`;
                            }
                        } else {
                            addr = data.display_name || "알 수 없는 위치";
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
                    const msg = error.code === 1 ? "위치 권한을 허용해주세요" : "위치 파악 실패";
                    setLocation(msg);
                    setIsLoading(false);
                    resolve({ address: msg, coordinates: null, error: msg });
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
