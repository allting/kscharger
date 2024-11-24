import { createPlaywrightRouter } from 'crawlee';
import { PlaywrightCrawler, RequestQueue } from 'crawlee';
import * as fs from 'fs';
// export const router = createPlaywrightRouter();

// router.addDefaultHandler(async ({ page, requestQueue, log }) => {
//     log.info(`enqueueing new URLs`);
//     // await enqueueLinks({
//     //     globs: ['https://www.tesla.com/findus/location/supercharger/**'],
//     //     label: 'detail',
//     // });
//     // await enqueueLinks({
//     //     globs: ['/findus/location/supercharger/**'],
//     //     label: 'detail',
//     //     transformRequestFunction: (req) => {
//     //         log.debug(`req url - ${req.url}`)
//     //         // 링크에서 ko_KR을 ko_kr로 변환
//     //         req.url = `https://www.tesla.com/ko_kr${req.url}`;
//     //         log.debug(`transformed req url - ${req.url}`)
//     //         return req;
//     //     },
//     // });
//     // 리스트 페이지에서 모든 세부 링크를 수동으로 수집
//     const links = await page.locator('a[href^="/findus/location/supercharger/"]').all();

//     for (const link of links) {
//         const href = await link.getAttribute('href');
//         if (href) {
//             const detailUrl = `https://www.tesla.com/ko_kr${href}`;
//             log.debug(`Enqueuing detail page: ${detailUrl}`);
//             await requestQueue.addRequest({ url: detailUrl, label: 'detail' });
//         }
//     }
// });

// router.addHandler('detail', async ({ request, page, log, pushData }) => {
//     const title = await page.locator('.findus-list-header h2').textContent();
//     log.info(`${title}`, { url: request.loadedUrl });
//     const address = await page.locator('span.street-address').textContent();
//     const tel = await page.locator('span.value').textContent();
//     const route = await page.locator('address.vcard p a');

//     await pushData({
//         url: request.loadedUrl,
//         title,
//         address,
//         tel,
//     });
// });

