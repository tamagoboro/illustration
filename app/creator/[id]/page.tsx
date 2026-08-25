'use client'

import { use, useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase, Profile, PortfolioItem } from '@/lib/supabase'

export default function CreatorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [works, setWorks] = useState<PortfolioItem[]>([])
  const [loading, setLoading] = useState(true)

  // 連絡先・見積もりモーダルの開閉
  const [isContactOpen, setIsContactOpen] = useState(false)

  // 1. Supabaseから該当ユーザーのプロフィールとポートフォリオを取得
  useEffect(() => {
    const fetchCreatorData = async () => {
      setLoading(true)

      // プロフィール取得
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', id)
        .single()

      if (profileError) {
        console.error('プロフィールの取得に失敗:', profileError)
      } else {
        setProfile(profileData)
      }

      // ポートフォリオ一覧取得
      const { data: worksData, error: worksError } = await supabase
        .from('portfolio_items')
        .select('*')
        .eq('user_id', id)
        .order('sort_order', { ascending: true })

      if (worksError) {
        console.error('作品一覧の取得に失敗:', worksError)
      } else {
        setWorks(worksData || [])
      }

      setLoading(false)
    }

    fetchCreatorData()
  }, [id])

  if (loading) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-400">読み込み中...</div>
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center space-y-4">
        <p className="text-slate-500">該当するクリエイターが見つかりませんでした。</p>
        <Link href="/" className="text-indigo-600 font-semibold underline text-sm">
          ← 検索結果に戻る
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-16">
      {/* ナビバー */}
      <header className="px-8 py-4 bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <Link href="/" className="text-sm font-semibold text-indigo-600 hover:underline">
            ← 検索結果に戻る
          </Link>
          <span className="text-sm text-slate-500">クリエイター詳細</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {/* プロフィールヘッダー */}
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900">{profile.display_name}</h1>
              <span
                className={`text-xs px-3 py-1 rounded-full font-medium ${
                  profile.status === 'available'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-amber-100 text-amber-700'
                }`}
              >
                {profile.status === 'available' ? '即対応可' : profile.status}
              </span>
            </div>
            <p className="text-slate-600 max-w-xl">
              {profile.status_comment || 'プロフィールコメントはありません。'}
            </p>
            <div className="flex flex-wrap gap-2">
              {profile.tastes?.map((t) => (
                <span key={t} className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md">
                  #{t}
                </span>
              ))}
            </div>
          </div>

          <div className="w-full md:w-auto flex flex-col items-stretch gap-3 bg-slate-50 p-5 rounded-xl border border-slate-100">
            <div className="text-xs text-slate-500 space-y-1">
              <div>納期目安: <span className="font-bold text-slate-800">{profile.lead_time_days}日以内</span></div>
              <div>商用利用: <span className="font-bold text-slate-800">{profile.commercial_use_allowed ? '可' : '不可'}</span></div>
            </div>
            <button
              onClick={() => setIsContactOpen(true)}
              className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition text-center shadow-sm text-sm"
            >
              見積もり・相談をする
            </button>
          </div>
        </div>

        {/* ポートフォリオギャラリー */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-slate-900">ポートフォリオ</h2>
          {works.length === 0 ? (
            <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-xs text-slate-400">
              まだ作品が登録されていません
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {works.map((work) => (
                <div
                  key={work.id}
                  className="h-48 bg-slate-200 rounded-xl overflow-hidden shadow-sm hover:opacity-95 transition border border-slate-100"
                >
                  <img
                    src={work.image_url}
                    alt={work.title || ''}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* 相談・見積もりリンクモーダル */}
      {isContactOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl relative space-y-5">
            <button
              onClick={() => setIsContactOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 text-xl font-bold"
            >
              ✕
            </button>

            <div className="text-center space-y-1">
              <h3 className="text-xl font-bold text-slate-900">{profile.display_name} へ相談・見積もり</h3>
              <p className="text-xs text-slate-500">指定の外部サービス・連絡先を開きます</p>
            </div>

            <div className="space-y-2.5 pt-2">
              {profile.external_estimation_url ? (
                <a
                  href={profile.external_estimation_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 px-4 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition flex items-center justify-between text-sm shadow-sm"
                >
                  <span className="flex items-center gap-2">連絡先・見積もりフォームを開く</span>
                  <span className="text-xs text-indigo-200">外部サイト ↗</span>
                </a>
              ) : (
                <div className="text-center py-4 text-xs text-slate-400">
                  連絡先URLがまだ登録されていません
                </div>
              )}
            </div>

            <p className="text-[11px] text-slate-400 text-center">
              ※ クリックすると新しいタブで対象のWebページまたはSNSが開きます。
            </p>
          </div>
        </div>
      )}
    </div>
  )
}