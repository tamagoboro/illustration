'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase, Profile, PortfolioItem } from '@/lib/supabase'

type MenuItem = {
  title: string
  price: number | ''
}

// 追加フィールドを型に反映
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

  // 1. 初回ロード時に localStorage からお気に入り状態をチェック
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

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', id)
        .single()

      if (profileError) {
        console.error('プロフィールの取得に失敗:', profileError)
      } else {
        setProfile(profileData as ExtendedProfile)
      }

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

  // 3. お気に入りのトグル処理
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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-bold text-slate-400">
        読み込み中...
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center space-y-4">
        <p className="text-slate-500 font-bold">該当するクリエイターが見つかりませんでした。</p>
        <Link href="/" className="text-indigo-600 font-semibold underline text-sm">
          ← 検索結果に戻る
        </Link>
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
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-24">
      {/* ナビバー */}
      <header className="px-8 py-4 bg-white border-b border-slate-200 sticky top-0 z-10 shadow-xs">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <Link href="/" className="text-sm font-semibold text-indigo-600 hover:underline">
            ← 検索結果に戻る
          </Link>
          <span className="text-sm text-slate-500 font-medium">クリエイター詳細</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {/* 1. プロフィールヘッダー */}
        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-4 flex-1">
            <div className="flex items-start gap-4">
              {profile.avatar_url && (
                <img
                  src={profile.avatar_url}
                  alt={profile.display_name}
                  className="w-16 h-16 rounded-full object-cover border-2 border-slate-100 shadow-sm"
                />
              )}
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold text-slate-900">{profile.display_name}</h1>
                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                      profile.status === 'available'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}
                  >
                    {profile.status === 'available' ? '🟢 即対応可' : '🟡 相談受付中'}
                  </span>
                </div>

                {/* ヘッダー内バッジ配置 */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {profile.ai_usage === 'none' && (
                    <span className="text-[11px] bg-indigo-50 text-indigo-700 font-bold px-2.5 py-0.5 rounded-full border border-indigo-200">
                      ✦ 完全手描き
                    </span>
                  )}
                  {profile.r18_allowed && (
                    <span className="text-[11px] bg-rose-50 text-rose-700 font-bold px-2.5 py-0.5 rounded-full border border-rose-200">
                      R-18 OK
                    </span>
                  )}
                </div>
              </div>
            </div>

            <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap bg-slate-50/50 p-4 rounded-xl border border-slate-100">
              {profile.status_comment || 'プロフィールコメントはありません。'}
            </p>

            <div className="flex flex-wrap gap-1.5">
              {profile.tastes?.map((t) => (
                <span key={t} className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md font-medium">
                  #{t}
                </span>
              ))}
            </div>
          </div>

          {/* 簡易条件・ボタンサイドエリア */}
          <div className="w-full md:w-72 flex flex-col items-stretch gap-3 bg-slate-50 p-5 rounded-2xl border border-slate-200/60">
            <div className="text-xs text-slate-600 space-y-2 border-b border-slate-200/80 pb-3">
              {profile.price_min != null && (
                <div className="flex justify-between items-center">
                  <span>最低参考価格</span>
                  <span className="font-extrabold text-indigo-600 text-base">
                    ¥{profile.price_min.toLocaleString()}〜
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span>目安納期</span>
                <span className="font-bold text-slate-800">
                  {profile.lead_time_days ?? '-'}日以内
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>商用利用</span>
                <span className="font-bold text-slate-800">
                  {profile.commercial_use_allowed ? '可能' : '不可'}
                </span>
              </div>
            </div>

            <button
              onClick={handleToggleFavorite}
              className={`px-4 py-2.5 text-xs font-bold rounded-xl border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                isFavorite
                  ? 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span>{isFavorite ? '❤️' : '🤍'}</span>
              <span>{isFavorite ? 'お気に入り済み' : 'お気に入りに追加'}</span>
            </button>

            <button
              onClick={() => setIsContactOpen(true)}
              className="px-4 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition text-center shadow-xs text-sm cursor-pointer"
            >
              見積もり・相談をする
            </button>
          </div>
        </div>

        {/* 2. 制作・受付条件スペック詳細（新規拡充エリア） */}
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
            <span>⚙️</span> 制作・受付条件
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
            {/* 生成AIの使用 */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
              <span className="text-slate-400 font-medium block">生成AIの使用</span>
              <span className="font-bold text-indigo-600 block text-sm">
                {profile.ai_usage === 'none'
                  ? '完全手描き（未使用）'
                  : profile.ai_usage === 'partial'
                  ? '一部AI補助あり'
                  : profile.ai_usage === 'main'
                  ? 'AIメイン制作'
                  : '未指定'}
              </span>
            </div>

            {/* R-18対応 */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
              <span className="text-slate-400 font-medium block">R-18（成人向け）</span>
              <span className={`font-bold block text-sm ${profile.r18_allowed ? 'text-rose-600' : 'text-slate-600'}`}>
                {profile.r18_allowed ? '対応可能' : '不可'}
              </span>
            </div>

            {/* 無料リテイク数 */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
              <span className="text-slate-400 font-medium block">無料リテイク</span>
              <span className="font-bold text-slate-800 block text-sm">
                {typeof profile.free_revision_count === 'number'
                  ? `${profile.free_revision_count} 回まで無料`
                  : '要相談'}
              </span>
            </div>

            {/* 急ぎ対応 */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
              <span className="text-slate-400 font-medium block">急ぎ・特急対応</span>
              <span className={`font-bold block text-sm ${profile.express_option_available ? 'text-emerald-600' : 'text-slate-600'}`}>
                {profile.express_option_available ? '対応可能' : '不可'}
              </span>
            </div>

            {/* 著作権譲渡 */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
              <span className="text-slate-400 font-medium block">著作権譲渡</span>
              <span className={`font-bold block text-sm ${profile.copyright_transfer_available ? 'text-indigo-600' : 'text-slate-600'}`}>
                {profile.copyright_transfer_available ? '相談・譲渡可能' : '不可'}
              </span>
            </div>

            {/* AI学習の許可 */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
              <span className="text-slate-400 font-medium block">AI学習の許可</span>
              <span className={`font-bold block text-sm ${profile.ai_learning_allowed ? 'text-emerald-600' : 'text-rose-600'}`}>
                {profile.ai_learning_allowed ? '許可' : '禁止（不可）'}
              </span>
            </div>
          </div>
        </section>

        {/* 3. 料金メニューセクション */}
        {profile.menu_items && profile.menu_items.length > 0 && (
          <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <span>🏷️</span> 料金目安・メニュー一覧
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {profile.menu_items.map((item, index) => (
                <div
                  key={index}
                  className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl flex justify-between items-center"
                >
                  <span className="text-xs font-bold text-slate-700">{item.title}</span>
                  <span className="text-xs font-extrabold text-indigo-600">
                    {typeof item.price === 'number' ? `¥${item.price.toLocaleString()}〜` : '要相談'}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 4. ポートフォリオギャラリー */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-slate-900">ポートフォリオ</h2>
          {works.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-xs text-slate-400">
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

      {/* 5. 相談・見積もりリンクモーダル */}
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
                  className="w-full py-3 px-4 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition flex items-center justify-between text-sm shadow-xs"
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
                  className="w-full py-3 px-4 bg-slate-900 text-white font-semibold rounded-xl hover:bg-slate-800 transition flex items-center justify-between text-sm shadow-xs"
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
                  className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-pink-500 text-white font-semibold rounded-xl hover:opacity-95 transition flex items-center justify-between text-sm shadow-xs"
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
                  className="w-full py-3 px-4 bg-blue-500 text-white font-semibold rounded-xl hover:bg-blue-600 transition flex items-center justify-between text-sm shadow-xs"
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
                  className="w-full py-3 px-4 bg-slate-100 text-slate-800 border border-slate-200 font-semibold rounded-xl hover:bg-slate-200 transition flex items-center justify-between text-sm shadow-xs"
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