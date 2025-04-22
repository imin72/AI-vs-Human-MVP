import React, { useState } from "react";
import "./index.css";
import { toPng } from "html-to-image";
import backgroundDataUrl from "./backgroundImage";

const questions = [
  {
    question: "아이가 '싫어!'라고 고집을 부릴 때, 당신은?",
    options: [
      { text: "이유를 물어본다", type: "감성형", correct: true },
      { text: "단호하게 말한다", type: "AI형" },
      { text: "강요한다", type: "인간형" },
      { text: "무시한다", type: "본능형" },
    ],
  },
  {
    question: "아이가 친구 장난감을 뺏었을 때, 당신의 반응은?",
    options: [
      { text: "아이를 혼낸다", type: "AI형" },
      { text: "사과하게 한다", type: "전략형" },
      { text: "이유를 묻는다", type: "감성형", correct: true },
      { text: "장난감을 되돌려준다", type: "본능형" },
    ],
  },
  {
    question: "아이에게 낮잠을 재우고 싶은 상황입니다. 가장 적절한 방법은?",
    options: [
      { text: "설득한다", type: "전략형" },
      { text: "TV를 틀어준다", type: "본능형" },
      { text: "매일 같은 시간에 눕힌다", type: "AI형", correct: true },
      { text: "낮잠을 없앤다", type: "인간형" },
    ],
  },
  {
    question: "아이가 감정을 표현하지 않고 억누르는 경우, 어떻게 하시겠습니까?",
    options: [
      { text: "감정을 말로 표현하는 법을 연습한다", type: "감성형", correct: true },
      { text: "울게 만든다", type: "인간형" },
      { text: "참는 게 어른스럽다고 말한다", type: "AI형" },
      { text: "시간이 지나길 기다린다", type: "본능형" },
    ],
  },
  {
    question: "아이가 밤에 자주 깬다면, 가장 가능성 낮은 원인은?",
    options: [
      { text: "잠자리 루틴 부족", type: "AI형", correct: true },
      { text: "낮잠 시간이 너무 짧음", type: "-" },
      { text: "방이 너무 밝음", type: "전략형", correct: true },
      { text: "과도한 활동 후 바로 잠듦", type: "본능형", correct: true },
    ],
  },
  {
    question: "아이가 '내가 할 거야!'라고 고집을 부릴 때, 당신의 대응은?",
    options: [
      { text: "기다려 준다", type: "감성형", correct: true },
      { text: "대신 해준다", type: "본능형" },
      { text: "무시한다", type: "-" },
      { text: "하지 못하게 막는다", type: "AI형" },
    ],
  },
  {
    question: "아이가 그림을 그리고 '이건 강아지야!'라고 했지만 잘 모르겠을 때?",
    options: [
      { text: "와 멋지다! 라고 감탄한다", type: "인간형", correct: true },
      { text: "강아지 같지 않다고 말한다", type: "AI형" },
      { text: "더 잘 그려보라고 한다", type: "전략형" },
      { text: "고개만 끄덕인다", type: "본능형" },
    ],
  },
  {
    question: "아이가 '친구가 나랑 안 놀아줘서 속상해'라고 말할 때 당신은?",
    options: [
      { text: "그 친구가 이상하네라고 말한다", type: "인간형" },
      { text: "다른 친구랑 놀라고 한다", type: "본능형" },
      { text: "그래서 너는 어떻게 느꼈어? 라고 묻는다", type: "감성형", correct: true },
      { text: "다음에 또 놀면 돼 라고 말한다", type: "AI형" },
    ],
  }
];

const resultProfiles = {
  "AI형": {
    label: "🤖 AI 평행 사고형",
    description: "정확성과 논리 중심. AI와 유사한 사고 패턴을 가졌습니다.",
  },
  "감성형": {
    label: "💛 감성형 부모 전문가",
    description: "감정을 잘 읽고 공감 능력이 뛰어난 유형입니다.",
  },
  "본능형": {
    label: "🌱 직관적 본능형",
    description: "설명은 못 해도 행동으로 증명하는 감각파 부모!",
  },
  "인간형": {
    label: "🔥 인간미 폭발형",
    description: "정답보다 마음을 중시하는 감성 중심의 부모입니다.",
  },
  "전략형": {
    label: "🧠 전략적 분석형",
    description: "객관적 상황 판단과 논리 기반 육아에 능한 전략형 보호자입니다.",
  },
};

export default function AIvsParentTest() {
  const [step, setStep] = useState(0);
  const [score, setScore] = useState(0);
  const [types, setTypes] = useState({});
  const [finished, setFinished] = useState(false);
  const [result, setResult] = useState(null);

  const handleAnswer = (option) => {
    if (option.correct) setScore((s) => s + 1);
    setTypes((prev) => ({
      ...prev,
      [option.type]: (prev[option.type] || 0) + 1,
    }));
    const nextStep = step + 1;
    if (nextStep >= questions.length) {
      const finalTypes = { ...types };
      finalTypes[option.type] = (finalTypes[option.type] || 0) + 1;
      const topType = Object.entries(finalTypes).sort((a, b) => b[1] - a[1])[0]?.[0] || "감성형";
      const percent = Math.max(34, Math.floor(((score + (option.correct ? 1 : 0)) / questions.length) * 100));
      setResult({ percent, type: topType });
      setFinished(true);
    } else {
      setStep(nextStep);
    }
  };

  const handleShare = () => {
    const node = document.getElementById("result-card");
    toPng(node).then((dataUrl) => {
      const link = document.createElement("a");
      link.download = "ai-vs-parent-result.png";
      link.href = dataUrl;
      link.click();
    });
  };

  if (finished && result) {
    const profile = resultProfiles[result.type];
    return (
      <>
        <div
          id="result-card"
          className="min-h-screen bg-cover bg-center p-8 text-center font-serif text-white shadow-inner space-y-4"
          style={{ backgroundImage: `url('${backgroundDataUrl}')` }}
        >
          <h1 className="text-4xl font-bold drop-shadow-xl">당신은 AI의 {result.percent}% 수준!</h1>
          <h2 className="text-3xl font-bold text-pink-200 drop-shadow">{profile.label}</h2>
          <p className="text-xl text-gray-100 drop-shadow-sm">{profile.description}</p>
        </div>
        <div className="mt-6 flex justify-center gap-4">
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-pink-400 text-white rounded-xl shadow-lg hover:bg-pink-500 transition"
          >
            다시 하기
          </button>
          <button
            onClick={handleShare}
            className="px-6 py-2 bg-indigo-400 text-white rounded-xl shadow-lg hover:bg-indigo-500 transition"
          >
            결과 이미지 저장하기
          </button>
        </div>
      </>
    );
  }

  const current = questions[step];

  return (
    <div className="min-h-screen bg-[url('/sen-bg.jpg')] bg-cover bg-center p-6 font-serif text-white">
      <div className="max-w-2xl mx-auto bg-white/30 backdrop-blur-md rounded-2xl p-6 shadow-xl border border-white/30">
        <h2 className="text-2xl font-bold text-rose-100 mb-4 drop-shadow">Q{step + 1}. {current.question}</h2>
        <div className="grid gap-4">
          {current.options.map((opt, i) => (
            <button
              key={i}
              onClick={() => handleAnswer(opt)}
              className="p-4 rounded-xl bg-white/70 text-gray-900 hover:bg-white/90 shadow-md text-left transition"
            >
              {opt.text}
            </button>
          ))}
        </div>
        <div className="text-sm text-right text-white/70 mt-6">{step + 1} / {questions.length}</div>
      </div>
    </div>
  );
}
