"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import ReactMarkdown from 'react-markdown';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { auth } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";

// --- 型定義 ---
type HistoryPoint = { date: string; probability: number };
type Message = { text: string; tag: string; sender: string };

// ★ mustDo / nextDo を追加
type Goal = {
  id: string;
  title: string;
  deadline: string;
  fixedSubjects: string[];
  history: HistoryPoint[];
  messages: Message[];
  chartData: any[] | null;
  probability: number | null;
  mustDo: string[];
  nextDo: string[];
};

export default function ChatPage() {
  const [userId, setUserId] = useState<string | null>(null); 
  const [goals, setGoals] = useState<Goal[]>([]);
  const [activeGoalId, setActiveGoalId] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");
  const [selectedTag, setSelectedTag] = useState("💻");
  const [isTyping, setIsTyping] = useState(false);
  const [isFetchingActions, setIsFetchingActions] = useState(false); // ★ 追加
  const [currentView, setCurrentView] = useState<"chat" | "dashboard">("chat");

  const chatEndRef = useRef<HTMLDivElement>(null);

  const activeGoal = goals.find(g => g.id === activeGoalId) || null;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
      } else {
        setUserId("guest");
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId) return;
    setGoals([]);
    setActiveGoalId(null);

    const loadUserData = async () => {
      try {
        const endpoint = "https://sdgfilub3j.execute-api.ap-southeast-2.amazonaws.com/default/future-self-feedback";
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: userId, action: "load_data" }),
        });

        const resData = await response.json();
        
        if (resData.exists && Array.isArray(resData.goals) && resData.goals.length > 0) {
          // ★ 既存データにmustDo/nextDoがない場合は空配列で補完
          const goals = resData.goals.map((g: Goal) => ({
            ...g,
            mustDo: g.mustDo ?? [],
            nextDo: g.nextDo ?? [],
          }));
          setGoals(goals);
          setActiveGoalId(goals[0].id);
        } else if (resData.exists && resData.data) {
          const dbData = resData.data;
          const loadedGoal: Goal = {
            id: "default",
            title: dbData.target_goal || "AWS SAA取得",
            deadline: "2026-12-31",
            fixedSubjects: [],
            history: [],
            messages: dbData.messages || [],
            chartData: null,
            probability: null,
            mustDo: [],  // ★ 追加
            nextDo: [],  // ★ 追加
          };
          setGoals([loadedGoal]);
          setActiveGoalId(loadedGoal.id);
        } else {
          const initialGoal: Goal = {
            id: "default",
            title: "AWS SAA取得",
            deadline: "2026-12-31",
            fixedSubjects: [],
            history: [],
            messages: [],
            chartData: null,
            probability: null,
            mustDo: [],  // ★ 追加
            nextDo: [],  // ★ 追加
          };
          setGoals([initialGoal]);
          setActiveGoalId(initialGoal.id);
        }
      } catch (e) {
        console.error("AWSからのデータ読み込みに失敗しました:", e);
      }
    };

    loadUserData();
  }, [userId]);

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
      mustDo: [],  // ★ 追加
      nextDo: [],  // ★ 追加
    };
    setGoals([...goals, newGoal]);
    setActiveGoalId(newGoal.id);
    setCurrentView("chat");
  };

  // ★ AIレスポンスからACTION_DATAを共通パース
  const parseActionData = (text: string) => {
    const match = text.match(/<ACTION_DATA>([\s\S]*?)<\/ACTION_DATA>/);
    if (!match) return null;
    try {
      const parsed = JSON.parse(match[1]);
      return {
        mustDo: parsed.must_do ?? [],
        nextDo: parsed.next_do ?? [],
        cleanText: text.replace(/<ACTION_DATA>[\s\S]*?<\/ACTION_DATA>/, "").trim(),
      };
    } catch {
      return null;
    }
  };

  // ★ ダッシュボードの「分析を更新」ボタン用：チャット履歴を元にアクション提案を取得
  const fetchActionItems = async () => {
    if (!activeGoal || !userId || isFetchingActions) return;
    setIsFetchingActions(true);

    try {
      const endpoint = "https://sdgfilub3j.execute-api.ap-southeast-2.amazonaws.com/default/future-self-feedback";
      const today = new Date();
      const diffTime = new Date(activeGoal.deadline).getTime() - today.getTime();
      const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          goal_id: activeGoal.id,
          action: "analyze_actions",
          target_goal: activeGoal.title,
          days_left: daysLeft,
          fixed_subjects: activeGoal.fixedSubjects,
          probability: activeGoal.probability,
          messages: activeGoal.messages.slice(-10), // 直近10件を送信
          // ↓ Lambdaへのプロンプト指示（バックエンドで使用）
          prompt_hint: `以下のJSON形式のみで返してください。説明文は不要です。
{
  "must_do": ["今すぐやるべきこと1", "今すぐやるべきこと2", "今すぐやるべきこと3"],
  "next_do": ["次にやるべきこと1", "次にやるべきこと2", "次にやるべきこと3"]
}
must_doは達成確率を上げるために最優先でやること（最大3件）、next_doはその次にやるべきこと（最大3件）。`
        }),
      });

      const data = await response.json();
      // ACTION_DATAタグ形式またはJSONを試みてパース
      let mustDo: string[] = [];
      let nextDo: string[] = [];

      if (data.must_do && data.next_do) {
        // Lambdaが直接JSONを返した場合
        mustDo = data.must_do;
        nextDo = data.next_do;
      } else if (data.response) {
        // テキストレスポンスの場合はパース
        const actionParsed = parseActionData(data.response);
        if (actionParsed) {
          mustDo = actionParsed.mustDo;
          nextDo = actionParsed.nextDo;
        } else {
          // フォールバック：JSONを直接パース試みる
          try {
            const jsonMatch = data.response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              mustDo = parsed.must_do ?? [];
              nextDo = parsed.next_do ?? [];
            }
          } catch {}
        }
      }

      if (mustDo.length > 0 || nextDo.length > 0) {
        const updated = goals.map(g => g.id === activeGoalId ? { ...g, mustDo, nextDo } : g);
        setGoals(updated);

        // DynamoDB保存
        await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: userId,
            action: "save_all_goals",
            goals: updated,
          }),
        });
      }
    } catch (e) {
      console.error("アクション分析エラー:", e);
    } finally {
      setIsFetchingActions(false);
    }
  };

  const handleSend = async () => {
    if (!inputText || !activeGoal || !userId) return;
    
    const userMsg = { text: inputText, tag: selectedTag, sender: "me" };
    const newMessages = [...activeGoal.messages, userMsg];
    
    const updatedActiveBeforeAI = { ...activeGoal, messages: newMessages };
    setGoals(prev => prev.map(g => g.id === activeGoalId ? updatedActiveBeforeAI : g));
    
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
          user_id: userId,
          goal_id: activeGoal.id,
          action: "send_message",
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
      let nextMustDo = activeGoal.mustDo;  // ★ 追加
      let nextNextDo = activeGoal.nextDo;  // ★ 追加

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

      // ★ ACTION_DATAのパース
      const actionParsed = parseActionData(aiResponseText);
      if (actionParsed) {
        nextMustDo = actionParsed.mustDo;
        nextNextDo = actionParsed.nextDo;
        aiResponseText = actionParsed.cleanText;
      }

      const finalActiveGoal = {
        ...activeGoal,
        messages: [...newMessages, { text: aiResponseText, tag: "🤖", sender: "ai" }],
        chartData: nextChartData,
        probability: nextProb,
        fixedSubjects: nextSubjects,
        history: nextHistory,
        mustDo: nextMustDo,  // ★ 追加
        nextDo: nextNextDo,  // ★ 追加
      };

      const nextGoals = goals.map(g => g.id === activeGoalId ? finalActiveGoal : g);
      setGoals(nextGoals);

      await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          action: "save_all_goals", 
          goals: nextGoals          
        }),
      });

    } catch (e) { 
      console.error("同期エラー:", e); 
    } finally { 
      setIsTyping(false); 
    }
  };

  if (goals.length === 0 || !activeGoal) {
    return (
      <div className="h-screen bg-gray-50 flex items-center justify-center text-black font-sans">
        <div className="text-center">
          <div className="text-2xl animate-spin mb-2">🔄</div>
          <p className="text-xs font-bold text-gray-400 tracking-widest uppercase">Loading Secure Data...</p>
        </div>
      </div>
    );
  }

  const probColor = activeGoal.probability !== null 
    ? (activeGoal.probability > 70 ? 'text-green-500' : activeGoal.probability > 40 ? 'text-orange-500' : 'text-red-500')
    : 'text-gray-400';

  // ★ ダッシュボードに表示するアクションがあるかどうか
  const hasActions = activeGoal.mustDo.length > 0 || activeGoal.nextDo.length > 0;

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
        
        {/* 分析データタブ */}
        {currentView === "dashboard" && (
          <div className="flex-1 overflow-y-auto space-y-4 pb-4 no-scrollbar">
            
            {/* 目標・確率カード */}
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

            {/* ★ ぜひやること / 次やること セクション */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {/* ヘッダー */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
                <span className="text-[9px] text-gray-400 font-black uppercase tracking-widest">Action Items</span>
                <button
                  onClick={fetchActionItems}
                  disabled={isFetchingActions || activeGoal.messages.length === 0}
                  className={`text-[9px] font-bold px-3 py-1 rounded-full transition-all border ${
                    isFetchingActions 
                      ? "border-blue-200 text-blue-300 animate-pulse" 
                      : activeGoal.messages.length === 0
                      ? "border-gray-200 text-gray-300 cursor-not-allowed"
                      : "border-blue-500 text-blue-600 active:scale-95"
                  }`}
                >
                  {isFetchingActions ? "分析中..." : "🔄 分析を更新"}
                </button>
              </div>

              {!hasActions ? (
                // データなし状態
                <div className="px-4 py-8 text-center">
                  <p className="text-[10px] text-gray-300 font-bold uppercase tracking-widest">
                    {activeGoal.messages.length === 0
                      ? "チャットで進捗を報告すると分析が始まります"
                      : "「分析を更新」を押してアクションを生成"}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {/* ぜひやること */}
                  {activeGoal.mustDo.length > 0 && (
                    <div className="px-4 py-3">
                      <div className="flex items-center gap-1.5 mb-2.5">
                        <span className="text-[9px] font-black text-red-500 uppercase tracking-widest">🔥 ぜひやること</span>
                        <span className="text-[8px] text-gray-300 font-bold">— 今すぐ優先</span>
                      </div>
                      <div className="space-y-2">
                        {activeGoal.mustDo.map((item, i) => (
                          <div key={i} className="flex items-start gap-2.5">
                            <div className="w-4 h-4 rounded-full bg-red-50 border border-red-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <span className="text-[8px] font-black text-red-500">{i + 1}</span>
                            </div>
                            <span className="text-xs text-gray-700 leading-relaxed font-medium">{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 次やること */}
                  {activeGoal.nextDo.length > 0 && (
                    <div className="px-4 py-3">
                      <div className="flex items-center gap-1.5 mb-2.5">
                        <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest">➡️ 次やること</span>
                        <span className="text-[8px] text-gray-300 font-bold">— その後のステップ</span>
                      </div>
                      <div className="space-y-2">
                        {activeGoal.nextDo.map((item, i) => (
                          <div key={i} className="flex items-start gap-2.5">
                            <div className="w-4 h-4 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <span className="text-[8px] font-black text-blue-500">{i + 1}</span>
                            </div>
                            <span className="text-xs text-gray-600 leading-relaxed">{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* バランスレーダー */}
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

            {/* トレンドチャート */}
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

        {/* チャット履歴タブ */}
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

      {/* 入力セクション */}
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