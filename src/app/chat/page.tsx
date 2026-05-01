"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function ChatPage() {
  const [inputText, setInputText] = useState("");
  // 型定義に sender を追加して、エラーを防ぐ
  const [messages, setMessages] = useState<{ text: string; tag: string; sender: string }[]>([]);
  const [selectedTag, setSelectedTag] = useState("💻");

  const [targetDateStr, setTargetDateStr] = useState("");
  const [daysLeft, setDaysLeft] = useState<number | null>(null);

  useEffect(() => {
    const savedDate = localStorage.getItem("myTargetDate");
    if (savedDate) {
      setTargetDateStr(savedDate);
    } else {
      setTargetDateStr("2026-12-31");
    }
  }, []);

  useEffect(() => {
    if (!targetDateStr) return;
    localStorage.setItem("myTargetDate", targetDateStr);
    const calculateDays = () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const target = new Date(targetDateStr);
      const diffTime = target.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      setDaysLeft(diffDays);
    };
    calculateDays();
  }, [targetDateStr]);

  const tags = [
    { icon: "💻", label: "開発" },
    { icon: "📚", label: "座学" },
    { icon: "✅", label: "達成" },
    { icon: "❌", label: "詰まった" },
    { icon: "😴", label: "眠い" },
  ];

  const handleSend = async () => { // async を追加
    if (!inputText) return;

    // 1. ユーザーのメッセージを画面に表示
    const userMsg = { text: inputText, tag: selectedTag, sender: "me" };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInputText("");

    // --- ここから AWS Lambda 呼び出し ---
    try {
      const endpoint = "https://sdgfilub3j.execute-api.ap-southeast-2.amazonaws.com/default/future-self-feedback";
      
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: inputText,      // 報告内容
          tag: selectedTag,    // 選択された絵文字
          days_left: daysLeft  // 残り日数
        }),
      });

      if (!response.ok) throw new Error("通信エラー");

      const data = await response.json();
      
      // 2. AIからの本物の「喝」を画面に表示
      const aiMsg = { text: data.response, tag: "🤖", sender: "ai" };
      setMessages([...newMessages, aiMsg]);

    } catch (error) {
      console.error("Error:", error);
      // エラー時のフォールバック
      const errorMsg = { text: "未来の自分との通信に失敗した。今は自力で耐えろ。", tag: "⚠️", sender: "ai" };
      setMessages([...newMessages, errorMsg]);
    }
  };
  
  return (
    <div className="flex flex-col h-screen bg-gray-100 p-4 text-black">
      {/* 目標設定エリア */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-4 border-t-4 border-blue-600">
        <div className="flex items-center justify-between mb-4">
          <Link href="/" className="text-blue-500 text-sm font-bold">← TOP</Link>
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Target Deadline</span>
            <input 
              type="date" 
              value={targetDateStr}
              onChange={(e) => setTargetDateStr(e.target.value)}
              className="text-xs font-mono border-b border-gray-200 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
        
        <div className="text-center py-2">
          <p className="text-xs text-gray-400 font-bold mb-1">目標達成まで</p>
          <div className="flex items-center justify-center gap-2">
            <span className="text-sm font-bold text-gray-600">残り</span>
            <span className={`text-4xl font-black ${daysLeft !== null && daysLeft < 0 ? 'text-red-500' : 'text-blue-600'}`}>
              {daysLeft}
            </span>
            <span className="text-sm font-bold text-gray-600">日</span>
          </div>
        </div>
      </div>

      {/* チャット表示エリア */}
      <div className="flex-1 bg-white rounded-lg shadow-inner mb-4 p-4 overflow-y-auto flex flex-col gap-3 border border-gray-200">
        {messages.length === 0 ? (
          <div className="text-center mt-10">
            <p className="text-gray-300 text-sm">目標を設定して、自分を追い込もう</p>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div 
              key={index} 
              className={`flex flex-col ${msg.sender === "ai" ? "items-start" : "items-end"}`}
            >
              <span className="text-[10px] text-gray-400 mb-1 font-bold">
                {msg.sender === "ai" ? "🤖 FUTURE ME" : msg.tag}
              </span>
              <div className={`p-3 rounded-2xl max-w-[80%] text-sm shadow-sm ${
                msg.sender === "ai" 
                  ? "bg-gray-800 text-white rounded-tl-none" 
                  : "bg-blue-600 text-white rounded-tr-none"
              }`}>
                {msg.text}
              </div>
            </div>
          ))
        )}
      </div> {/* ← ここでチャット表示エリアの div を閉じる必要がありました */}

      {/* タグ選択 */}
      <div className="flex gap-2 mb-3 justify-center">
        {tags.map((t) => (
          <button
            key={t.icon}
            onClick={() => setSelectedTag(t.icon)}
            className={`flex flex-col items-center p-2 rounded-lg transition-all ${
              selectedTag === t.icon 
                ? "bg-blue-600 text-white scale-105 shadow-md" 
                : "bg-white text-gray-400 hover:bg-gray-100"
            }`}
          >
            <span className="text-lg">{t.icon}</span>
            <span className="text-[9px] font-bold">{t.label}</span>
          </button>
        ))}
      </div>

      {/* 入力フォーム */}
      <div className="flex gap-2 bg-white p-2 rounded-xl shadow-lg border border-gray-200">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="今日の積み上げを報告..."
          className="flex-1 p-2 text-sm focus:outline-none"
        />
        <button
          onClick={handleSend}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold active:scale-95 transition"
        >
          送信
        </button>
      </div>
    </div>
  );
}