export function createRouter(requestQueue: RequestQueue) {
    const router = createPlaywrightRouter();

    router.addDefaultHandler(async ({ page, log }) => {
        log.info(`Manually collecting URLs for Korean page`);

        // 리스트 페이지에서 모든 세부 링크를 수동으로 수집
        const links = await page.locator('a[href^="/findus/location/supercharger/"]').all();

        for (const link of links) {
            const href = await link.getAttribute('href');
            if (href) {
                const detailUrl = `https://www.tesla.com/ko_kr${href}`;
                log.info(`Enqueuing detail page: ${detailUrl}`);
                await requestQueue.addRequest({ url: detailUrl, label: 'detail' });
            }
        }
    });

    async function downloadImage(url: string, savePath: string): Promise<void> {
        const response = await fetch(url);
    
        if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.statusText}`);
        }
    
        const buffer = await response.arrayBuffer(); // ArrayBuffer로 이미지 데이터를 가져옴
        fs.writeFileSync(savePath, Buffer.from(buffer)); // ArrayBuffer를 Buffer로 변환 후 저장
        return 
    }

    enum Amenities {
        Restaurants = 1 << 0, // 1
        Wifi = 1 << 1,        // 2
        Shopping = 1 << 2,    // 4
        Lodging = 1 << 3,     // 8
        Beverage = 1 << 4,    // 16
        Restrooms = 1 << 5    // 32
    }
    
    // 예: 문자열을 비트마스크 값으로 변환하는 함수
    function parseAmenities(amenitiesStr: string): number {
        const amenitiesArray = amenitiesStr.split('|');
        let bitmask = 0;
        for (const amenity of amenitiesArray) {
            switch (amenity.toLowerCase()) {
                case 'restaurants':
                    bitmask |= Amenities.Restaurants;
                    break;
                case 'wifi':
                    bitmask |= Amenities.Wifi;
                    break;
                case 'shopping':
                    bitmask |= Amenities.Shopping;
                    break;
                case 'lodging':
                    bitmask |= Amenities.Lodging;
                    break;
                case 'beverage':
                    bitmask |= Amenities.Beverage;
                    break;
                case 'restrooms':
                    bitmask |= Amenities.Restrooms;
                    break;
                default:
                    console.warn(`Unknown amenity: ${amenity}`);
            }
        }
        return bitmask;
    }    
    
    // 비트마스크 값을 영어 항목 배열로 변환하는 함수
    function amenitiesToArray(bitmask: number): string[] {
        const amenities: string[] = [];

        if (bitmask & Amenities.Restaurants) amenities.push("restaurants");
        if (bitmask & Amenities.Wifi) amenities.push("wifi");
        if (bitmask & Amenities.Shopping) amenities.push("shopping");
        if (bitmask & Amenities.Lodging) amenities.push("lodging");
        if (bitmask & Amenities.Beverage) amenities.push("beverage");
        if (bitmask & Amenities.Restrooms) amenities.push("restrooms");

        return amenities;
    }

    router.addHandler('detail', async ({ request, page, log, pushData }) => {
        await page.waitForLoadState('networkidle');
        let title = await page.locator('.findus-list-header h2').textContent();

        log.info(`Fetching data for: ${title}`, { url: request.loadedUrl });

        // 스토어 타입들 (항목이 없을 경우 빈 배열로 설정)
        const storeTypes = await page.locator('.find-us-details-types li').evaluateAll((elements) => 
            elements.map(el => el.textContent?.trim() ?? "").filter(Boolean)
        ) ?? [];

        // 공용 이름 (존재하지 않으면 빈 문자열)
        const commonName = (await page.locator('.common-name').textContent())?.trim() ?? "";

        // 도로명 주소 (항목이 없으면 빈 문자열)
        const streetAddress = (await page.locator('.street-address').textContent())?.trim() ?? "";
        const extendedAddress = (await page.locator('.extended-address').textContent())?.trim() ?? "";


        // 운전 경로 링크 (존재하지 않을 경우 null로 설정)
        const drivingDirections = await page.locator('.vcard p a').getAttribute('href') ?? null;

        // 전화번호 정보 (이름: 번호 형식으로, 항목이 없을 경우 빈 배열로 설정)
        const phoneData = await page.locator('.tel p').evaluateAll((elements) => 
            elements.map((element) => {
                const type = element.querySelector('.type')?.textContent?.trim() ?? "기타";
                const value = element.querySelector('.value')?.textContent?.trim() ?? "N/A";
                return `${type}: ${value}`;
            })
        ) ?? [];

        async function extractOperatingHours(page: any): Promise<string[]> {
            const operatingHoursLocator = page.locator('p:has(strong:has-text("스토어 운영시간"))');
        
            // 운영시간 요소가 있는 경우만 데이터를 추출
            if ((await operatingHoursLocator.count()) > 0) {
                return await operatingHoursLocator.evaluate((element: HTMLElement) => {
                    return element.innerText.split('\n').slice(1).map((line: string) => line.trim());
                });
            }
            // 요소가 없는 경우 빈 배열 반환
            return [];
        }
        
        const operatingHours = await extractOperatingHours(page);

        async function extractChargingInfo(page: any): Promise<string> {
            const chargingInfoLocator = page.locator('p:has-text("충전")');
        
            // 요소가 있는 경우에만 데이터를 추출하고, 없으면 빈 문자열 반환
            if ((await chargingInfoLocator.count()) > 0) {
                return await chargingInfoLocator.textContent({ timeout: 10000 }) ?? ""; // 타임아웃을 10초로 조정
            }
            
            return ""; // 요소가 없는 경우 기본값 반환
        }
        
        const chargingInfo = await extractChargingInfo(page);
        
        // 편의시설 아이콘 텍스트 (항목이 없으면 빈 배열로 설정)
        const amenities = await page.locator('.amenities-icons li a').evaluateAll((elements) => 
            elements.map((element) => {
                const className = element.getAttribute('class');
                return className?.replace('amenetie-icon-', '').trim();
            })
        ) ?? [];

        const imgSrc = await page.locator('#location-map img').getAttribute('src');
        let imageName = ''
        if(imgSrc){
            const urlPath = new URL(request.url).pathname;
            imageName = (urlPath.split('/').pop() ?? 'default_image_name') + '.png'; // 마지막 요소가 없으면 기본 이름 설정
            await downloadImage(imgSrc, imageName)
        }
        // 데이터 저장
        await pushData({
            title,
            storeTypes: storeTypes.join("|"),     // 스토어와 서비스 타입들 배열을 쉼표로 구분된 문자열로 변환
            commonName,
            streetAddress,
            extendedAddress,
            drivingDirections,
            phoneData: phoneData.join("|"),        // 전화번호 배열을 쉼표로 구분된 문자열로 변환
            operatingHours: operatingHours.join("|"), // 운영 시간 배열을 쉼표로 구분된 문자열로 변환
            chargingInfo,
            amenities: amenities.join("|"),         // 편의시설 배열을 쉼표로 구분된 문자열로 변환
            imageName,
            url: request.loadedUrl
        });
    });

    return router;
}