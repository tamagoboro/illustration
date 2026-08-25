'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Profile } from '@/types/database'
import { useCompareStore } from '@/store/useCompareStore'
import Link from 'next/link'
import { ArrowLeft, Check, X, ExternalLink, Trash2 } from 'lucide-react'

export default function ComparePage() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const { selectedIds, toggleIllustrator, clear } = useCompareStore()
  const supabase = createClient()

  useEffect(() => {
    async function fetchProfiles() {
      if (selectedIds.length === 0) {
        setProfiles([])
        setLoading(false)
        return
      }

      setLoading(true)
      const { data } = await supabase
        .from('profiles')
        .select('*, portfolio_items(*)')
        .in('user_id', selectedIds)

      if (data) {
        setProfiles(data as Profile[])
      }
      setLoading(false)
    }

    fetchProfiles()
  }, [selectedIds])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-500 font-bold">比較データを読み込み中...</p>
      </div>
    )
  }

  if (selectedIds.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 p-8 flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold text-slate-800 mb-4">比較対象が選択されていません</h1>
        <p className="text-slate-600 mb-6">一覧ページからイラストレーターを比較リストに追加してください。</p>
        <Link
          href="/"
          className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition"
        >
          <ArrowLeft size={18} /> 一覧画面に戻る
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-12 pb-24">
      {/* ヘッダー */}
      <div className="max-w-7xl mx-auto flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="p-2 bg-white rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition"
          >
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800">イラストレーター比較</h1>
        </div>
        <button
          onClick={clear}
          className="text-sm font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1 bg-rose-50 px-3 py-2 rounded-lg"
        >
          <Trash2 size={16} /> 比較リストをクリア
        </button>
      </div>

      {/* 比較テーブル */}
      <div className="max-w-7xl mx-auto overflow-x-auto">
        <div className="min-w-[800px] bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {/* グリッドレイアウト（列数は動的変化） */}
          <div
            className="grid divide-x divide-slate-200"
            style={{
              gridTemplateColumns: `200px repeat(${profiles.length}, minmax(220px, 1fr))`,
            }}
          >
            {/* 1. プロフィール・基本情報 */}
            <div className="p-4 bg-slate-50 font-bold text-slate-500 text-sm flex items-center">
              クリエイター
            </div>
            {profiles.map((p) => (
              <div key={p.user_id} className="p-5 flex flex-col items-center text-center relative">
                <button
                  onClick={() => toggleIllustrator(p.user_id)}
                  className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 p-1"
                  title="比較から外す"
                >
                  <X size={18} />
                </button>
                <img
                  src={p.avatar_url || 'https://via.placeholder.com/150'}
                  alt={p.display_name}
                  className="w-20 h-20 rounded-full object-cover mb-3 border-2 border-slate-100"
                />
                <h3 className="font-bold text-slate-800 text-lg">{p.display_name}</h3>
                <Link
                  href={`/creator/${p.user_id}`}
                  className="mt-2 text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1"
                >
                  マイページ表示 <ExternalLink size={12} />
                </Link>
              </div>
            ))}

            {/* 2. 近況コメント */}
            <div className="p-4 bg-slate-50 font-bold text-slate-500 text-sm flex items-center">
              ひとこと近況
            </div>
            {profiles.map((p) => (
              <div key={p.user_id} className="p-4 text-sm text-slate-600 bg-slate-50/50">
                {p.status_comment ? `💬 ${p.status_comment}` : '—'}
              </div>
            ))}

            {/* 3. 目安納期 */}
            <div className="p-4 bg-slate-50 font-bold text-slate-500 text-sm flex items-center">
              目安納期
            </div>
            {profiles.map((p) => (
              <div key={p.user_id} className="p-4 text-sm font-bold text-slate-800">
                {p.lead_time_days} 日以内
              </div>
            ))}

            {/* 4. 得意タグ・タッチ */}
            <div className="p-4 bg-slate-50 font-bold text-slate-500 text-sm flex items-center">
              得意なタグ
            </div>
            {profiles.map((p) => (
              <div key={p.user_id} className="p-4 flex flex-wrap gap-1">
                {p.tastes?.map((taste) => (
                  <span
                    key={taste}
                    className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded-md font-medium"
                  >
                    {taste}
                  </span>
                ))}
              </div>
            ))}

            {/* 5. 商用利用 */}
            <div className="p-4 bg-slate-50 font-bold text-slate-500 text-sm flex items-center">
              商用利用
            </div>
            {profiles.map((p) => (
              <div key={p.user_id} className="p-4 text-sm">
                {p.commercial_use_allowed ? (
                  <span className="text-emerald-600 font-bold flex items-center gap-1">
                    <Check size={16} /> 可能
                  </span>
                ) : (
                  <span className="text-slate-400 font-medium">要相談・不可</span>
                )}
              </div>
            ))}

            {/* 6. 代表作品プレビュー */}
            <div className="p-4 bg-slate-50 font-bold text-slate-500 text-sm flex items-center">
              代表作品
            </div>
            {profiles.map((p) => (
              <div key={p.user_id} className="p-4 grid grid-cols-2 gap-2">
                {p.portfolio_items && p.portfolio_items.length > 0 ? (
                  p.portfolio_items.slice(0, 4).map((item) => (
                    <img
                      key={item.id}
                      src={item.image_url}
                      alt={item.title || '作品'}
                      className="w-full h-20 object-cover rounded-lg border border-slate-100"
                    />
                  ))
                ) : (
                  <p className="text-xs text-slate-400 col-span-2">作品未登録</p>
                )}
              </div>
            ))}

            {/* 7. 外部依頼導線 */}
            <div className="p-4 bg-slate-50 font-bold text-slate-500 text-sm flex items-center">
              依頼相談
            </div>
            {profiles.map((p) => (
              <div key={p.user_id} className="p-4">
                {p.external_estimation_url ? (
                  <a
                    href={p.external_estimation_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-center w-full py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition"
                  >
                    外部サイトで相談
                  </a>
                ) : (
                  <Link
                    href={`/creator/${p.user_id}`}
                    className="block text-center w-full py-2.5 bg-slate-800 text-white rounded-xl text-sm font-bold hover:bg-slate-700 transition"
                  >
                    マイページから相談
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}