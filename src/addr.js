function preprocessAddress(address) {
    // 분리되지 않아야 하는 단어 목록
    const specificTerms = [
        "안동시", "송도과학로", "봉동읍", "구로구", "도청로", "화도읍", "낙동남로",
        "고덕비즈밸리로", "구리시", "미시령로", "청도군", "하동군", "종합운동장로", "고속도로", "영동대로"
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
        .replace(/([가-힣]+읍)(?=[가-힣])/g, "$1 ")
        .replace(/([가-힣]+면)(?=[가-힣])/g, "$1 ")
        .replace(/([가-힣]+동)(?=[가-힣])/g, "$1 ")
        .replace(/([가-힣]+리)(?=[가-힣])/g, "$1 ")
        .replace(/([가-힣]+로)(?=[가-힣])/g, "$1 ")
        .replace(/([가-힣]+길)(?=[가-힣])/g, "$1 ")
        .trim();

    // 보호된 단어에서 $를 제거하고, #을 공백으로 대체
    address = address.replace(/\$/g, "").replace(/#/g, " ");

    return address;
}

// 테스트 예시
const addresses = [
    "부산광역시낙동남로1413",
    "서울특별시고덕비즈밸리로435",
    "경상북도안동시송도과학로101",
    "전라북도봉동읍도청로123",
    "경기도구리시미시령로78",
    "경상북도청도군낙동남로90",
    "전라남도하동군종합운동장로102",
    "충청북도영동대로203",
    "경상북도고속도로500"
];

const formattedAddresses = addresses.map(preprocessAddress);
console.log(formattedAddresses);
