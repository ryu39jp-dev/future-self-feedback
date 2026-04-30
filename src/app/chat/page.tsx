"use client";

import { useState } from "react";
import Link from "next/link";

export default function ChatPage() {
  const [inputText, setInputText] = useState("");
  // メッセージのリストを保存する箱（初期値は空の配列 [] ）
  const [messages, setMessages] = useState<string[]>([]);

  const handleSend = () => {
    if (!inputText) return;

    // 今までのメッセージに、新しい入力内容を追加して新しい配列を作る
    setMessages([...messages, inputText]);
    
    // 入力欄を空にする
    setInputText("");
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100 p-4 text-black">
      <div className="flex items-center mb-4">
        <Link href="/" className="text-blue-500 mr-4">← 戻る</Link>
        <h1 className="text-xl font-bold">未来の自分へのメッセージ</h1>
      </div>

      {/* メッセージ表示エリア */}
      <div className="flex-1 bg-white rounded-lg shadow-inner mb-4 p-4 overflow-y-auto flex flex-col gap-2">
        {messages.length === 0 ? (
          <p className="text-gray-400 text-center mt-10">メッセージを送ってみよう！</p>
        ) : (
          messages.map((msg, index) => (
            <div key={index} className="self-end bg-blue-500 text-white p-3 rounded-2xl rounded-tr-none max-w-[80%]">
              {msg}
            </div>
          ))
        )}
      </div>

      {/* 入力フォーム */}
      <div className="flex gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()} // Enterキーでも送れるように
          placeholder="メッセージを入力..."
          className="flex-1 p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleSend}
          className="bg-blue-500 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-600 transition"
        >
          送信
        </button>
      </div>
    </div>
  );
}