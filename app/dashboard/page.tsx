'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

// プリセット用のおすすめタグ一覧
const PRESET_TASTES = [
  'アイコン',
  'ヘッダー',
  'デザイン',
  '背景',
  'ペット',
  'SD・ちびキャラ',
  'ゲーム用イラスト',
  '一枚絵',
  'ロゴ',
  'VTuber向け',
  'IRIAMライバー向け',
  'パーツ分け可',
  'モデリング',
  '3D背景',
  '著作権譲渡可',
]

export default function Dashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'profile' | 'portfolio'>('profile')
  const [user, setUser] = useState<User | null>(null)

  // プロフィール用ステート
  const [displayName, setDisplayName] = useState('')
  const [status, setStatus] = useState<'available' | 'busy'>('available')
  const [statusComment, setStatusComment] = useState('')
  const [tastes, setTastes] = useState<string[]>([])
  const [customTasteInput, setCustomTasteInput] = useState('')
  const [leadTimeDays, setLeadTimeDays] = useState<number | ''>(14)
  const [commercialUseAllowed, setCommercialUseAllowed] = useState(true)
  const [priceMin, setPriceMin] = useState<number | ''>(5000)
  const [avatarUrl, setAvatarUrl] = useState('')

  // 連絡先・SNSリンク用ステート
  const [externalEstimationUrl, setExternalEstimationUrl] = useState('')
  const [twitterUrl, setTwitterUrl] = useState('')
  const [instagramUrl, setInstagramUrl] = useState('')
  const [pixivUrl, setPixivUrl] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')

  // ポートフォリオ用ステート（最大4枚のURL管理）
  const [portfolioUrls, setPortfolioUrls] = useState<string[]>(['', '', '', ''])

  useEffect(() => {
    const checkUserAndFetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setUser(user)

      // プロフィール取得（406エラー防止のため .maybeSingle() を使用）
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      if (profileError) {
        console.error('Profile fetch error:', profileError)
      }

      if (profileData) {
        setDisplayName(profileData.display_name || '')
        setStatus(profileData.status || 'available')
        setStatusComment(profileData.status_comment || '')
        setTastes(profileData.tastes || [])
        setLeadTimeDays(profileData.lead_time_days ?? 14)
        setCommercialUseAllowed(profileData.commercial_use_allowed ?? true)
        setPriceMin(profileData.price_min ?? 5000)
        setAvatarUrl(profileData.avatar_url || '')
        setExternalEstimationUrl(profileData.external_estimation_url || '')
        setTwitterUrl(profileData.twitter_url || '')
        setInstagramUrl(profileData.instagram_url || '')
        setPixivUrl(profileData.pixiv_url || '')
        setWebsiteUrl(profileData.website_url || '')
      }

      // ポートフォリオ作品取得
      const { data: portfolioData } = await supabase
        .from('portfolio_items')
        .select('image_url, sort_order')
        .eq('user_id', user.id)
        .order('sort_order', { ascending: true })

      if (portfolioData && portfolioData.length > 0) {
        const urls = ['', '', '', '']
        portfolioData.forEach((item) => {
          if (item.sort_order < 4) {
            urls[item.sort_order] = item.image_url
          }
        })
        setPortfolioUrls(urls)
      }

      setLoading(false)
    }

    checkUserAndFetchData()
  }, [router])

  // プリセットタグのON/OFF切り替え
  const togglePresetTaste = (tag: string) => {
    setTastes((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  // 自由入力タグの追加
  const handleAddCustomTaste = () => {
    const trimmed = customTasteInput.trim()
    if (!trimmed) return
    if (!tastes.includes(trimmed)) {
      setTastes((prev) => [...prev, trimmed])
    }
    setCustomTasteInput('')
  }

  // タグの削除
  const handleRemoveTaste = (tagToRemove: string) => {
    setTastes((prev) => prev.filter((t) => t !== tagToRemove))
  }

  // プロフィール保存
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setSaving(true)

    // {} や NaN、空文字などを確実に排除して数値またはnullに変換する関数
    const safeParseInt = (val: unknown, defaultValue: number | null = null): number | null => {
      if (typeof val === 'number') return isNaN(val) ? defaultValue : val
      if (typeof val === 'string' && val.trim() !== '') {
        const parsed = parseInt(val, 10)
        return isNaN(parsed) ? defaultValue : parsed
      }
      return defaultValue
    }

    const profileData = {
      user_id: user.id,
      display_name: displayName.trim(),
      status: status || 'available',
      status_comment: statusComment ? statusComment.trim() : null,
      tastes: Array.isArray(tastes) ? tastes : [],
      lead_time_days: safeParseInt(leadTimeDays, 14),
      commercial_use_allowed: Boolean(commercialUseAllowed),
      price_min: safeParseInt(priceMin, 5000),
      avatar_url: avatarUrl ? avatarUrl.trim() : null,
      external_estimation_url: externalEstimationUrl ? externalEstimationUrl.trim() : null,
      twitter_url: twitterUrl ? twitterUrl.trim() : null,
      instagram_url: instagramUrl ? instagramUrl.trim() : null,
      pixiv_url: pixivUrl ? pixivUrl.trim() : null,
      website_url: websiteUrl ? websiteUrl.trim() : null,
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase
      .from('profiles')
      .upsert(profileData, { onConflict: 'user_id' })

    setSaving(false)

    if (error) {
      console.error('Save error details:', error)
      alert('保存に失敗しました: ' + error.message)
    } else {
      alert('プロフィール情報を更新しました！')
    }
  }

  // ポートフォリオ保存
  const handleSavePortfolio = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setSaving(true)

    await supabase.from('portfolio_items').delete().eq('user_id', user.id)

    const itemsToInsert = portfolioUrls
      .map((url, idx) => ({
        user_id: user.id,
        image_url: url.trim(),
        sort_order: Number(idx),
      }))
      .filter((item) => item.image_url.length > 0)

    if (itemsToInsert.length > 0) {
      const { error } = await supabase.from('portfolio_items').insert(itemsToInsert)
      if (error) {
        alert('作品情報の更新に失敗しました: ' + error.message)
        setSaving(false)
        return
      }
    }

    setSaving(false)
    alert('作品ポートフォリオを更新しました！')
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50/80 flex items-center justify-center">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          設定データを読み込み中...
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50/80 text-slate-800 pb-20 font-sans antialiased selection:bg-indigo-600 selection:text-white">
      {/* ヘッダー */}
      <header className="px-6 py-4 bg-white/80 backdrop-blur-lg border-b border-slate-200/80 sticky top-0 z-30 shadow-xs">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black text-sm shadow-sm shadow-indigo-200">
              D
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-none">クリエイターダッシュボード</h1>
              <p className="text-[11px] text-slate-400 font-medium mt-0.5">掲載情報とポートフォリオの管理</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              トップへ戻る
            </Link>
            <button
              onClick={handleLogout}
              className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:underline transition-colors cursor-pointer"
            >
              ログアウト
            </button>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* タブナビゲーション */}
        <div className="flex gap-2 border-b border-slate-200/80 pb-1">
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-5 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'profile'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-500 hover:bg-slate-200/60'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            基本プロフィール & 連絡先
          </button>
          <button
            onClick={() => setActiveTab('portfolio')}
            className={`px-5 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'portfolio'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-500 hover:bg-slate-200/60'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            作品ギャラリー (最大4枚)
          </button>
        </div>

        {/* 1. 基本プロフィール編集フォーム */}
        {activeTab === 'profile' && (
          <form onSubmit={handleSaveProfile} className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 space-y-6 shadow-sm">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="font-bold text-slate-900 text-sm">基本情報の設定</h2>
              <p className="text-xs text-slate-400 mt-0.5">一覧画面および詳細画面に表示される情報です</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* クリエイター名 */}
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-bold text-slate-700">表示名 (クリエイター名) <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="例: イラスト屋 たろう"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>

              {/* 受付状況 */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">現在の受付ステータス</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as 'available' | 'busy')}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-700"
                >
                  <option value="available">即対応可</option>
                  <option value="busy">相談受付中</option>
                </select>
              </div>

              {/* 参考最低価格 */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">参考最低価格 (円)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-semibold">¥</span>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    value={priceMin}
                    onChange={(e) => setPriceMin(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                    className="w-full pl-7 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-semibold text-indigo-600"
                  />
                </div>
              </div>

              {/* 目安納期 */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">目安納期 (日数)</label>
                <input
                  type="number"
                  min="1"
                  value={leadTimeDays}
                  onChange={(e) => setLeadTimeDays(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>

              {/* 商用利用フラグ */}
              <div className="space-y-1.5 flex flex-col justify-end">
                <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 cursor-pointer hover:bg-slate-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={commercialUseAllowed}
                    onChange={(e) => setCommercialUseAllowed(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-slate-700">商用利用を可能として掲載する</span>
                </label>
              </div>

              {/* アイコンURL */}
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-bold text-slate-700">プロフィールアイコン画像URL (任意)</label>
                <input
                  type="url"
                  placeholder="https://example.com/avatar.jpg"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-300"
                />
              </div>

              {/* 自己紹介 */}
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-bold text-slate-700">自己紹介・PRコメント</label>
                <textarea
                  rows={3}
                  placeholder="作風や得意なジャンル、実績などのアピール文を入力してください"
                  value={statusComment}
                  onChange={(e) => setStatusComment(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all leading-relaxed"
                />
              </div>

              {/* 得意なテイスト・タグ設定 */}
              <div className="space-y-3 sm:col-span-2 border-t border-slate-100 pt-4">
                <label className="text-xs font-bold text-slate-700">得意なテイスト・タグ設定</label>
                
                {/* 定番タグ */}
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold text-slate-400">よく使われるタグ（タップで選択）</p>
                  <div className="flex flex-wrap gap-1.5">
                    {PRESET_TASTES.map((tag) => {
                      const isSelected = tastes.includes(tag)
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => togglePresetTaste(tag)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {isSelected ? '✓ ' : '+ '}
                          {tag}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* 自由入力タグ */}
                <div className="space-y-1.5 pt-2">
                  <p className="text-[11px] font-semibold text-slate-400">オリジナルのタグを追加</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="例: ドット絵, 和風イラスト..."
                      value={customTasteInput}
                      onChange={(e) => setCustomTasteInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleAddCustomTaste()
                        }
                      }}
                      className="flex-1 px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomTaste}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                    >
                      追加
                    </button>
                  </div>
                </div>

                {/* 選択中のタグ */}
                <div className="space-y-1.5 pt-2">
                  <p className="text-[11px] font-semibold text-slate-400">現在設定されているタグ（{tastes.length}件）</p>
                  {tastes.length === 0 ? (
                    <p className="text-xs text-slate-300 italic">タグが選択されていません</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {tastes.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-bold"
                        >
                          #{tag}
                          <button
                            type="button"
                            onClick={() => handleRemoveTaste(tag)}
                            className="hover:text-rose-600 text-slate-400 text-xs font-bold px-0.5 cursor-pointer"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* 連絡先・SNSリンク */}
            <div className="border-t border-slate-100 pt-6 space-y-4">
              <div>
                <h3 className="font-bold text-slate-900 text-xs">連絡先・SNSリンクの設定</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">詳細画面の「見積もり・相談をする」モーダルに表示されます</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-bold text-slate-700">外部見積もりフォームURL</label>
                  <input
                    type="url"
                    placeholder="https://google.form/..."
                    value={externalEstimationUrl}
                    onChange={(e) => setExternalEstimationUrl(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">𝕏 (Twitter) URL</label>
                  <input
                    type="url"
                    placeholder="https://x.com/username"
                    value={twitterUrl}
                    onChange={(e) => setTwitterUrl(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Instagram URL</label>
                  <input
                    type="url"
                    placeholder="https://instagram.com/username"
                    value={instagramUrl}
                    onChange={(e) => setInstagramUrl(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Pixiv URL</label>
                  <input
                    type="url"
                    placeholder="https://pixiv.net/users/..."
                    value={pixivUrl}
                    onChange={(e) => setPixivUrl(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">公式Webサイト URL</label>
                  <input
                    type="url"
                    placeholder="https://yourportfolio.com"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 bg-slate-900 hover:bg-indigo-600 text-white font-bold rounded-xl text-xs transition-all duration-200 shadow-sm hover:shadow-md cursor-pointer disabled:opacity-50"
            >
              {saving ? '更新処理中...' : 'プロフィールを保存'}
            </button>
          </form>
        )}

        {/* 2. ポートフォリオ作品設定フォーム */}
        {activeTab === 'portfolio' && (
          <form onSubmit={handleSavePortfolio} className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 space-y-6 shadow-sm">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="font-bold text-slate-900 text-sm">作品ギャラリー画像URLの設定</h2>
              <p className="text-xs text-slate-400 mt-0.5">※1枚目の画像がトップ画面の代表メインサムネイルとして表示されます</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {portfolioUrls.map((url, idx) => (
                <div key={idx} className="space-y-2.5 p-4 rounded-xl border border-slate-200/80 bg-slate-50/50">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-slate-700">
                      作品画像 {idx + 1} {idx === 0 && <span className="text-indigo-600 font-bold ml-1">(メイン代表画像)</span>}
                    </label>
                  </div>

                  <input
                    type="url"
                    placeholder={`https://example.com/work_${idx + 1}.png`}
                    value={url}
                    onChange={(e) => {
                      const next = [...portfolioUrls]
                      next[idx] = e.target.value
                      setPortfolioUrls(next)
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />

                  {/* プレビュー表示 */}
                  <div className="w-full aspect-[4/3] rounded-lg border border-slate-200 bg-white overflow-hidden flex items-center justify-center">
                    {url ? (
                      <img
                        src={url}
                        alt={`プレビュー ${idx + 1}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          ;(e.target as HTMLElement).style.display = 'none'
                        }}
                      />
                    ) : (
                      <span className="text-[11px] font-medium text-slate-300">プレビューなし</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 bg-slate-900 hover:bg-indigo-600 text-white font-bold rounded-xl text-xs transition-all duration-200 shadow-sm hover:shadow-md cursor-pointer disabled:opacity-50"
            >
              {saving ? '更新処理中...' : '作品ポートフォリオを保存'}
            </button>
          </form>
        )}
      </main>
    </div>
  )
}