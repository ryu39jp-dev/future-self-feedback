"use client"; // ← 「ユーザーが操作する画面だよ」という合図

import { useState } from "react";
import Link from "next/link";

export default function ChatPage() {
  // 入力された文字を「状態（State）」として保存する箱
  const [inputText, setInputText] = useState("");

  const handleSend = () => {
    if (!inputText) return;
    alert(`未来の自分へ: ${inputText}と送ったぞ`);
    setInputText(""); // 送信したら中身を空にする
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100 p-4">
      {/* ヘッダー */}
      <div className="flex items-center mb-4">
        <Link href="/" className="text-blue-500 mr-4">← 戻る</Link>
        <h1 className="text-xl font-bold">未来の自分へのメッセージ</h1>
      </div>

      {/* メッセージ表示エリア（今は空っぽ） */}
      <div className="flex-1 bg-white rounded-lg shadow-inner mb-4 p-4 overflow-y-auto">
        <p className="text-gray-400 text-center mt-10">
          未来の自分に、今の悩みを相談してみよう。
        </p>
      </div>

      {/* 入力フォーム */}
      <div className="flex gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="メッセージを入力..."
          className="flex-1 p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
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