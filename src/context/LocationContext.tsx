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

        // 앱 진입 시 자동 감지는 온보딩과 충돌할 수 있으므로 제거하거나 
        // 권한이 이미 있는 경우에만 동작하도록 하는 것이 좋습니다.
        // 현재는 온보딩에서의 안정성을 위해 제거합니다.
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

        // 주소가 이미 존재하는지 확인
        const existingByAddress = favorites.find(f => f.address === address);

        // 이름이 이미 존재하는지 확인 (폴백, 사용자 요청에 따라 주소 확인이 우선됨)
        const existingByName = favorites.find(f => f.name === name);

        let updated;

        if (existingByAddress) {
            // 동일한 주소가 존재함 -> 이름 업데이트 (새 좌표가 더 좋은 경우 좌표도 업데이트)
            // 기존 항목을 제거하고 새 항목을 맨 위에 추가 (또는 그 자리에서 교체? 사용자는 "이름 변경"이라고 함)
            // "최신" 상호작용이므로 교체하여 맨 위로 이동함
            const others = favorites.filter(f => f.address !== address);
            updated = [newFav, ...others];
        } else if (existingByName) {
            // 동일한 이름이 존재함 (다른 주소) -> 주소 업데이트
            const others = favorites.filter(f => f.name !== name);
            updated = [newFav, ...others];
        } else {
            // 새로운 위치
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
                    coordinates: newCoords || fav.coordinates // 제공되지 않은 경우 기존 좌표 유지
                };
            }
            return fav;
        });
        setFavorites(updated);
        localStorage.setItem('userFavorites', JSON.stringify(updated));

        // 업데이트된 항목이 활성화된 위치였던 경우, 현재 위치 상태도 업데이트
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
        // 현재 위치 컨텍스트도 이 주소로 업데이트
        setLocation(target.address);
        if (target.coordinates) {
            setCoordinates(target.coordinates);
        }
    };

    const detectLocation = (): Promise<{ address: string, coordinates: { lat: number; lng: number } | null, error?: string }> => {
        // 이미 로딩 중이면 중복 요청 방지
        if (isLoading) {
            return Promise.resolve({ address: location, coordinates: coordinates, error: "이미 위치를 확인 중입니다." });
        }

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

            // 너무 빠른 클릭에 대비해 약간의 예열 시간을 가질 수도 있지만, 
            // navigator.geolocation 호출 자체가 비동기이므로 
            // 중복 실행 방지가 가장 중요합니다.

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
                            const province = a.province || a.city || a.state || "";
                            const city = a.city || a.county || a.district || "";
                            const district = a.city_district || "";
                            const town = a.town || a.village || a.suburb || a.neighbourhood || a.hamlet || "";
                            const road = a.road || a.pedestrian || "";
                            const houseNumber = a.house_number || "";
                            const building = a.building || a.amenity || a.office || "";

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
                    else if (error.code === 2) msg = "위치 정보를 사용할 수 없습니다 (GPS 확인 필요)";
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
