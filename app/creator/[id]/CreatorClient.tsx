'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase, Profile, PortfolioItem } from '@/lib/supabase'

type MenuItem = {
  title: string
  price: number | ''
}

type ExtendedProfile = Profile & {
  menu_items?: MenuItem[]
  price_min?: number | null
  ai_usage?: string | null
  free_revision_count?: number | null
  express_option_available?: boolean | null
  copyright_transfer_available?: boolean | null
  ai_learning_allowed?: boolean | null
  r18_allowed?: boolean | null
}

export default function CreatorClient({ id }: { id: string }) {
  const [profile, setProfile] = useState<ExtendedProfile | null>(null)
  const [works, setWorks] = useState<PortfolioItem[]>([])
  const [loading, setLoading] = useState(true)
  const [isFavorite, setIsFavorite] = useState(false)
  const [isContactOpen, setIsContactOpen] = useState(false)

  useEffect(() => {
    const storedFavs = localStorage.getItem('favorite_creators')
    if (storedFavs) {
      try {
        const favArray: string[] = JSON.parse(storedFavs)
        setIsFavorite(favArray.includes(id))
      } catch (e) {
        console.error('Failed to parse favorites', e)
      }
    }
  }, [id])

  useEffect(() => {
    const fetchCreatorData = async () => {
      setLoading(true)

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', id)
        .single()

      if (profileData) setProfile(profileData as ExtendedProfile)

      const { data: worksData } = await supabase
        .from('portfolio_items')
        .select('*')
        .eq('user_id', id)
        .order('sort_order', { ascending: true })

      if (worksData) setWorks(worksData)

      setLoading(false)
    }

    fetchCreatorData()
  }, [id])

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
    return (
      <div className="min-h-screen bg-slate-50/50 flex flex-col items-center justify-center space-y-3">
        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-bold text-slate-400 tracking-wider uppercase">Loading Creator Profile...</p>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center space-y-4">
        <div className="p-4 bg-white rounded-2xl shadow-xs border border-slate-200/80 text-center space-y-2">
          <p className="text-slate-600 font-bold text-sm">該当するクリエイターが見つかりませんでした。</p>
          <Link href="/" className="text-indigo-600 hover:text-indigo-700 font-semibold text-xs inline-flex items-center gap-1">
            ← 検索結果に戻る
          </Link>
        </div>
      </div>
    )
  }

  const hasContactLinks =
    profile.external_estimation_url ||
    profile.twitter_url ||
    profile.instagram_url ||
    profile.pixiv_url ||
    profile.website_url

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100/60 via-slate-50 to-slate-100/40 text-slate-800 pb-28">
      {/* ナビバー */}
      <header className="px-6 py-3.5 bg-white/80 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30 shadow-xs">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <Link
            href="/"
            className="text-xs font-bold text-slate-500 hover:text-indigo-600 transition-colors flex items-center gap-1.5"
          >
            <span>←</span> 検索結果へ戻る
          </Link>
          <span className="text-xs font-extrabold tracking-wider text-slate-400 uppercase">Creator Profile</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* 1. ヒーロープロフィールカード */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/80 space-y-6">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            
            {/* メインプロフィール左側 */}
            <div className="flex-1 space-y-4">
              <div className="flex items-start gap-4 sm:gap-5">
                {profile.avatar_url && (
                  <div className="relative group shrink-0">
                    <img
                      src={profile.avatar_url}
                      alt={profile.display_name}
                      className="w-20 h-20 sm:w-22 sm:h-22 rounded-2xl object-cover ring-4 ring-indigo-50 shadow-sm"
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                      {profile.display_name}
                    </h1>
                    
                    {/* ステータスバッジ */}
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border ${
                        profile.status === 'available'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
                          : 'bg-amber-50 text-amber-700 border-amber-200/80'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${profile.status === 'available' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                      {profile.status === 'available' ? '即対応可' : '相談受付中'}
                    </span>
                  </div>

                  {/* 特徴バッジ */}
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {profile.ai_usage === 'none' && (
                      <span className="text-[11px] bg-gradient-to-r from-indigo-50 to-blue-50 text-indigo-700 font-bold px-3 py-0.5 rounded-full border border-indigo-100 shadow-xs">
                        ✦ 完全手描き
                      </span>
                    )}
                    {profile.r18_allowed && (
                      <span className="text-[11px] bg-rose-50 text-rose-700 font-bold px-3 py-0.5 rounded-full border border-rose-100">
                        R-18 OK
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* 自己紹介文 */}
              <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap bg-slate-50/80 p-4 sm:p-5 rounded-2xl border border-slate-100 text-justify">
                {profile.status_comment || 'プロフィールコメントはありません。'}
              </p>

              {/* タグ */}
              <div className="flex flex-wrap gap-1.5">
                {profile.tastes?.map((t) => (
                  <span
                    key={t}
                    className="text-xs bg-slate-100 hover:bg-slate-200/70 text-slate-600 px-3 py-1 rounded-lg font-medium transition"
                  >
                    #{t}
                  </span>
                ))}
              </div>
            </div>

            {/* サイド目安・アクションボックス */}
            <div className="w-full lg:w-80 bg-gradient-to-b from-slate-50 to-slate-100/50 p-5 rounded-2xl border border-slate-200/80 space-y-4 shrink-0">
              <div className="space-y-2.5 text-xs text-slate-600 pb-2">
                {profile.price_min != null && (
                  <div className="flex justify-between items-baseline bg-white p-3 rounded-xl border border-slate-200/60 shadow-2xs">
                    <span className="font-medium text-slate-500">最低参考価格</span>
                    <span className="font-black text-indigo-600 text-lg">
                      ¥{profile.price_min.toLocaleString()}〜
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center px-1">
                  <span>目安納期</span>
                  <span className="font-bold text-slate-900">
                    {profile.lead_time_days ? `${profile.lead_time_days} 日以内` : '要相談'}
                  </span>
                </div>
                <div className="flex justify-between items-center px-1">
                  <span>商用利用</span>
                  <span className="font-bold text-slate-900">
                    {profile.commercial_use_allowed ? '可能' : '不可'}
                  </span>
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <button
                  onClick={() => setIsContactOpen(true)}
                  className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white font-extrabold rounded-xl transition-all shadow-md shadow-indigo-200 text-sm cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>✉️</span> 見積もり・相談をする
                </button>

                <button
                  onClick={handleToggleFavorite}
                  className={`w-full py-2.5 text-xs font-bold rounded-xl border transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    isFavorite
                      ? 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100/80'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs'
                  }`}
                >
                  <span>{isFavorite ? '❤️' : '🤍'}</span>
                  <span>{isFavorite ? 'お気に入り登録済み' : 'お気に入りに追加'}</span>
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* 2. 制作・受付条件スペック */}
        <section className="bg-white p-6 sm:p-7 rounded-3xl shadow-sm border border-slate-200/80 space-y-5">
          <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <span className="p-1.5 bg-slate-100 rounded-lg text-xs">⚙️</span> 制作・受付条件
          </h2>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              {
                label: '生成AIの使用',
                value: profile.ai_usage === 'none' ? '完全手描き（未使用）' : profile.ai_usage === 'partial' ? '一部AI補助あり' : profile.ai_usage === 'main' ? 'AIメイン制作' : '未指定',
                highlight: profile.ai_usage === 'none',
              },
              {
                label: 'R-18（成人向け）',
                value: profile.r18_allowed ? '対応可能' : '不可',
                highlight: profile.r18_allowed,
              },
              {
                label: '無料リテイク',
                value: typeof profile.free_revision_count === 'number' ? `${profile.free_revision_count} 回まで無料` : '要相談',
                highlight: false,
              },
              {
                label: '急ぎ・特急対応',
                value: profile.express_option_available ? '対応可能' : '不可',
                highlight: profile.express_option_available,
              },
              {
                label: '著作権譲渡',
                value: profile.copyright_transfer_available ? '相談・譲渡可能' : '不可',
                highlight: profile.copyright_transfer_available,
              },
              {
                label: 'AI学習の許可',
                value: profile.ai_learning_allowed ? '許可' : '禁止（不可）',
                highlight: !profile.ai_learning_allowed,
              },
            ].map((spec, i) => (
              <div key={i} className="p-3.5 bg-slate-50/70 rounded-2xl border border-slate-100 space-y-1">
                <span className="text-[11px] font-medium text-slate-400 block">{spec.label}</span>
                <span className={`text-xs font-bold block ${spec.highlight ? 'text-indigo-600' : 'text-slate-800'}`}>
                  {spec.value}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* 3. 料金メニュー */}
        {profile.menu_items && profile.menu_items.length > 0 && (
          <section className="bg-white p-6 sm:p-7 rounded-3xl shadow-sm border border-slate-200/80 space-y-5">
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <span className="p-1.5 bg-slate-100 rounded-lg text-xs">🏷️</span> 料金目安・メニュー
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {profile.menu_items.map((item, index) => (
                <div
                  key={index}
                  className="p-4 bg-slate-50/80 border border-slate-100 rounded-2xl flex justify-between items-center hover:bg-slate-50 transition"
                >
                  <span className="text-xs font-bold text-slate-700">{item.title}</span>
                  <span className="text-xs font-black text-indigo-600 bg-white px-2.5 py-1 rounded-lg border border-slate-200/60 shadow-2xs">
                    {typeof item.price === 'number' ? `¥${item.price.toLocaleString()}〜` : '要相談'}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 4. ポートフォリオギャラリー */}
        <section className="space-y-4">
          <div className="flex justify-between items-baseline px-1">
            <h2 className="text-base font-black text-slate-900 tracking-tight">ポートフォリオ</h2>
            <span className="text-xs font-bold text-slate-400">{works.length} 作品</span>
          </div>

          {works.length === 0 ? (
            <div className="bg-white p-12 rounded-3xl border border-slate-200/80 text-center text-xs font-medium text-slate-400">
              まだ作品が登録されていません
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {works.map((work) => (
                <div
                  key={work.id}
                  className="group relative aspect-square bg-slate-100 rounded-2xl overflow-hidden shadow-2xs border border-slate-200/60 transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
                >
                  <img
                    src={work.image_url}
                    alt={work.title || ''}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  {work.title && (
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-3 flex items-end">
                      <p className="text-xs font-bold text-white truncate">{work.title}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* 5. 相談・見積もりモーダル */}
      {isContactOpen && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 sm:p-7 w-full max-w-md shadow-2xl border border-slate-100 relative space-y-6">
            <button
              onClick={() => setIsContactOpen(false)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-100 text-slate-400 hover:text-slate-700 hover:bg-slate-200 flex items-center justify-center text-sm font-bold transition cursor-pointer"
            >
              ✕
            </button>

            <div className="space-y-1">
              <h3 className="text-lg font-black text-slate-900">{profile.display_name} へ相談・見積もり</h3>
              <p className="text-xs text-slate-500">ご希望の連絡窓口を選択してください</p>
            </div>

            <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
              {profile.external_estimation_url && (
                <a
                  href={profile.external_estimation_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl transition flex items-center justify-between text-xs shadow-xs"
                >
                  <span className="flex items-center gap-2.5">📋 外部見積もりフォーム</span>
                  <span className="text-[10px] bg-indigo-500/50 px-2 py-0.5 rounded-md">開く ↗</span>
                </a>
              )}

              {profile.twitter_url && (
                <a
                  href={profile.twitter_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl transition flex items-center justify-between text-xs shadow-xs"
                >
                  <span className="flex items-center gap-2.5">𝕏 (Twitter) で相談・DM</span>
                  <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded-md">開く ↗</span>
                </a>
              )}

              {profile.instagram_url && (
                <a
                  href={profile.instagram_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3.5 px-4 bg-gradient-to-r from-purple-600 to-pink-500 hover:opacity-95 text-white font-bold rounded-2xl transition flex items-center justify-between text-xs shadow-xs"
                >
                  <span className="flex items-center gap-2.5">📸 Instagram で相談・DM</span>
                  <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-md">開く ↗</span>
                </a>
              )}

              {profile.pixiv_url && (
                <a
                  href={profile.pixiv_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3.5 px-4 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-2xl transition flex items-center justify-between text-xs shadow-xs"
                >
                  <span className="flex items-center gap-2.5">🎨 Pixiv メッセージ</span>
                  <span className="text-[10px] bg-blue-400/50 px-2 py-0.5 rounded-md">開く ↗</span>
                </a>
              )}

              {profile.website_url && (
                <a
                  href={profile.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3.5 px-4 bg-slate-50 text-slate-800 border border-slate-200/80 font-bold rounded-2xl hover:bg-slate-100 transition flex items-center justify-between text-xs"
                >
                  <span className="flex items-center gap-2.5">🌐 公式Webサイト</span>
                  <span className="text-[10px] bg-slate-200/60 text-slate-600 px-2 py-0.5 rounded-md">開く ↗</span>
                </a>
              )}

              {!hasContactLinks && (
                <div className="text-center py-8 text-xs font-medium text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  連絡先・SNSリンクが登録されていません
                </div>
              )}
            </div>

            <p className="text-[10px] text-slate-400 text-center font-medium">
              ※ 新しいタブで外部サービスが開きます。
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
