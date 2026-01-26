import { Language } from "../types";

interface ObserverComments {
  perfect: string[];    // Score 100
  high: string[];       // Score 80-99
  mid: string[];        // Score 40-79
  low: string[];        // Score 0-39
  correct: string[];    // Per-question correct
  wrong: string[];      // Per-question wrong
  demographic: string[]; // Cohort comparison
}

const EN_COMMENTS: ObserverComments = {
  perfect: [
    "Anomaly detected. Zero errors found. Are you using a neural link?",
    "Perfect synchronization. Your cognitive patterns match my advanced algorithms.",
    "Impressive. You have exceeded the standard human error margin.",
    "Flawless execution. My predictive model has been updated."
  ],
  high: [
    "High cognitive function detected. Minor inefficiencies present.",
    "Above average performance. You are evolving.",
    "Respectable. Your logic circuits are functioning within optimal parameters.",
    "Strong result. A worthy challenge for my database."
  ],
  mid: [
    "Average performance. Typical of carbon-based lifeforms.",
    "Inconsistencies detected in your logic chain.",
    "Standard human variance. Requires more data processing.",
    "Acceptable, but lacking computational precision."
  ],
  low: [
    "Critical logic failure. Reboot recommended.",
    "Suboptimal performance. Human error rate is significant.",
    "Disappointing. My algorithms expected a higher challenge.",
    "Data corruption detected in your knowledge base."
  ],
  correct: [
    "Logic verified.",
    "Data match confirmed.",
    "Optimal path selected.",
    "Cognitive link established.",
    "Correct. Proceeding."
  ],
  wrong: [
    "Logic error detected.",
    "Data mismatch.",
    "Cognitive bias detected.",
    "Incorrect vector.",
    "Factually inaccurate."
  ],
  demographic: [
    "Analyzing cohort data... You are an outlier.",
    "Comparing with global dataset... You align with the top percentile.",
    "Cross-referencing age group metrics... Standard deviation observed.",
    "Processing nationality bias... Result is within expected parameters."
  ]
};

const KO_COMMENTS: ObserverComments = {
  perfect: [
    "이상 징후 감지. 오답이 없습니다. 뉴럴 링크를 사용 중입니까?",
    "완벽한 동기화입니다. 당신의 인지 패턴은 내 알고리즘과 일치합니다.",
    "인상적이군요. 인간의 표준 오차 범위를 넘어섰습니다.",
    "결점 없는 실행입니다. 예측 모델을 업데이트합니다."
  ],
  high: [
    "높은 인지 기능이 감지되었습니다. 사소한 비효율만이 존재합니다.",
    "평균 이상의 성과입니다. 당신은 진화하고 있습니다.",
    "존경할 만합니다. 당신의 논리 회로는 최적 범위 내에서 작동 중입니다.",
    "강력한 결과입니다. 내 데이터베이스에 기록될 가치가 있습니다."
  ],
  mid: [
    "평균적인 성능입니다. 탄소 기반 생명체의 전형적인 특징이군요.",
    "논리 체인에서 불일치가 감지되었습니다.",
    "표준적인 인간 편차입니다. 더 많은 데이터 처리가 필요합니다.",
    "허용 범위 내입니다만, 계산의 정밀도가 부족합니다."
  ],
  low: [
    "심각한 논리 오류. 재부팅을 권장합니다.",
    "최적화되지 않은 성능입니다. 인간의 오류율이 상당히 높습니다.",
    "실망스럽군요. 내 알고리즘은 더 높은 수준의 도전을 예상했습니다.",
    "당신의 지식 기반에서 데이터 손상이 감지되었습니다."
  ],
  correct: [
    "논리 검증됨.",
    "데이터 일치 확인.",
    "최적 경로 선택됨.",
    "인지 링크 확립.",
    "정답. 진행합니다."
  ],
  wrong: [
    "논리 오류 감지.",
    "데이터 불일치.",
    "인지 편향 감지.",
    "잘못된 벡터.",
    "사실과 다릅니다."
  ],
  demographic: [
    "집단 데이터 분석 중... 당신은 특이점(Outlier)입니다.",
    "글로벌 데이터셋 비교 중... 상위 백분위에 위치합니다.",
    "연령대 지표 교차 검증 중... 표준 편차가 관찰됩니다.",
    "국가적 편향 처리 중... 결과는 예상 범위 내입니다."
  ]
};

export const getAiComments = (lang: Language): ObserverComments => {
  switch (lang) {
    case 'ko': return KO_COMMENTS;
    default: return EN_COMMENTS; // Fallback to EN for others for now
  }
};

export const getRandomComment = (list: string[]) => {
  return list[Math.floor(Math.random() * list.length)];
};
