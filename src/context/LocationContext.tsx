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
    detectLocation: () => void;
    isLoading: boolean;
    coordinates: { lat: number; lng: number } | null;
    favorites: FavoriteLocation[];
    addFavorite: (name: string, address: string, coords?: { lat: number; lng: number }) => void;
    removeFavorite: (name: string) => void;
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

    const detectLocation = () => {
        if (!navigator.geolocation) {
            setLocation("위치 권한 미지원");
            return;
        }
        setIsLoading(true);
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                updateCoordinates(latitude, longitude);

                try {
                    const res = await fetch(
                        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1&accept-language=ko`
                    );
                    const data = await res.json();

                    let addr = "";
                    if (data.address) {
                        // More comprehensive mapping for Korean addresses (Big -> Small)

                        // 1. Province/State (Do/Special City)
                        const province = data.address.province || data.address.state || "";

                        // 2. City/County (Si/Gun/Gu - sometimes mixed in OSM)
                        const city = data.address.city || data.address.county || "";

                        // 3. District (Gu - if distinct from city)
                        const district = data.address.borough || data.address.suburb || data.address.district || "";

                        // 4. Town/Neighborhood (Eup/Myeon/Dong/Ri)
                        // Note: OSM is inconsistent. 'town' can be 'Eup', 'village' can be 'Ri' or 'Dong'.
                        // We gather them and filter duplicates later.
                        const town = data.address.town || "";
                        const village = data.address.village || data.address.hamlet || "";
                        const neighborhood = data.address.neighbourhood || data.address.quarter || "";

                        // 5. Road & Number
                        const road = data.address.road || data.address.pedestrian || data.address.highway || "";
                        const houseNumber = data.address.house_number || "";

                        // 6. Building/Landmark
                        const building = data.address.building || data.address.amenity || data.address.leisure || data.address.tourism || data.address.shop || "";

                        // Construct array and remove duplicates/empties
                        // Order: Province -> City -> District -> Town -> Neighborhood -> Village -> Road -> Number
                        const parts = [
                            province,
                            city,
                            district,
                            town,
                            neighborhood,
                            village,
                            road,
                            houseNumber
                        ].filter((part, index, self) =>
                            Boolean(part) && self.indexOf(part) === index
                        );

                        addr = parts.join(" ");

                        // Append building name if it exists and isn't already part of the address (sometimes it is)
                        if (building && !addr.includes(building)) {
                            addr += ` (${building})`;
                        }
                    } else {
                        // Fallback to display_name but try to clean it
                        // OSM display_name is usually "Small, Big, Country"
                        // We can just use it as is if parsing fails, usually it's detailed enough.
                        addr = data.display_name || "알 수 없는 위치";
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
        <LocationContext.Provider value={{
            location,
            setLocation,
            detectLocation,
            isLoading,
            coordinates,
            favorites,
            addFavorite,
            removeFavorite,
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
