import fs from 'fs';
import path from 'path';
// import csvParser from 'csv-parser';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import crypto from 'crypto';

const inputPath = path.join('storage', 'datasets', 'default', 'rawdata.csv');
const outputPath = path.join('storage', 'datasets', 'default', 'data.csv');

enum RegionCategory {
    SEOUL = 1, // 서울특별시
    BUSAN = 2, // 부산광역시
    DAEGU = 3, // 대구광역시
    INCHEON = 4, // 인천광역시
    GWANGJU = 5, // 광주광역시
    DAEJEON = 6, // 대전광역시
    ULSAN = 7, // 울산광역시
    GYEONGGI = 8, // 경기도
    GANGWON = 9, // 강원도
    CHUNGCHEONGBUK = 10, // 충청북도
    CHUNGCHEONGNAM = 11, // 충청남도
    JEOLLABUK = 12, // 전라북도
    JEOLLANAM = 13, // 전라남도
    GYEONGSANGBUK = 14, // 경상북도
    GYEONGSANGNAM = 15, // 경상남도
    JEJU = 16, // 제주특별자치도
    SEJONG = 17 // 세종특별자치시
}
  

/**
 * 주어진 문자열에서 6자리 미만의 숫자 ID 생성
 * @param {string} title - 수퍼차저 타이틀
 * @returns {number} - 생성된 숫자 ID
 */
function generateNumericId(title: string){
    // Step 1: 해싱
    const hash = crypto.createHash('sha256').update(title).digest('hex');

    // Step 2: 숫자 추출 (16진수 → 10진수)
    const numericHash = parseInt(hash.slice(0, 10), 16);

    // Step 3: 10자리 미만으로 축소
    const shortNumericId = numericHash % 100000; // 십만 미만 숫자

    return shortNumericId;
}

function extractCoordinates(url: string): { latitude: number, longitude: number } | null {
    try {
        const parsedUrl = new URL(url);
        const daddr = parsedUrl.searchParams.get('daddr');
        
        if (daddr) {
            const [latitude, longitude] = daddr.split(',').map(coord => parseFloat(coord.trim()));
            return { latitude, longitude };
        }
        
        return null; // daddr 파라미터가 없을 경우
    } catch (error) {
        console.error("Invalid URL:", error);
        return null;
    }
}

function addSpacesToName(name: string): string {
    return name.replace(/\s*-\s*/g, " - ");
}

function preprocessAddress(address: string): string {
    // 콤마 제거
    address = address.replace(/,/g, "");

    // 1. 'Digital-ro 26-gil' -> '서울 구로구 디지털로26길 38 지하 4층 주차장'으로 변경
    address = address.replace(/Digital-ro 26-gil/i, "서울 구로구 디지털로26길 38 지하 4층 주차장 08393");

    // 2. 'Seoul' 제거 (예: '서울특별시Seoul여의공원로101 07241' -> '서울특별시 여의공원로101 07241')
    address = address.replace(/서울특별시Seoul/g, "서울특별시 ");
    address = address.replace(/Seoul/g, ""); // 단독 'Seoul'이 있을 때도 제거

    // 3. 'Seongnam'을 '성남'으로 변경 (예: '경기도Seongnam황새울로312번길 3636 13591' -> '경기도 성남 황새울로312번길 3636 13591')
    address = address.replace(/경기도Seongnam황새울로312번길 3636/g, "경기도 성남시 분당구 황새울로312번길 36");

    // 4. 'Pyeongchang-gun, Bongpyeong-myeon'을 '평창군 봉평면'으로 변경
    address = address.replace(/Pyeongchang-gun Bongpyeong-myeon/g, "평창군 봉평면");

    // 경기도파주시운정로 113-175 113-175 10911
    address = address.replace(/113-175 113-175/g, "113-175");

    // 경기도 성남시 분당구 분당수서로 501 501 13553
    address = address.replace(/501501/g, "501");

    // 인천광역시 인천광역시 영종해안남로321번길 208 208 22382
    address = address.replace(/208208/g, "208");

    // 서울 서울특별시
    address = address.replace(/서울서울특별시/g, "서울특별시");

    // 서울특별시 서울특별시
    address = address.replace(/서울특별시서울특별시/g, "서울특별시");

    // 인천광역시 인천광역시
    address = address.replace(/인천광역시인천광역시/g, "인천광역시");

    // 세종특별자치시 세종특별자치시
    address = address.replace(/세종특별자치시세종특별자치시/g, "세종특별자치시");

    // 부산 부산광역시
    address = address.replace(/부산부산광역시/g, "부산광역시");

    // 부산 부산
    address = address.replace(/부산부산/g, "부산광역시");

    // 부산광역시 부산광역시
    address = address.replace(/부산광역시부산광역시/g, "부산광역시");

    // 제주도
    address = address.replace(/제주도/g, "제주특별자치도");

    // 세종시
    address = address.replace(/세종시/g, "세종특별자치시");

    // 강릉구정면
    address = address.replace(/강릉구정면/g, "강원도강릉시구정면");

    // 성남황새울로
    address = address.replace(/강릉구정면/g, "강원도강릉시구정면");

    // 경기도안동시노리212-1
    address = address.replace(/경기도안동시노리212-1/g, "경상북도 안동시 풍산읍 노리 212-1");
    return address;
}

