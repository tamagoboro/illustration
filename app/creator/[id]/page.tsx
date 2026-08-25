'use client'

import { use, useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase, Profile, PortfolioItem } from '@/lib/supabase'

export default function CreatorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [works, setWorks] = useState<PortfolioItem[]>([])
  const [loading, setLoading] = useState(true)

  // お気に入り関連のステート（localStorage連動）
  const [isFavorite, setIsFavorite] = useState(false)

  // 連絡先・見積もりモーダルの開閉
  const [isContactOpen, setIsContactOpen] = useState(false)

  // ★ 1. 初回ロード時に localStorage からお気に入り状態をチェック
  useEffect(() => {
    const storedFavs = localStorage.getItem('favorite_creators')
    if (storedFavs) {
      try {
        const favArray: string[] = JSON.parse(storedFavs)
        setIsFavorite(favArray.includes(id))
      } catch (e) {
        console.error('Failed to parse favorites from localStorage', e)
      }
    }
  }, [id])

  // 2. Supabaseから該当ユーザーのプロフィール、ポートフォリオを取得
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

  // ★ 3. お気に入りのトグル処理（localStorageに保存）
  const handleToggleFavorite = () => {
    const storedFavs = localStorage.getItem('favorite_creators')
    let favArray: string[] = storedFavs ? JSON.parse(storedFavs) : []

    if (favArray.includes(id)) {
      favArray = favArray.filter((favId) => favId !== id)
      setIsFavorite(false)
    } else {
      favArray.push(id)
      setIsFavorite(true)
    }

    localStorage.setItem('favorite_creators', JSON.stringify(favArray))
  }

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

  // SNSまたは連絡先リンクが1つでも登録されているか判定
  const hasContactLinks = 
    profile.external_estimation_url || 
    profile.twitter_url || 
    profile.instagram_url || 
    profile.pixiv_url || 
    profile.website_url;

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

            {/* お気に入り追加・解除ボタン */}
            <button
              onClick={handleToggleFavorite}
              className={`px-6 py-2.5 text-xs font-bold rounded-xl border transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer ${
                isFavorite
                  ? 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span className="text-sm">{isFavorite ? '❤️' : '🤍'}</span>
              <span>{isFavorite ? 'お気に入り済み' : 'お気に入りに追加'}</span>
            </button>

            <button
              onClick={() => setIsContactOpen(true)}
              className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition text-center shadow-sm text-sm cursor-pointer"
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
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 text-xl font-bold cursor-pointer"
            >
              ✕
            </button>

            <div className="text-center space-y-1">
              <h3 className="text-xl font-bold text-slate-900">{profile.display_name} へ相談・見積もり</h3>
              <p className="text-xs text-slate-500">ご希望の連絡方法をお選びください</p>
            </div>

            <div className="space-y-2.5 pt-2 max-h-[60vh] overflow-y-auto">
              {profile.external_estimation_url && (
                <a
                  href={profile.external_estimation_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 px-4 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition flex items-center justify-between text-sm shadow-sm"
                >
                  <span className="flex items-center gap-2">📋 外部見積もりフォーム</span>
                  <span className="text-xs text-indigo-200">開く ↗</span>
                </a>
              )}

              {profile.twitter_url && (
                <a
                  href={profile.twitter_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 px-4 bg-slate-900 text-white font-semibold rounded-xl hover:bg-slate-800 transition flex items-center justify-between text-sm shadow-sm"
                >
                  <span className="flex items-center gap-2">𝕏 (Twitter) で相談・DM</span>
                  <span className="text-xs text-slate-400">開く ↗</span>
                </a>
              )}

              {profile.instagram_url && (
                <a
                  href={profile.instagram_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-pink-500 text-white font-semibold rounded-xl hover:opacity-95 transition flex items-center justify-between text-sm shadow-sm"
                >
                  <span className="flex items-center gap-2">📸 Instagram で相談・DM</span>
                  <span className="text-xs text-pink-200">開く ↗</span>
                </a>
              )}

              {profile.pixiv_url && (
                <a
                  href={profile.pixiv_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 px-4 bg-blue-500 text-white font-semibold rounded-xl hover:bg-blue-600 transition flex items-center justify-between text-sm shadow-sm"
                >
                  <span className="flex items-center gap-2">🎨 Pixiv メッセージ</span>
                  <span className="text-xs text-blue-200">開く ↗</span>
                </a>
              )}

              {profile.website_url && (
                <a
                  href={profile.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 px-4 bg-slate-100 text-slate-800 border border-slate-200 font-semibold rounded-xl hover:bg-slate-200 transition flex items-center justify-between text-sm shadow-sm"
                >
                  <span className="flex items-center gap-2">🌐 公式Webサイト</span>
                  <span className="text-xs text-slate-500">開く ↗</span>
                </a>
              )}

              {!hasContactLinks && (
                <div className="text-center py-6 text-xs text-slate-400">
                  連絡先・SNSリンクがまだ登録されていません
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