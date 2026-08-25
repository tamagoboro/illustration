'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function Dashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'profile' | 'portfolio'>('profile')
  const [user, setUser] = useState<any>(null)

  // プロフィール用ステート
  const [displayName, setDisplayName] = useState('')
  const [status, setStatus] = useState<'available' | 'busy'>('available')
  const [statusComment, setStatusComment] = useState('')
  const [tastesText, setTastesText] = useState('')
  const [leadTimeDays, setLeadTimeDays] = useState(14)
  const [commercialUseAllowed, setCommercialUseAllowed] = useState(true)
  const [priceMin, setPriceMin] = useState(5000)
  const [avatarUrl, setAvatarUrl] = useState('')

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

      // プロフィール取得
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (profileData) {
        setDisplayName(profileData.display_name || '')
        setStatus(profileData.status || 'available')
        setStatusComment(profileData.status_comment || '')
        setTastesText(profileData.tastes ? profileData.tastes.join(', ') : '')
        setLeadTimeDays(profileData.lead_time_days || 14)
        setCommercialUseAllowed(profileData.commercial_use_allowed ?? true)
        setPriceMin(profileData.price_min ?? 5000)
        setAvatarUrl(profileData.avatar_url || '')
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

  // プロフィール保存
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setSaving(true)

    const tastesArray = tastesText
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0)

    const profileData = {
      user_id: user.id,
      display_name: displayName,
      status,
      status_comment: statusComment,
      tastes: tastesArray,
      lead_time_days: Number(leadTimeDays),
      commercial_use_allowed: commercialUseAllowed,
      price_min: Number(priceMin),
      avatar_url: avatarUrl || null,
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase
      .from('profiles')
      .upsert(profileData, { onConflict: 'user_id' })

    setSaving(false)

    if (error) {
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

    // 既存削除して再登録
    await supabase.from('portfolio_items').delete().eq('user_id', user.id)

    const itemsToInsert = portfolioUrls
      .map((url, idx) => ({
        user_id: user.id,
        image_url: url.trim(),
        sort_order: idx,
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
              className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:underline transition-colors"
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
            className={`px-5 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${
              activeTab === 'profile'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-500 hover:bg-slate-200/60'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            基本プロフィール
          </button>
          <button
            onClick={() => setActiveTab('portfolio')}
            className={`px-5 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${
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
                  onChange={(e) => setStatus(e.target.value as any)}
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
                    onChange={(e) => setPriceMin(Number(e.target.value))}
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
                  onChange={(e) => setLeadTimeDays(Number(e.target.value))}
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
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
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

              {/* タグ設定 */}
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-bold text-slate-700">得意なテイスト・タグ (カンマ区切り)</label>
                <input
                  type="text"
                  placeholder="アイコン, キャラクター, 水彩風, ゲーム用イラスト"
                  value={tastesText}
                  onChange={(e) => setTastesText(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 bg-slate-900 hover:bg-indigo-600 text-white font-bold rounded-xl text-xs transition-all duration-200 shadow-sm hover:shadow-md"
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
                      <img src={url} alt={`プレビュー ${idx + 1}`} className="w-full h-full object-cover" />
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
              className="w-full py-3 bg-slate-900 hover:bg-indigo-600 text-white font-bold rounded-xl text-xs transition-all duration-200 shadow-sm hover:shadow-md"
            >
              {saving ? '更新処理中...' : '作品ポートフォリオを保存'}
            </button>
          </form>
        )}
      </main>
    </div>
  )
}