function extractPostalCodeAndFormatAddress(address: string): { postalCode: string | null, formattedAddress: string } {
    // 주소 전처리
    address = preprocessAddress(address);

    // 우편번호 추출: 5자리 또는 6자리 숫자, 또는 하이픈으로 분리된 6자리 숫자
    const postalCodeMatch = address.match(/\b\d{5}\b|\b\d{6}\b|\b\d{3}-\d{3}\b/);
    let postalCode = postalCodeMatch && postalCodeMatch[0] ? postalCodeMatch[0] : null;

    // 우편번호가 null이 아닌 경우 하이픈 제거 및 주소에서 우편번호 부분 제거
    let addressWithoutPostalCode = address;
    if (postalCode) {
        postalCode = postalCode.replace('-', ''); // 하이픈 제거
        if(postalCodeMatch)
            addressWithoutPostalCode = address.replace(postalCodeMatch[0], '').trim(); // 주소에서 우편번호 제거
    }

    // 주소를 우리나라 주소 체계에 맞게 공백 추가
    const formattedAddress = formatAddress(addressWithoutPostalCode);

    return { postalCode, formattedAddress };
}
    
// 우리나라 주소 체계에 맞게 공백을 추가하는 함수
function formatAddress(address: string): string {
    // 분리되지 않아야 하는 단어 목록
    const specificTerms = [
        "안동시", "송도과학로", "봉동읍", "구로구", "도청로", "화도읍", "낙동남로", "왕십리로",
        "고덕비즈밸리로", "구리시", "미시령로", "청도군", "하동군", "종합운동장로", "고속도로", "영동대로",
        "미사리로", "범구로", "기업도시로", "대구광역시", "구정면"
    ];

    // 특정 단어를 찾고 각 글자마다 $를 추가하고 마지막 글자 뒤에 #을 추가
    for (const term of specificTerms) {
        const protectedTerm = term.split("").join("$") + "#"; // 각 글자 사이에 $ 추가, 마지막에 # 추가
        const regex = new RegExp(term, "g");
        address = address.replace(regex, protectedTerm);
    }

    // 행정구역별 공백 추가 (일반적인 정규식)
    address = address
        .replace(/([가-힣]+도)(?=[가-힣])/g, "$1 ")
        .replace(/([가-힣]+시)(?=[가-힣])/g, "$1 ")
        .replace(/([가-힣]+군)(?=[가-힣])/g, "$1 ")
        .replace(/([가-힣]+구)(?=[가-힣])/g, "$1 ")
        .replace(/([가-힣]+읍)(?=[가-힣0-9])/g, "$1 ")
        .replace(/([가-힣]+면)(?=[가-힣0-9])/g, "$1 ")
        .replace(/([가-힣]+동)(?=[가-힣0-9])/g, "$1 ")
        .replace(/([가-힣]+리)(?=[가-힣0-9])/g, "$1 ")
        .replace(/([가-힣]+로)(?=[가-힣0-9])/g, "$1 ")
        .replace(/([가-힣]+길)(?=[가-힣0-9])/g, "$1 ")
        .trim();

    // 보호된 단어에서 $를 제거하고, #을 공백으로 대체
    address = address.replace(/\$/g, "").replace(/#/g, " ");

    // 트림하여 반환
    return address.trim();
}

function categorizeAddress(address: string): RegionCategory | null {
    if (address.includes("서울특별시")) return RegionCategory.SEOUL;
    if (address.includes("부산광역시")) return RegionCategory.BUSAN;
    if (address.includes("대구광역시")) return RegionCategory.DAEGU;
    if (address.includes("인천광역시")) return RegionCategory.INCHEON;
    if (address.includes("광주광역시")) return RegionCategory.GWANGJU;
    if (address.includes("대전광역시")) return RegionCategory.DAEJEON;
    if (address.includes("울산광역시")) return RegionCategory.ULSAN;
    if (address.includes("경기도")) return RegionCategory.GYEONGGI;
    if (address.includes("강원도")) return RegionCategory.GANGWON;
    if (address.includes("충청북도")) return RegionCategory.CHUNGCHEONGBUK;
    if (address.includes("충청남도")) return RegionCategory.CHUNGCHEONGNAM;
    if (address.includes("전라북도")) return RegionCategory.JEOLLABUK;
    if (address.includes("전라남도")) return RegionCategory.JEOLLANAM;
    if (address.includes("경상북도")) return RegionCategory.GYEONGSANGBUK;
    if (address.includes("경상남도")) return RegionCategory.GYEONGSANGNAM;
    if (address.includes("제주특별자치도")) return RegionCategory.JEJU;
    if (address.includes("세종특별자치시")) return RegionCategory.SEJONG;
    return null; // 분류되지 않은 경우
}

function extractSuperchargerInfo(text: string) {
    const regex = /최대\s*(\d+)kW.*?(\d+)\s*수퍼차저/g;
    const results = [];
    let match;

    while ((match = regex.exec(text)) !== null) {
        const key = parseInt(match[1], 10); // kW 값
        const value = parseInt(match[2], 10); // 수퍼차저 개수
        results.push({ [key]: value }); // 객체 형태로 저장
    }

    return results;
}

function removeFields(data: any[], fieldsToRemove: string[]): any[] {
    return data.map((item) =>
        Object.fromEntries(
            Object.entries(item).filter(([key]) => !fieldsToRemove.includes(key))
        )
    );
}

async function postProcessCSV() {
    try {
        // 파일 읽기
        const csvData = fs.readFileSync(inputPath, 'utf-8');
        const records = parse(csvData, { columns: true });

        // 후처리 로직: 예를 들어, 'location' 필드의 공백 제거
        const processedData = records.map((record) => {
            const title = record.title
            record.id = generateNumericId(title)

            if(title)
                record.title = addSpacesToName(title)
    
            const drivingDirections = record.drivingDirections
            let coordinates = null
            if(drivingDirections){
                coordinates = extractCoordinates(drivingDirections)
                record.latitude = coordinates?.latitude
                record.longitude = coordinates?.longitude
            }

            const streetAddress = record.streetAddress
            const { postalCode, formattedAddress } = extractPostalCodeAndFormatAddress(streetAddress)
            record.postalCode = postalCode ? `${postalCode}` : ''
            record.address = formattedAddress
            record.region = categorizeAddress(formattedAddress)

            const stalls = extractSuperchargerInfo(record.chargingInfo)
            const stall250 = stalls.find((stall) => stall[250] !== undefined)?.[250];
            const stall115 = stalls.find((stall) => stall[115] !== undefined)?.[115];
            
            record['250kw'] = stall250;
            record['115kw'] = stall115;
            
            return record;
        });

        // 지역 코드값 기준으로 정렬
        const sortedData = processedData.sort((a, b) => {
            // 1. 지역(region) 기준 정렬
            const regionComparison = (a.region || 0) - (b.region || 0);
            if (regionComparison !== 0) return regionComparison;

            // 2. 250kw 기준 정렬 (내림차순)
            const power250Comparison = (b["250kw"] || 0) - (a["250kw"] || 0);
            if (power250Comparison !== 0) return power250Comparison;

            // 3. 115kw 기준 정렬 (내림차순)
            return (b["115kw"] || 0) - (a["115kw"] || 0);
        });

        const filteredData = removeFields(sortedData, ["streetAddress", "commonName", "extendedAddress"]);

        // CSV로 저장
        const csvOutput = stringify(filteredData, {
            header: true,
            // cast: {
            //     // 숫자 값은 그대로 숫자로 유지
            //     number: (value) => value,
            // },
        });

        fs.writeFileSync(outputPath, csvOutput, 'utf-8');

        console.log(`후처리 완료: ${outputPath}`);
    } catch (err) {
        console.error('후처리 중 오류 발생:', err);
    }
}

postProcessCSV();