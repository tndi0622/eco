import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const location = searchParams.get('loc') || '서울시 종로구';

    // 위치에 따른 지역별 폐기물 배출 가이드라인 가져오기 시뮬레이션
    // 실무 API: 지자체별 API

    const mockRegionData = {
        response: {
            header: {
                resultCode: "00",
                resultMsg: "NORMAL SERVICE."
            },
            body: {
                item: {
                    regionName: location, // 요청된 위치 반영
                    generalWaste: {
                        days: "일, 화, 목",
                        time: "18:00 ~ 24:00",
                        note: "규격봉투 사용 필수"
                    },
                    recycleWaste: {
                        days: "월, 수, 금",
                        time: "07:00 ~ 10:00",
                        note: "투명 페트병은 금요일 별도 배출"
                    },
                    largeWaste: {
                        days: "화, 금",
                        method: "주민센터 신고 또는 온라인 접수 후 배출"
                    },
                    alert: {
                        status: "NORMAL", // NORMAL, DELAY, STOP
                        message: "정상 운행 중입니다."
                    }
                }
            }
        }
    };

    return NextResponse.json(mockRegionData);
}
