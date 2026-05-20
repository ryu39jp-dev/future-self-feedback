"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import ReactMarkdown from 'react-markdown';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

// --- 型定義 ---
type HistoryPoint = { date: string; probability: number };
type Message = { text: string; tag: string; sender: string };
type Goal = {
  id: string;
  title: string;
  deadline: string;
  fixedSubjects: string[];
  history: HistoryPoint[];
  messages: Message[];
  chartData: any[] | null;
  probability: number | null;
};

export default function ChatPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [activeGoalId, setActiveGoalId] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");
  const [selectedTag, setSelectedTag] = useState("💻");
  const [isTyping, setIsTyping] = useState(false);
  const [currentView, setCurrentView] = useState<"chat" | "dashboard">("chat");

  const chatEndRef = useRef<HTMLDivElement>(null);

  // ★ 1. まず先に activeGoal の定義を持ってくる
  const activeGoal = goals.find(g => g.id === activeGoalId) || null;

  // ★ 2. 初期データ読み込み（AWSのDynamoDBからデータを取得する）
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const endpoint = "https://sdgfilub3j.execute-api.ap-southeast-2.amazonaws.com/default/future-self-feedback";
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: "ryu39-test", // テスト用の固定ID
            action: "load_data"    // Lambda側に読み込みモードだと伝える
          }),
        });

        const resData = await response.json();
        
        if (resData.exists && resData.data) {
          // --- AWSにデータが存在した場合 ---
          const dbData = resData.data;
          
          // DynamoDBから降ってきたデータを元に、フロントの「Goal」型に復元する
          // ※現状は1つの目標データが保存されている状態なので、それを配列の先頭に入れます
          const loadedGoal: Goal = {
            id: "default",
            title: dbData.target_goal || "AWS SAA取得",
            deadline: localStorage.getItem("myTargetDate") || "2026-12-31", // 日付はひとまずローカルから
            fixedSubjects: [],
            history: [],
            messages: dbData.messages || [], // ここがDynamoDBのチャット履歴
            chartData: null,
            probability: null,
          };
          
         
          
          setGoals([loadedGoal]);
          setActiveGoalId(loadedGoal.id);

        } else {
          // --- AWSにまだデータがない場合、従来のローカルストレージ方式で初期化 ---
          const savedGoals = localStorage.getItem("multi_goal_data");
          if (savedGoals) {
            const parsed = JSON.parse(savedGoals);
            setGoals(parsed);
            if (parsed.length > 0) setActiveGoalId(parsed[0].id);
          } else {
            const initialGoal: Goal = {
              id: "default",
              title: localStorage.getItem("myTargetGoal") || "AWS SAA取得",
              deadline: localStorage.getItem("myTargetDate") || "2026-12-31",
              fixedSubjects: JSON.parse(localStorage.getItem("myFixedSubjects") || "[]"),
              history: JSON.parse(localStorage.getItem("myProgressHistory") || "[]"),
              messages: [],
              chartData: null,
              probability: null,
            };
            setGoals([initialGoal]);
            setActiveGoalId(initialGoal.id);
          }
        }
      } catch (e) {
        console.error("AWSからのデータ読み込みに失敗しました。ローカルストレージを使用します:", e);
        // ネットワークエラー等のフォールバック
        const savedGoals = localStorage.getItem("multi_goal_data");
        if (savedGoals) {
          const parsed = JSON.parse(savedGoals);
          setGoals(parsed);
          if (parsed.length > 0) setActiveGoalId(parsed[0].id);
        }
      }
    };

    loadUserData();
  }, []);

  // ★ 3. ローカルストレージへの同期
  useEffect(() => {
    if (goals.length > 0) localStorage.setItem("multi_goal_data", JSON.stringify(goals));
  }, [goals]);

  // ★ 4. 自動スクロール（activeGoal の定義より後に実行されるので安全）
  useEffect(() => {
    if (currentView === "chat") {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeGoal?.messages, isTyping, currentView]);

  const updateActiveGoal = (updates: Partial<Goal>) => {
    setGoals(prev => prev.map(g => g.id === activeGoalId ? { ...g, ...updates } : g));
  };

  const addNewGoal = () => {
    const newGoal: Goal = {
      id: Date.now().toString(),
      title: "新規目標",
      deadline: "2026-12-31",
      fixedSubjects: [],
      history: [],
      messages: [],
      chartData: null,
      probability: null,
    };
    setGoals([...goals, newGoal]);
    setActiveGoalId(newGoal.id);
    setCurrentView("chat");
  };

  const handleSend = async () => {
    if (!inputText || !activeGoal) return;
    const userMsg = { text: inputText, tag: selectedTag, sender: "me" };
    const newMessages = [...activeGoal.messages, userMsg];
    updateActiveGoal({ messages: newMessages });
    setInputText("");
    setIsTyping(true);
    setCurrentView("chat");

    try {
      const endpoint = "https://sdgfilub3j.execute-api.ap-southeast-2.amazonaws.com/default/future-self-feedback";
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const diffTime = new Date(activeGoal.deadline).getTime() - today.getTime();
      const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: "ryu39-test",
          text: inputText,
          tag: selectedTag,
          days_left: daysLeft,
          target_goal: activeGoal.title,
          fixed_subjects: activeGoal.fixedSubjects
        }),
      });

      const data = await response.json();
      let aiResponseText = data.response;
      const graphMatch = aiResponseText.match(/<GRAPH_DATA>([\s\S]*?)<\/GRAPH_DATA>/);
      
      let nextChartData = activeGoal.chartData;
      let nextProb = activeGoal.probability;
      let nextSubjects = activeGoal.fixedSubjects;
      let nextHistory = [...activeGoal.history];

      if (graphMatch) {
        const parsedData = JSON.parse(graphMatch[1]);
        nextChartData = parsedData.nodes;
        nextProb = parsedData.probability;
        if (nextSubjects.length === 0) nextSubjects = parsedData.nodes.map((n: any) => n.subject);
        
        const todayLabel = new Date().toLocaleDateString('ja-JP');
        const existingIndex = nextHistory.findIndex(item => item.date === todayLabel);
        if (existingIndex !== -1) {
          nextHistory[existingIndex] = { ...nextHistory[existingIndex], probability: nextProb! };
        } else {
          nextHistory.push({ date: todayLabel, probability: nextProb! });
        }
        aiResponseText = aiResponseText.replace(/<GRAPH_DATA>[\s\S]*?<\/GRAPH_DATA>/, "").trim();
      }

      updateActiveGoal({
        messages: [...newMessages, { text: aiResponseText, tag: "🤖", sender: "ai" }],
        chartData: nextChartData,
        probability: nextProb,
        fixedSubjects: nextSubjects,
        history: nextHistory
      });
    } catch (e) { console.error(e); } finally { setIsTyping(false); }
  };

  if (!activeGoal) return null;

  const probColor = activeGoal.probability !== null 
    ? (activeGoal.probability > 70 ? 'text-green-500' : activeGoal.probability > 40 ? 'text-orange-500' : 'text-red-500')
    : 'text-gray-400';

  return (
    <div className="h-screen bg-gray-50 p-3 text-black font-sans flex flex-col overflow-hidden">
      
      {/* 1. 目標切り替えタブ */}
      <div className="flex gap-2 overflow-x-auto pb-2 flex-shrink-0 no-scrollbar">
        {goals.map((g) => (
          <button
            key={g.id}
            onClick={() => setActiveGoalId(g.id)}
            className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${
              activeGoalId === g.id ? "bg-blue-600 text-white border-blue-700 shadow-sm" : "bg-white text-gray-400 border-gray-200"
            }`}
          >
            {g.title}
          </button>
        ))}
        <button onClick={addNewGoal} className="px-3 py-1.5 bg-gray-200 rounded-full text-xs text-gray-500 font-bold">＋</button>
      </div>

      {/* 2. 表示切り替えスイッチ */}
      <div className="grid grid-cols-2 gap-1 bg-gray-200 p-1 rounded-xl mb-3 flex-shrink-0 text-xs font-bold">
        <button 
          onClick={() => setCurrentView("chat")} 
          className={`py-2 rounded-lg transition-all ${currentView === "chat" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500"}`}
        >
          💬 チャット履歴
        </button>
        <button 
          onClick={() => setCurrentView("dashboard")} 
          className={`py-2 rounded-lg transition-all ${currentView === "dashboard" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500"}`}
        >
          📊 分析データ
        </button>
      </div>

      {/* メインコンテンツエリア */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        
        {/* 【Aパターン】分析データタブ */}
        {currentView === "dashboard" && (
          <div className="flex-1 overflow-y-auto space-y-4 pb-4 no-scrollbar">
            <div className="bg-white rounded-2xl shadow-sm p-4 border border-gray-100 grid grid-cols-1 gap-4">
              <div className="flex justify-between items-start">
                <div className="flex-1 mr-4 text-left">
                  <span className="text-[9px] text-gray-400 font-black uppercase tracking-widest block mb-0.5">Target</span>
                  <input 
                    type="text" 
                    value={activeGoal.title}
                    onChange={(e) => updateActiveGoal({ title: e.target.value })}
                    className="text-base font-bold bg-transparent outline-none border-b border-transparent focus:border-blue-500 w-full"
                  />
                </div>
                <div className="text-right">
                  <span className="text-[9px] text-gray-400 font-black uppercase tracking-widest block mb-0.5">Deadline</span>
                  <input 
                    type="date" 
                    value={activeGoal.deadline}
                    onChange={(e) => updateActiveGoal({ deadline: e.target.value })}
                    className="text-xs font-mono text-gray-600 bg-transparent outline-none w-[115px]"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-gray-50 flex gap-8">
                <div>
                  <span className="text-[9px] text-gray-400 font-bold block mb-0.5">達成確率</span>
                  <div className="flex items-baseline gap-0.5">
                    <span className={`text-3xl font-black ${probColor}`}>{activeGoal.probability ?? "--"}</span>
                    <span className={`text-xs font-bold ${probColor}`}>%</span>
                  </div>
                </div>
                <div>
                  <span className="text-[9px] text-gray-400 font-bold block mb-0.5">現状診断</span>
                  <div className="text-xs font-bold mt-1.5">
                    {activeGoal.probability && activeGoal.probability > 70 ? "🟢 順調" : activeGoal.probability && activeGoal.probability > 40 ? "🟡 要注意" : "🔴 危険"}
                  </div>
                </div>
              </div>
            </div>

            <div className="h-[200px] w-full bg-white border border-gray-100 rounded-2xl p-3 relative shadow-sm">
              <span className="absolute top-3 left-4 text-[9px] text-gray-400 font-bold uppercase tracking-widest">Balance</span>
              {activeGoal.chartData ? (
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="60%" data={activeGoal.chartData}>
                    <PolarGrid stroke="#e5e7eb" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#6b7280', fontSize: 9, fontWeight: 'bold' }} />
                    <Radar dataKey="value" stroke="#2563eb" fill="#3b82f6" fillOpacity={0.5} />
                  </RadarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-gray-300 font-bold">データがありません</div>
              )}
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-4 border border-gray-100 h-[160px] relative">
              <span className="text-[9px] text-gray-400 font-bold uppercase absolute top-3 left-4 tracking-widest">Trend (Probability)</span>
              {activeGoal.history.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={activeGoal.history} margin={{ top: 25, right: 10, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="date" tick={{fontSize: 8, fill: '#9ca3af'}} />
                    <YAxis domain={[0, 100]} tick={{fontSize: 8, fill: '#9ca3af'}} />
                    <Tooltip contentStyle={{ fontSize: '10px', borderRadius: '8px' }} />
                    <Line type="monotone" dataKey="probability" stroke="#2563eb" strokeWidth={3} dot={{ r: 4, fill: '#2563eb' }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-gray-300 font-bold">履歴データがありません</div>
              )}
            </div>
          </div>
        )}

        {/* 【Bパターン】チャット履歴タブ */}
        {currentView === "chat" && (
          <div className="flex-1 bg-white rounded-2xl shadow-inner p-4 overflow-y-auto border border-gray-100 flex flex-col gap-4 min-h-0">
            {activeGoal.messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full opacity-25 py-20">
                <div className="text-4xl mb-2">🎯</div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em]">Ready for Sync</p>
              </div>
            ) : (
              activeGoal.messages.map((msg, index) => (
                <div key={index} className={`flex flex-col ${msg.sender === "ai" ? "items-start" : "items-end"}`}>
                  <span className="text-[9px] text-gray-400 mb-1 font-bold uppercase tracking-wider px-1">
                    {msg.sender === "ai" ? "🤖 Future Feedback" : msg.tag}
                  </span>
                  <div className={`p-3.5 rounded-2xl max-w-[88%] text-[13px] leading-relaxed shadow-sm ${
                    msg.sender === "ai" ? "bg-zinc-900 text-zinc-100 rounded-tl-none" : "bg-blue-600 text-white rounded-tr-none font-medium"
                  }`}>
                    {msg.sender === "ai" ? (
                      <div className="prose prose-sm prose-invert max-w-none text-left">
                        <ReactMarkdown>{msg.text}</ReactMarkdown>
                      </div>
                    ) : (
                      msg.text
                    )}
                  </div>
                </div>
              ))
            )}
            {isTyping && <div className="text-blue-500 text-[10px] font-bold animate-pulse ml-2 tracking-widest py-1">ANALYZING...</div>}
            <div ref={chatEndRef} />
          </div>
        )}
      </div>

      {/* 5. 固定入力セクション */}
      <div className="space-y-2 mt-2 bg-gray-50 pt-1 flex-shrink-0">
        <div className="flex gap-3 justify-center">
          {[
            { icon: "💻", label: "開発" },
            { icon: "📚", label: "勉強" },
            { icon: "✅", label: "完了" },
            { icon: "❌", label: "停滞" },
            { icon: "😴", label: "休息" }
          ].map((item) => (
            <button 
              key={item.label} 
              onClick={() => setSelectedTag(item.icon)} 
              className="flex flex-col items-center gap-0.5 group"
            >
              <div className={`w-10 h-10 flex items-center justify-center rounded-full transition-all ${
                selectedTag === item.icon 
                  ? "bg-blue-600 text-white scale-105 shadow-md" 
                  : "bg-white text-gray-400 border border-gray-100"
              }`}>
                <span className="text-base">{item.icon}</span>
              </div>
              <span className={`text-[8px] font-bold ${selectedTag === item.icon ? "text-blue-600" : "text-gray-400"}`}>
                {item.label}
              </span>
            </button>
          ))}
        </div>
        <div className="flex gap-2 bg-white p-2 rounded-xl shadow-lg border border-gray-100">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="今日の進捗を報告..."
            className="flex-1 px-2 text-sm focus:outline-none bg-transparent min-w-0 text-black"
          />
          <button onClick={handleSend} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold active:scale-95 transition flex-shrink-0">同期</button>
        </div>
      </div>
      <Link href="/" className="my-1.5 text-[9px] font-bold text-gray-300 hover:text-blue-500 transition uppercase tracking-widest text-center block flex-shrink-0">← Return</Link>
    </div>
  );
}