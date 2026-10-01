'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { backgroundImageStyle } from '@/lib/background'
import { convertToWebp } from '@/lib/imageUtils'
import SimpleHeader from '@/components/SimpleHeader'
import {
  BACKGROUND_PRESETS,
  DEFAULT_BACKGROUND,
  MAX_PORTFOLIO_VIDEOS,
  PageBackground,
  PortfolioVideo,
  backgroundStyle,
  normalizeBackground,
  normalizeVideos,
  parseYouTubeId,
} from '@/lib/portfolioDesign'

// ポートフォリオページのデザイン設定（背景・カバー画像・YouTube動画）
export default function PageDesignSettings() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [background, setBackground] = useState<PageBackground>(DEFAULT_BACKGROUND)
  const [coverUrl, setCoverUrl] = useState<string | null>(null)
  const [videos, setVideos] = useState<PortfolioVideo[]>([])
  const [videoInput, setVideoInput] = useState('')
  const [videoTitle, setVideoTitle] = useState('')
  const [videoError, setVideoError] = useState('')
  const [uploading, setUploading] = useState<'background' | 'cover' | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        router.push('/login')
        return
      }
      setUserId(data.user.id)
      const { data: profile } = await supabase
        .from('profiles')
        .select('page_background, cover_image_url, portfolio_videos')
        .eq('user_id', data.user.id)
        .maybeSingle()
      if (profile) {
        setBackground(normalizeBackground(profile.page_background))
        setCoverUrl(profile.cover_image_url || null)
        setVideos(normalizeVideos(profile.portfolio_videos))
      }
      setLoading(false)
    })
  }, [router])

  const uploadImage = async (file: File, kind: 'background' | 'cover') => {
    if (!userId) return null
    setUploading(kind)
    try {
      const webp = await convertToWebp(file, 0.85, kind === 'background' ? 2400 : 2000)
      const path = `${userId}/${kind}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.webp`
      const { data, error } = await supabase.storage.from('portfolios').upload(path, webp, { contentType: 'image/webp' })
      if (error) throw error
      return supabase.storage.from('portfolios').getPublicUrl(data.path).data.publicUrl
    } catch (e) {
      console.error('画像のアップロードエラー:', e)
      setMessage({ kind: 'error', text: '画像のアップロードに失敗しました。' })
      return null
    } finally {
      setUploading(null)
    }
  }

  const addVideo = () => {
    setVideoError('')
    const youtubeId = parseYouTubeId(videoInput)
    if (!youtubeId) return setVideoError('YouTubeの動画URLを貼り付けてください（例：https://www.youtube.com/watch?v=...）')
    if (videos.some((v) => v.youtubeId === youtubeId)) return setVideoError('この動画はすでに追加されています')
    if (videos.length >= MAX_PORTFOLIO_VIDEOS) return setVideoError(`動画は最大${MAX_PORTFOLIO_VIDEOS}本までです`)
    setVideos([...videos, { youtubeId, title: videoTitle.trim() }])
    setVideoInput('')
    setVideoTitle('')
  }

  const moveVideo = (index: number, dir: -1 | 1) => {
    const next = [...videos]
    const target = index + dir
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    setVideos(next)
  }

  const handleSave = async () => {
    if (!userId) return
    setSaving(true)
    setMessage(null)
    const { error } = await supabase
      .from('profiles')
      .update({ page_background: background, cover_image_url: coverUrl, portfolio_videos: videos })
      .eq('user_id', userId)
    setSaving(false)
    if (error) {
      console.error('デザイン設定の保存エラー:', error)
      setMessage({ kind: 'error', text: `保存に失敗しました（${error.message}）` })
      return
    }
    setMessage({ kind: 'ok', text: '保存しました！ポートフォリオページで確認してみましょう。' })
  }

  const previewStyle = backgroundStyle(background)

  return (
    <div className="min-h-screen pb-28 relative bg-cover bg-center" style={backgroundImageStyle}>
      <div className="absolute inset-0 bg-gradient-to-b from-sky-400/20 via-sky-100/10 to-sky-900/20 backdrop-blur-[2px] pointer-events-none -z-10" />
      <SimpleHeader label="ページのデザイン" />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-8 space-y-5">
        <div>
          <Link href="/dashboard" className="text-[11px] font-bold text-sky-700 hover:underline drop-shadow-xs">
            ← ダッシュボードに戻る
          </Link>
          <h1 className="text-2xl font-black text-slate-800 drop-shadow-sm mt-1">🎨 ページのデザイン</h1>
          <p className="text-xs text-slate-600 font-medium drop-shadow-xs">
            背景・カバー画像・動画を設定して、あなたらしいポートフォリオにしましょう。
          </p>
        </div>

        {loading ? (
          <p className="text-center text-xs font-bold text-slate-500 py-16">読み込み中...</p>
        ) : (
          <>
            {/* プレビュー */}
            <section className="rounded-3xl overflow-hidden border-2 border-white shadow-lg">
              <div className="relative h-56 sm:h-64 p-4 flex flex-col justify-end" style={previewStyle}>
                {coverUrl && (
                  <img src={coverUrl} alt="" className="absolute top-4 left-4 right-4 h-24 sm:h-28 w-[calc(100%-2rem)] object-cover rounded-2xl shadow-md" />
                )}
                <div className="relative bg-white/85 backdrop-blur rounded-2xl p-3 shadow-md mx-4 space-y-1.5">
                  <div className="h-3 w-24 rounded-full bg-slate-300" />
                  <div className="h-2 w-40 rounded-full bg-slate-200" />
                  <div className="h-2 w-32 rounded-full bg-slate-200" />
                </div>
              </div>
              <p className="text-[10px] font-bold text-slate-500 bg-white/90 px-4 py-2">プレビュー（実際のページとは細部が異なります）</p>
            </section>

            {/* 背景 */}
            <section className="bg-white/95 rounded-3xl p-6 border border-white/70 shadow-sm space-y-4">
              <h2 className="text-sm font-black text-slate-800">背景</h2>

              <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                {BACKGROUND_PRESETS.map((preset) => {
                  const selected = background.type === 'preset' && background.value === preset.key
                  return (
                    <button
                      key={preset.key}
                      type="button"
                      onClick={() => setBackground({ ...background, type: 'preset', value: preset.key })}
                      className={`space-y-1 cursor-pointer ${selected ? '' : 'opacity-80 hover:opacity-100'}`}
                    >
                      <span
                        className={`block aspect-square rounded-xl border-2 ${selected ? 'border-sky-500 ring-2 ring-sky-300' : 'border-white shadow-sm'}`}
                        style={backgroundStyle({ type: 'preset', value: preset.key, overlay: 0 })}
                      />
                      <span className="block text-[10px] font-bold text-slate-600">{preset.label}</span>
                    </button>
                  )
                })}
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <label
                  className={`flex items-center gap-3 p-3 rounded-2xl border-2 cursor-pointer ${
                    background.type === 'color' ? 'border-sky-500 bg-sky-50/50' : 'border-slate-100'
                  }`}
                >
                  <input
                    type="color"
                    value={background.type === 'color' ? background.value : '#e0f2fe'}
                    onChange={(e) => setBackground({ ...background, type: 'color', value: e.target.value })}
                    className="w-10 h-10 rounded-lg cursor-pointer border-0 p-0"
                  />
                  <span className="text-xs font-bold text-slate-700">好きな色を選ぶ</span>
                </label>

                <label
                  className={`flex items-center gap-3 p-3 rounded-2xl border-2 cursor-pointer ${
                    background.type === 'image' ? 'border-sky-500 bg-sky-50/50' : 'border-slate-100'
                  }`}
                >
                  <span
                    className="w-10 h-10 rounded-lg bg-slate-100 bg-cover bg-center flex items-center justify-center text-lg shrink-0"
                    style={background.type === 'image' ? { backgroundImage: `url("${background.value}")` } : undefined}
                  >
                    {background.type === 'image' ? '' : '🖼'}
                  </span>
                  <span className="text-xs font-bold text-slate-700">
                    {uploading === 'background' ? 'アップロード中...' : '画像をアップロード'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0]
                      e.target.value = ''
                      if (!file) return
                      const url = await uploadImage(file, 'background')
                      if (url) setBackground({ type: 'image', value: url, overlay: Math.max(background.overlay ?? 0, 20) })
                    }}
                  />
                </label>
              </div>

              <label className="block space-y-1.5">
                <span className="flex justify-between text-xs font-bold text-slate-700">
                  <span>白いベールの濃さ（背景が派手なときに文字を読みやすくする）</span>
                  <span className="text-sky-600">{background.overlay ?? 0}%</span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={80}
                  step={5}
                  value={background.overlay ?? 0}
                  onChange={(e) => setBackground({ ...background, overlay: Number(e.target.value) })}
                  className="w-full accent-sky-500"
                />
              </label>
            </section>

            {/* カバー画像 */}
            <section className="bg-white/95 rounded-3xl p-6 border border-white/70 shadow-sm space-y-3">
              <div>
                <h2 className="text-sm font-black text-slate-800">カバー画像</h2>
                <p className="text-[11px] text-slate-500">
                  ページの一番上に大きく表示されます（横長がおすすめ・例 1500×500）。未設定なら、1枚目の作品をぼかして表示します。
                </p>
              </div>
              {coverUrl && <img src={coverUrl} alt="" className="w-full h-36 sm:h-44 object-cover rounded-2xl" />}
              <div className="flex gap-2">
                <label className="px-4 py-2 rounded-full bg-sky-50 text-sky-700 hover:bg-sky-100 text-xs font-bold cursor-pointer">
                  {uploading === 'cover' ? 'アップロード中...' : coverUrl ? '画像を変更' : '画像をアップロード'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0]
                      e.target.value = ''
                      if (!file) return
                      const url = await uploadImage(file, 'cover')
                      if (url) setCoverUrl(url)
                    }}
                  />
                </label>
                {coverUrl && (
                  <button
                    onClick={() => setCoverUrl(null)}
                    className="px-4 py-2 rounded-full text-rose-500 hover:bg-rose-50 text-xs font-bold cursor-pointer"
                  >
                    外す
                  </button>
                )}
              </div>
            </section>

            {/* 動画 */}
            <section className="bg-white/95 rounded-3xl p-6 border border-white/70 shadow-sm space-y-4">
              <div>
                <h2 className="text-sm font-black text-slate-800">YouTube動画（最大{MAX_PORTFOLIO_VIDEOS}本）</h2>
                <p className="text-[11px] text-slate-500">
                  メイキング・タイムラプス・MVなどを、ポートフォリオ作品の下に表示できます。
                </p>
              </div>

              {videos.length > 0 && (
                <div className="space-y-2">
                  {videos.map((v, i) => (
                    <div key={v.youtubeId} className="flex items-center gap-3 p-2 rounded-2xl bg-slate-50">
                      <img src={`https://i.ytimg.com/vi/${v.youtubeId}/mqdefault.jpg`} alt="" className="w-28 aspect-video object-cover rounded-xl shrink-0" />
                      <input
                        value={v.title || ''}
                        placeholder="タイトル（任意）"
                        maxLength={60}
                        onChange={(e) => setVideos(videos.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
                        className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-slate-200 text-xs"
                      />
                      <div className="flex flex-col sm:flex-row gap-1 shrink-0">
                        <button onClick={() => moveVideo(i, -1)} disabled={i === 0} className="w-7 h-7 rounded-lg bg-white text-xs disabled:opacity-30 cursor-pointer" aria-label="上へ">
                          ↑
                        </button>
                        <button onClick={() => moveVideo(i, 1)} disabled={i === videos.length - 1} className="w-7 h-7 rounded-lg bg-white text-xs disabled:opacity-30 cursor-pointer" aria-label="下へ">
                          ↓
                        </button>
                        <button onClick={() => setVideos(videos.filter((_, j) => j !== i))} className="w-7 h-7 rounded-lg bg-white text-rose-500 text-xs cursor-pointer" aria-label="削除">
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {videos.length < MAX_PORTFOLIO_VIDEOS && (
                <div className="space-y-2">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      value={videoInput}
                      onChange={(e) => setVideoInput(e.target.value)}
                      placeholder="https://www.youtube.com/watch?v=..."
                      className="flex-1 min-w-0 px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
                    />
                    <input
                      value={videoTitle}
                      onChange={(e) => setVideoTitle(e.target.value)}
                      placeholder="タイトル（任意）"
                      maxLength={60}
                      className="sm:w-44 px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
                    />
                    <button
                      onClick={addVideo}
                      disabled={!videoInput.trim()}
                      className="px-5 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-black disabled:opacity-40 cursor-pointer"
                    >
                      追加
                    </button>
                  </div>
                  {videoError && <p className="text-xs font-bold text-rose-500">{videoError}</p>}
                  <p className="text-[10px] text-slate-400">通常の動画・ショート動画・ライブ配信のアーカイブのURLに対応しています。</p>
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {/* 保存バー */}
      {!loading && (
        <div className="fixed bottom-0 inset-x-0 z-40 bg-white/90 backdrop-blur-md border-t border-slate-100 px-4 py-3">
          <div className="max-w-3xl mx-auto flex flex-wrap items-center justify-between gap-3">
            <p className={`text-xs font-bold ${message?.kind === 'error' ? 'text-rose-500' : 'text-emerald-600'}`}>{message?.text}</p>
            <div className="flex gap-2 ml-auto">
              {userId && (
                <Link
                  href={`/creator/${userId}`}
                  className="px-5 py-2.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
                >
                  ページを見る
                </Link>
              )}
              <button
                onClick={handleSave}
                disabled={saving || uploading !== null}
                className="px-6 py-2.5 rounded-full bg-sky-500 hover:bg-sky-600 text-white text-xs font-black shadow-sm disabled:opacity-50 cursor-pointer"
              >
                {saving ? '保存中...' : '保存する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
