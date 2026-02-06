import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    // In a real scenario, this would fetch from:
    // https://apis.data.go.kr/SpecificLocalGov/LargeWasteFeeService/getFeeList

    // For now, we simulate a standard Public Data Portal JSON response structure
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
