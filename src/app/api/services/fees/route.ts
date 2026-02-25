import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    // 실제 시나리오에서는 다음에서 데이터를 가져옵니다:
    // https://apis.data.go.kr/SpecificLocalGov/LargeWasteFeeService/getFeeList

    // 현재는 표준 공공데이터 포털 JSON 응답 구조를 시뮬레이션합니다.
    const mockPublicData = {
        response: {
            header: {
                resultCode: "00",
                resultMsg: "NORMAL SERVICE."
            },
            body: {
                items: [
                    { category: "가구", name: "침대_1인용", size: "1인용", cost: 5000 },
                    { category: "가구", name: "침대_2인용", size: "2인용", cost: 8000 },
                    { category: "가구", name: "침대_퀸/킹", size: "2인용 이상", cost: 10000 },
                    { category: "가구", name: "침대_킹", size: "대형", cost: 12000 },

                    { category: "가구", name: "책상_소형", size: "1m 미만", cost: 3000 },
                    { category: "가구", name: "책상_중형", size: "1m ~ 1.5m", cost: 5000 },
                    { category: "가구", name: "책상_대형", size: "1.5m 이상", cost: 7000 },

                    { category: "가구", name: "소파_1인용", size: "1인용", cost: 4000 },
                    { category: "가구", name: "소파_3인용", size: "3인용", cost: 8000 },
                    { category: "가구", name: "소파_4인용", size: "4인용", cost: 10000 },

                    { category: "가구", name: "장롱_1쪽", size: "1쪽", cost: 5000 },
                    { category: "가구", name: "장롱_2쪽", size: "2쪽", cost: 10000 },
                    { category: "가구", name: "장롱_3쪽", size: "3쪽", cost: 15000 }
                ],
                numOfRows: 10,
                pageNo: 1,
                totalCount: 13
            }
        }
    };

    return NextResponse.json(mockPublicData);
}
