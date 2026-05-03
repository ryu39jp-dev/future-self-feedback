"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import ReactMarkdown from 'react-markdown';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts';

export default function ChatPage() {
  const [inputText, setInputText] = useState("");
  const [messages, setMessages] = useState<{ text: string; tag: string; sender: string }[]>([]);
  const [selectedTag, setSelectedTag] = useState("💻");
  const [isTyping, setIsTyping] = useState(false);

  const [targetDateStr, setTargetDateStr] = useState("");
  const [targetGoal, setTargetGoal] = useState("");
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  
  const [chartData, setChartData] = useState<any[] | null>(null);
  const [probability, setProbability] = useState<number | null>(null);

  useEffect(() => {
    const savedDate = localStorage.getItem("myTargetDate");
    const savedGoal = localStorage.getItem("myTargetGoal");
    if (savedDate) setTargetDateStr(savedDate);
    if (savedGoal) setTargetGoal(savedGoal);
    if (!savedDate) setTargetDateStr("2026-12-31");
  }, []);

  useEffect(() => {
    if (!targetDateStr) return;
    localStorage.setItem("myTargetDate", targetDateStr);
    localStorage.setItem("myTargetGoal", targetGoal);

    const calculateDays = () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const target = new Date(targetDateStr);
      const diffTime = target.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      setDaysLeft(diffDays);
    };
    calculateDays();
  }, [targetDateStr, targetGoal]);

  const tags = [
    { icon: "💻", label: "開発" },
    { icon: "📚", label: "座学" },
    { icon: "✅", label: "達成" },
    { icon: "❌", label: "詰まった" },
    { icon: "😴", label: "眠い" },
  ];

  const handleSend = async () => {
    if (!inputText) return;

    const userMsg = { text: inputText, tag: selectedTag, sender: "me" };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInputText("");
    setIsTyping(true);

    try {
      const endpoint = "https://sdgfilub3j.execute-api.ap-southeast-2.amazonaws.com/default/future-self-feedback";
      
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: inputText,
          tag: selectedTag,
          days_left: daysLeft,
          target_goal: targetGoal
        }),
      });

      if (!response.ok) throw new Error("通信エラー");

      const data = await response.json();
      let aiResponseText = data.response;

      const graphMatch = aiResponseText.match(/<GRAPH_DATA>([\s\S]*?)<\/GRAPH_DATA>/);
      if (graphMatch) {
        try {
          const parsedData = JSON.parse(graphMatch[1]);
          setChartData(parsedData.nodes); 
          setProbability(parsedData.probability); 
          
          aiResponseText = aiResponseText.replace(/<GRAPH_DATA>[\s\S]*?<\/GRAPH_DATA>/, "").trim();
        } catch (e) {
          console.error("JSONのパースに失敗:", e);
        }
      }

      const aiMsg = { text: aiResponseText, tag: "🤖", sender: "ai" };
      setMessages([...newMessages, aiMsg]);

    } catch (error) {
      console.error("Error:", error);
      const errorMsg = { text: "未来の自分との通信に失敗した。今は自力で耐えろ。", tag: "⚠️", sender: "ai" };
      setMessages([...newMessages, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100 p-4 text-black">
      
      {/* 目標設定エリア */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-4 border-t-4 border-blue-600 grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* 左側：目標入力、残り日数、合格確率 */}
        <div className="flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <Link href="/" className="text-blue-500 text-sm font-bold">← TOP</Link>
            <div className="flex flex-col items-end">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Deadline</span>
              <input 
                type="date" 
                value={targetDateStr}
                onChange={(e) => setTargetDateStr(e.target.value)}
                className="text-xs font-mono border-b border-gray-200 focus:outline-none focus:border-blue-500 text-black bg-transparent text-right"
              />
            </div>
          </div>

          <div className="mb-4">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest block mb-1">Target Goal</span>
            <input 
              type="text" 
              value={targetGoal}
              onChange={(e) => setTargetGoal(e.target.value)}
              placeholder="例：AWS SAA取得"
              className="w-full text-sm font-bold border-b border-gray-100 focus:border-blue-500 focus:outline-none bg-transparent placeholder-gray-300"
            />
          </div>
          
          <div className="flex items-center gap-6 border-t border-gray-50 pt-2">
            <div className="flex items-baseline gap-1">
              <span className="text-[9px] text-gray-400 font-bold">残り</span>
              <span className={`text-3xl font-black ${daysLeft !== null && daysLeft < 0 ? 'text-red-500' : 'text-blue-600'}`}>
                {daysLeft}
              </span>
              <span className="text-[9px] text-gray-400 font-bold">日</span>
            </div>

            {/* 達成確率の表示 */}
            {probability !== null && (
              <div className="flex items-baseline gap-1 border-l pl-4 border-gray-100">
                <span className="text-[9px] text-gray-400 font-bold">達成確率</span>
                <div className="flex items-baseline">
                  <span className={`text-3xl font-black ${
                    probability > 70 ? 'text-green-500' : 
                    probability > 40 ? 'text-orange-500' : 'text-red-500'
                  }`}>
                    {probability}
                  </span>
                  <span className={`text-sm font-bold ml-0.5 ${
                    probability > 70 ? 'text-green-500' : 
                    probability > 40 ? 'text-orange-500' : 'text-red-500'
                  }`}>%</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 右側：レーダーチャート */}
        <div className="h-[180px] w-full flex items-center justify-center bg-gray-50 rounded-lg overflow-hidden">
          {chartData ? (
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="60%" data={chartData}>
                <PolarGrid stroke="#e5e7eb" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#9ca3af', fontSize: 8 }} />
                <Radar
                  name="Progress"
                  dataKey="value"
                  stroke="#2563eb"
                  fill="#3b82f6"
                  fillOpacity={0.5}
                />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-[10px] text-gray-300 font-bold uppercase">Waiting for report...</p>
          )}
        </div>
      </div>

      {/* チャット表示エリア */}
      <div className="flex-1 bg-white rounded-lg shadow-inner mb-4 p-4 overflow-y-auto flex flex-col gap-3 border border-gray-200 text-black font-sans">
        {messages.length === 0 ? (
          <div className="text-center mt-10">
            <p className="text-gray-300 text-sm font-bold tracking-widest uppercase">Target locked. Start reporting.</p>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div 
              key={index} 
              className={`flex flex-col ${msg.sender === "ai" ? "items-start" : "items-end"}`}
            >
              <span className="text-[9px] text-gray-400 mb-1 font-bold uppercase tracking-wider">
                {msg.sender === "ai" ? "🤖 Future Analysis" : msg.tag}
              </span>
              <div className={`p-3 rounded-2xl max-w-[85%] text-sm shadow-sm ${
                msg.sender === "ai" 
                  ? "bg-gray-800 text-zinc-100 rounded-tl-none prose prose-invert prose-sm" 
                  : "bg-blue-600 text-white rounded-tr-none"
              }`}>
                {msg.sender === "ai" ? (
                  <div className="whitespace-pre-wrap leading-relaxed">
                    <ReactMarkdown>                      
                      {msg.text}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap font-medium">{msg.text}</div>
                )}
              </div>
            </div>
          ))
        )}
        
        {isTyping && (
          <div className="flex flex-col items-start mb-4">
            <span className="text-[9px] text-gray-400 mb-1 font-bold">🤖 FUTURE ANALYSIS IN PROGRESS...</span>
            <div className="bg-gray-800 p-3 rounded-2xl rounded-tl-none shadow-sm flex gap-1">
              <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse"></div>
              <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse [animation-delay:0.2s]"></div>
              <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse [animation-delay:0.4s]"></div>
            </div>
          </div>
        )}
      </div>

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
      <div className="flex gap-2 bg-white p-2 rounded-xl shadow-lg border border-gray-200 mb-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="今日の進捗を同期せよ..."
          className="flex-1 p-2 text-sm focus:outline-none text-black bg-transparent"
        />
        <button
          onClick={handleSend}
          className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-bold active:scale-95 transition"
        >
          同期
        </button>
      </div>
    </div>
  );
}