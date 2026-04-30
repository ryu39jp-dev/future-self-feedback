import Link from 'next/link';

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <h1 className="text-4xl font-bold text-blue-600">未来の自分フィードバック</h1>
      <p className="mt-4 text-gray-600 text-lg">
        今の頑張りを、未来の自分に報告しよう。
      </p>

      {/* ここがページ移動の魔法のボタン */}
      <Link href="/chat">
        <button className="mt-8 px-6 py-3 bg-blue-500 text-white rounded-full font-bold hover:bg-blue-600 transition-colors">
          チャットをはじめる
        </button>
      </Link>
    </div>
  );
}