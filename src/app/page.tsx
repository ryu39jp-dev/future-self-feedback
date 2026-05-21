'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../../firebase';

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // 🔥 本物のGoogleログインを呼び出す関数
  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      // Firebaseを使ってGoogleログインのポップアップ画面を開く
      const result = await signInWithPopup(auth, googleProvider);
      // ユーザー情報が取れたら、ログイン成功！
      if (result.user) {
        console.log('ログイン成功:', result.user.displayName);
        // チャットページへ画面をジャンプさせる
        router.push('/chat');
      }
    } catch (err: any) {
      console.error('ログインエラー:', err);
      setError('ログインに失敗しました。もう一度お試しください。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: '#f8fafc',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <div style={{ 
        padding: '40px', 
        background: '#fff', 
        borderRadius: '24px', 
        boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05), 0 8px 10px -6px rgba(0,0,0,0.05)', 
        border: '1px solid #e2e8f0',
        textAlign: 'center',
        width: '100%',
        maxWidth: '380px'
      }}>
        {/* ロゴ・タイトル */}
        <div style={{
          width: '48px',
          height: '48px',
          background: '#000',
          borderRadius: '12px',
          margin: '0 auto 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontSize: '20px',
          fontWeight: 'bold'
        }}>
          F
        </div>

        <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#0f172a', marginBottom: '8px' }}>
          Welcome back
        </h1>
        <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '32px' }}>
          未来の自分からフィードバックを受け取ろう
        </p>

        {/* エラー表示 */}
        {error && (
          <p style={{ color: '#ef4444', fontSize: '13px', marginBottom: '16px' }}>{error}</p>
        )}

        {/* ログインボタン */}
        <button 
          onClick={handleGoogleLogin}
          disabled={loading}
          style={{
            width: '100%',
            padding: '12px 16px',
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '12px',
            color: '#334155',
            fontSize: '14px',
            fontWeight: '600',
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            transition: 'background 0.2s',
            opacity: loading ? 0.7 : 1
          }}
        >
          {/* GoogleのGっぽい仮アイコン */}
          <span style={{ fontWeight: 'bold', color: '#4285F4', fontSize: '16px' }}>G</span>
          {loading ? '接続中...' : 'Google アカウントでログイン'}
        </button>
      </div>
    </div>
  );
}