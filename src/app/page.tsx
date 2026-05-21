"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithPopup } from 'firebase/auth';
// 💡 同じフォルダにあるので "../../" ではなく "./" に修正！
import { auth, googleProvider } from './firebase'; 

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleGoogleLogin = async () => {
    try {
      setError(null);
      // FirebaseのGoogleポップアップログインを実行
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user) {
        // ログインが成功したらチャット画面（/chat）へ移動
        router.push('/chat');
      }
    } catch (err: any) {
      console.error("Googleログインエラー:", err);
      setError("ログインに失敗しました。もう一度お試しください。");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 text-black p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100 max-w-sm w-full text-center space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-black tracking-tight">Future Self Sync</h1>
          <p className="text-xs text-gray-400 font-medium">未来の自分と進捗を同期する</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-500 text-xs p-3 rounded-lg font-bold text-left">
            {error}
          </div>
        )}

        <button
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-3 bg-zinc-900 text-white font-bold py-3 px-4 rounded-xl hover:bg-zinc-800 active:scale-[0.98] transition-all shadow-md text-sm"
        >
          {/* GoogleっぽいGのロゴの代わりに絵文字にしています。必要に応じてGアイコン等に変えてください */}
          <span>🔑</span>
          Googleアカウントでログイン
        </button>
      </div>
    </div>
  );
}