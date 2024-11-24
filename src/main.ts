// For more information, see https://crawlee.dev/
import { PlaywrightCrawler, Dataset, RequestQueue } from 'crawlee';

// import { router } from './routes.js';
import { createRouter } from './routes.js';
import * as fs from 'fs';

const startUrls = ['https://www.tesla.com/ko_KR/findus/list/superchargers/South%20Korea'];

// const crawler = new PlaywrightCrawler({
//     // proxyConfiguration: new ProxyConfiguration({ proxyUrls: ['...'] }),
//     requestHandler: router,
//     // Comment this option to scrape the full website.
//     maxRequestsPerCrawl: 20,
// });

// await crawler.run(startUrls);

const CACHE_FILE = 'downloaded_urls.json';

async function loadDownloadedUrls(): Promise<Set<string>> {
    // if (fs.existsSync(CACHE_FILE)) {
    //     const data = fs.readFileSync(CACHE_FILE, 'utf-8');
    //     return new Set(JSON.parse(data));
    // }
    return new Set();
}

async function saveDownloadedUrls(urls: Set<string>): Promise<void> {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(Array.from(urls)), 'utf-8');
}


async function startCrawler() {
    const startUrls = ['https://www.tesla.com/ko_KR/findus/list/superchargers/South%20Korea'];
    const downloadedUrls = await loadDownloadedUrls(); // 이전에 다운로드한 URL 로드

    // RequestQueue를 명시적으로 생성
    const requestQueue = await RequestQueue.open();

    // requestQueue를 router로 전달
    const router = createRouter(requestQueue);

    const crawler = new PlaywrightCrawler({
        requestQueue, // 생성한 requestQueue를 PlaywrightCrawler에 전달
        requestHandler:  async (context) => {
            const { request, log } = context;
            // 이미 다운로드한 URL은 건너뜀
            if (downloadedUrls.has(request.url)) {
                log.info(`Skipping already downloaded URL: ${request.url}`);
                return;
            }

            await router(context);

            // URL을 캐시에 추가하고 저장
            downloadedUrls.add(request.url);
            await saveDownloadedUrls(downloadedUrls);
        },
        navigationTimeoutSecs: 30000, // 30초로 증가
        maxRequestRetries: 3, // 재시도 횟수를 늘림
        maxConcurrency: 10,
        maxRequestsPerCrawl: 160,
        launchContext: {
            launchOptions: {
                args: ['--disable-http2'],
            },
        },
    });

    await crawler.run(startUrls);
    // 크롤링이 완료된 후 데이터를 CSV로 내보냄
    const dataset = await Dataset.open();
    await dataset.exportToCSV('rawdata.csv'); // 간단한 파일명만 사용

    // 저장 디렉토리로 파일 이동
    const outputDir = 'storage/datasets/default';
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    fs.renameSync('storage/key_value_stores/default/rawdata.csv', `${outputDir}/rawdata.csv`);
}

// 크롤러 시작
startCrawler().catch((error) => {
    console.error("Crawler encountered an error:", error);
});