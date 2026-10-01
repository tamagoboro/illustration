'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { backgroundImageStyle } from '@/lib/background'
import { convertToWebp } from '@/lib/imageUtils'
import SimpleHeader from '@/components/SimpleHeader'
import SoulShareButton from '@/components/SoulShareButton'
import FlowStepsEditor from '@/components/FlowStepsEditor'
import { cleanFlowSteps } from '@/lib/flowSteps'
import {
  SoulListing,
  SoulPrice,
  COMMERCIAL_USE_LABELS,
  SOUL_STATUS_LABELS,
  MAX_SOUL_IMAGES,
  MAX_SOUL_DELIVERABLES,
  MAX_SOUL_PROFILE_ITEMS,
  MAX_SOUL_FAQS,
  DEFAULT_SOUL_FLOW,
  SoulFlowStep,
  getSoulStatus,
  formatSoulPeriod,
  formatPrice,
  normalizeSoulListing,
} from '@/lib/soulListings'

// クリエイター本人が「魂募集イラスト」を掲載・編集・削除するページ。
// 魂募集は1人1件まで（DBのユニーク制約）。1件に同じキャラクターの画像を最大4枚まで載せられ、1枚目が表紙になる。

// 画像1枚分（保存済みならurl、新しく選んだものはfile）
type ImageSlot = { url: string | null; file: File | null; preview: string }

type FormState = {
  id: string | null
  title: string
  images: ImageSlot[]
  description: string
  targetAudience: string
  prices: { label: string; price: string }[]
  commercialUse: SoulListing['commercial_use']
  startsAt: string
  endsAt: string
  isClosed: boolean
  deliverables: string[]
  characterProfile: { label: string; value: string }[]
  faqs: { q: string; a: string }[]
  flowSteps: SoulFlowStep[] // 空なら標準の流れを表示
}

// キャラクター設定表で、よく使う項目をワンタップで追加できるようにする
const PROFILE_PRESETS = ['年齢', '身長', '誕生日', '性格', '一人称', '好きなもの', '苦手なもの', 'ファンネーム']
// 納品物の例（ワンタップで追加）
const DELIVERABLE_PRESETS = ['立ち絵（PNG・透過）', '表情差分', 'Live2D用パーツ分けPSD', '高解像度データ', '配信用アイコン', 'キャラクターデザイン資料']

const emptyForm = (): FormState => ({
  id: null,
  title: '',
  images: [],
  description: '',
  targetAudience: '',
  prices: [{ label: '', price: '' }],
  commercialUse: 'allowed',
  startsAt: '',
  endsAt: '',
  isClosed: false,
  deliverables: [],
  characterProfile: [],
  faqs: [],
  flowSteps: [],
})

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-emerald-100 text-emerald-700',
  upcoming: 'bg-sky-100 text-sky-700',
  ended: 'bg-slate-200 text-slate-600',
  closed: 'bg-slate-200 text-slate-600',
}

const inputClass =
  'w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-400/40 focus:border-sky-400'

export default function DashboardSoulsPage() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [creatorName, setCreatorName] = useState('')
  const [loading, setLoading] = useState(true)
  const [listing, setListing] = useState<SoulListing | null>(null)
  const [form, setForm] = useState<FormState | null>(null)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const refresh = async (uid: string) => {
    const { data, error } = await supabase.from('soul_listings').select('*').eq('user_id', uid).limit(1)
    if (error) {
      console.error('魂募集の取得エラー:', error)
      return
    }
    setListing(data && data[0] ? normalizeSoulListing(data[0]) : null)
  }

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        router.push('/login')
        return
      }
      setUserId(data.user.id)
      const { data: profile } = await supabase.from('profiles').select('display_name').eq('user_id', data.user.id).maybeSingle()
      setCreatorName(profile?.display_name || '')
      await refresh(data.user.id)
      setLoading(false)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  const openEdit = (l: SoulListing) => {
    setErrorMessage('')
    setForm({
      id: l.id,
      title: l.title,
      images: l.image_urls.map((url) => ({ url, file: null, preview: url })),
      description: l.description,
      targetAudience: l.target_audience,
      prices: l.prices.length
        ? l.prices.map((p) => ({ label: p.label, price: p.price === null ? '' : String(p.price) }))
        : [{ label: '', price: '' }],
      commercialUse: l.commercial_use,
      startsAt: l.starts_at || '',
      endsAt: l.ends_at || '',
      isClosed: l.is_closed,
      deliverables: [...l.deliverables],
      characterProfile: l.character_profile.map((p) => ({ ...p })),
      faqs: l.faqs.map((f) => ({ ...f })),
      flowSteps: l.flow_steps.map((f) => ({ ...f })),
    })
  }

  const updateForm = (patch: Partial<FormState>) => setForm((f) => (f ? { ...f, ...patch } : f))

  const addImages = (files: FileList | null) => {
    if (!form || !files) return
    const room = MAX_SOUL_IMAGES - form.images.length
    const picked = Array.from(files).slice(0, room)
    if (files.length > room) alert(`画像は最大${MAX_SOUL_IMAGES}枚までです`)
    updateForm({
      images: [...form.images, ...picked.map((file) => ({ url: null, file, preview: URL.createObjectURL(file) }))],
    })
  }

  const removeImage = (index: number) => form && updateForm({ images: form.images.filter((_, i) => i !== index) })

  const makeCover = (index: number) => {
    if (!form || index === 0) return
    const images = [...form.images]
    const [picked] = images.splice(index, 1)
    updateForm({ images: [picked, ...images] })
  }

  const handleSave = async () => {
    if (!form || !userId) return
    setErrorMessage('')
    if (!form.title.trim()) return setErrorMessage('名前を入力してください')
    if (form.images.length === 0) return setErrorMessage('イラストを1枚以上選んでください')
    if (form.startsAt && form.endsAt && form.startsAt > form.endsAt)
      return setErrorMessage('掲載終了日は開始日より後にしてください')

    const prices: SoulPrice[] = form.prices
      .filter((p) => p.label.trim())
      .map((p) => ({ label: p.label.trim(), price: p.price.trim() === '' ? null : Number(p.price) }))
    if (prices.some((p) => p.price !== null && (!Number.isFinite(p.price) || p.price < 0)))
      return setErrorMessage('金額は0以上の数字で入力してください（空欄にすると「応相談」になります）')

    setSaving(true)
    try {
      // 新しく選んだ画像だけアップロードし、並び順（1枚目＝表紙）はそのまま保つ
      const imageUrls: string[] = []
      for (const slot of form.images) {
        if (slot.url) {
          imageUrls.push(slot.url)
          continue
        }
        const webp = await convertToWebp(slot.file!, 0.85, 1600)
        const path = `${userId}/soul_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.webp`
        const { data: uploaded, error: uploadError } = await supabase.storage
          .from('portfolios')
          .upload(path, webp, { contentType: 'image/webp' })
        if (uploadError) throw uploadError
        imageUrls.push(supabase.storage.from('portfolios').getPublicUrl(uploaded.path).data.publicUrl)
      }

      const row = {
        user_id: userId,
        title: form.title.trim(),
        image_url: imageUrls[0],
        image_urls: imageUrls,
        description: form.description.trim(),
        target_audience: form.targetAudience.trim(),
        prices,
        commercial_use: form.commercialUse,
        starts_at: form.startsAt || null,
        ends_at: form.endsAt || null,
        is_closed: form.isClosed,
        deliverables: form.deliverables.map((d) => d.trim()).filter(Boolean),
        character_profile: form.characterProfile
          .map((p) => ({ label: p.label.trim(), value: p.value.trim() }))
          .filter((p) => p.label && p.value),
        faqs: form.faqs.map((f) => ({ q: f.q.trim(), a: f.a.trim() })).filter((f) => f.q && f.a),
        flow_steps: cleanFlowSteps(form.flowSteps),
      }
      const { error } = form.id
        ? await supabase.from('soul_listings').update(row).eq('id', form.id)
        : await supabase.from('soul_listings').insert(row)
      if (error) throw error

      setForm(null)
      await refresh(userId)
    } catch (e: any) {
      console.error('魂募集の保存エラー:', e)
      setErrorMessage(
        e?.code === '23505'
          ? '魂募集は1人1件までです。今の募集を編集するか、削除してから掲載してください。'
          : '保存に失敗しました。時間をおいて再度お試しください。'
      )
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!userId || !listing || !confirm(`「${listing.title}」を削除しますか？（元に戻せません）`)) return
    const { error } = await supabase.from('soul_listings').delete().eq('id', listing.id)
    if (error) {
      alert('削除に失敗しました')
      return
    }
    await refresh(userId)
  }

  const toggleClosed = async () => {
    if (!userId || !listing) return
    const { error } = await supabase.from('soul_listings').update({ is_closed: !listing.is_closed }).eq('id', listing.id)
    if (error) {
      alert('更新に失敗しました')
      return
    }
    await refresh(userId)
  }

  const status = listing ? getSoulStatus(listing) : null

  return (
    <div className="min-h-screen pb-24 relative bg-cover bg-center" style={backgroundImageStyle}>
      <div className="absolute inset-0 bg-gradient-to-b from-sky-400/20 via-sky-100/10 to-sky-900/20 backdrop-blur-[2px] pointer-events-none -z-10" />
      <SimpleHeader label="魂募集の管理" />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-8 space-y-5">
        <div>
          <Link href="/dashboard" className="text-[11px] font-bold text-sky-700 hover:underline drop-shadow-xs">
            ← ダッシュボードに戻る
          </Link>
          <h1 className="text-2xl font-black text-slate-800 drop-shadow-sm mt-1">🎭 魂募集イラスト</h1>
          <p className="text-xs text-slate-600 font-medium drop-shadow-xs">
            キャラクターの「魂（中の人）」を募集するイラストを、ポートフォリオに掲載できます（1人1件・画像は最大{MAX_SOUL_IMAGES}枚）。
          </p>
        </div>

        {loading ? (
          <p className="text-center text-xs font-bold text-slate-500 py-16">読み込み中...</p>
        ) : !listing ? (
          <div className="bg-white/90 rounded-3xl p-10 text-center space-y-3 border border-white/70">
            <p className="text-3xl">🎭</p>
            <p className="text-sm font-black text-slate-700">まだ魂募集はありません</p>
            <button
              onClick={() => {
                setErrorMessage('')
                setForm(emptyForm())
              }}
              className="px-6 py-2.5 rounded-full bg-sky-500 hover:bg-sky-600 text-white text-xs font-black shadow-sm cursor-pointer"
            >
              ＋ 魂募集を掲載する
            </button>
          </div>
        ) : (
          <div className="bg-white/95 rounded-3xl p-5 border border-white/70 shadow-sm space-y-4">
            <div className="flex gap-2 overflow-x-auto">
              {listing.image_urls.map((url, i) => (
                <div key={url} className="relative shrink-0">
                  <img src={url} alt="" className="w-28 h-36 rounded-2xl object-cover bg-slate-100" />
                  {i === 0 && (
                    <span className="absolute top-1.5 left-1.5 text-[9px] font-black px-1.5 py-0.5 rounded-full bg-violet-500 text-white">
                      表紙
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${STATUS_STYLES[status!]}`}>
                  {SOUL_STATUS_LABELS[status!]}
                </span>
                <h2 className="text-base font-black text-slate-800">{listing.title}</h2>
              </div>
              <p className="text-[11px] text-slate-500 font-bold">掲載期間：{formatSoulPeriod(listing)}</p>
              <p className="text-[11px] text-slate-500 font-bold">
                {listing.prices.length
                  ? listing.prices.map((p) => `${p.label} ${formatPrice(p.price)}`).join(' ／ ')
                  : '金額：未設定'}
              </p>
              <p className="text-[11px] text-slate-400">{COMMERCIAL_USE_LABELS[listing.commercial_use]}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              {status === 'open' && <SoulShareButton listing={listing} creatorName={creatorName} />}
              <button
                onClick={() => openEdit(listing)}
                className="text-xs font-bold px-4 py-2 rounded-full bg-sky-50 text-sky-700 hover:bg-sky-100 cursor-pointer"
              >
                編集
              </button>
              <button
                onClick={toggleClosed}
                className="text-xs font-bold px-4 py-2 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer"
              >
                {listing.is_closed ? '募集を再開' : '募集を締め切る'}
              </button>
              <Link
                href={`/creator/${listing.user_id}/souls/${listing.id}`}
                className="text-xs font-bold px-4 py-2 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"
              >
                公開ページを見る
              </Link>
              <button
                onClick={handleDelete}
                className="text-xs font-bold px-4 py-2 rounded-full text-rose-500 hover:bg-rose-50 cursor-pointer"
              >
                削除
              </button>
            </div>
            <p className="text-[10px] text-slate-400">別のキャラクターで募集したいときは、編集で内容を差し替えるか、削除してから新しく掲載してください。</p>
          </div>
        )}

        <p className="text-[11px] text-slate-600 text-center drop-shadow-xs">
          応募は「受け取ったリクエスト」に届きます。Discordにも通知したい場合は
          <Link href="/dashboard/notifications" className="font-bold text-sky-700 underline">
            通知設定
          </Link>
          から設定できます。
        </p>
      </div>

      {/* 掲載・編集フォーム */}
      {form && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-2xl p-6 space-y-5 shadow-xl my-8">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black text-slate-800">{form.id ? '魂募集を編集' : '魂募集を掲載'}</h2>
              <button
                onClick={() => setForm(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* 画像（最大4枚） */}
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-black text-slate-700">
                  イラスト（最大{MAX_SOUL_IMAGES}枚）*
                </span>
                <span className="text-[10px] text-slate-400">1枚目が表紙になります</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {form.images.map((slot, i) => (
                  <div key={slot.preview} className="relative aspect-[3/4] rounded-xl overflow-hidden bg-slate-100 group">
                    <img src={slot.preview} alt="" className="w-full h-full object-cover" />
                    {i === 0 ? (
                      <span className="absolute top-1 left-1 text-[9px] font-black px-1.5 py-0.5 rounded-full bg-violet-500 text-white">
                        表紙
                      </span>
                    ) : (
                      <button
                        onClick={() => makeCover(i)}
                        className="absolute bottom-1 left-1 right-1 text-[9px] font-black py-1 rounded-full bg-white/90 text-violet-700 cursor-pointer"
                      >
                        表紙にする
                      </button>
                    )}
                    <button
                      onClick={() => removeImage(i)}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-slate-900/60 text-white text-[10px] font-bold cursor-pointer"
                      aria-label="この画像を外す"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {form.images.length < MAX_SOUL_IMAGES && (
                  <label className="aspect-[3/4] rounded-xl border-2 border-dashed border-sky-200 bg-sky-50/50 flex flex-col items-center justify-center gap-1 text-sky-400 text-[11px] font-bold cursor-pointer hover:border-sky-400 transition-colors">
                    <span className="text-xl">＋</span>
                    画像を追加
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        addImages(e.target.files)
                        e.target.value = ''
                      }}
                    />
                  </label>
                )}
              </div>
              <p className="text-[10px] text-slate-400">正面・背面・表情差分など、同じキャラクターの画像を載せてください。</p>
            </div>

            <label className="block space-y-1">
              <span className="text-xs font-black text-slate-700">名前 *</span>
              <input
                className={inputClass}
                maxLength={60}
                placeholder="例：星宮ルナ"
                value={form.title}
                onChange={(e) => updateForm({ title: e.target.value })}
              />
            </label>

            <div className="grid sm:grid-cols-3 gap-3">
              <label className="block space-y-1">
                <span className="text-xs font-black text-slate-700">掲載開始日</span>
                <input type="date" className={inputClass} value={form.startsAt} onChange={(e) => updateForm({ startsAt: e.target.value })} />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-black text-slate-700">掲載終了日</span>
                <input type="date" className={inputClass} value={form.endsAt} onChange={(e) => updateForm({ endsAt: e.target.value })} />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-black text-slate-700">商用利用</span>
                <select
                  className={inputClass}
                  value={form.commercialUse}
                  onChange={(e) => updateForm({ commercialUse: e.target.value as SoulListing['commercial_use'] })}
                >
                  {(Object.keys(COMMERCIAL_USE_LABELS) as SoulListing['commercial_use'][]).map((key) => (
                    <option key={key} value={key}>
                      {COMMERCIAL_USE_LABELS[key]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="text-[10px] text-slate-400 -mt-3">掲載日が空欄なら、開始日は「すぐ」、終了日は「期限なし」になります。</p>

            {/* 金額 */}
            <div className="space-y-2">
              <span className="text-xs font-black text-slate-700">金額</span>
              {form.prices.map((p, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    className={`${inputClass} min-w-0`}
                    placeholder="例：立ち絵のみ / Live2D用パーツ分け込み / 著作権譲渡込み"
                    value={p.label}
                    onChange={(e) =>
                      updateForm({ prices: form.prices.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })
                    }
                  />
                  <div className="relative w-28 sm:w-36 shrink-0">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">¥</span>
                    <input
                      className={`${inputClass} pl-7`}
                      inputMode="numeric"
                      placeholder="応相談"
                      value={p.price}
                      onChange={(e) =>
                        updateForm({
                          prices: form.prices.map((x, j) => (j === i ? { ...x, price: e.target.value.replace(/[^\d]/g, '') } : x)),
                        })
                      }
                    />
                  </div>
                  <button
                    onClick={() => updateForm({ prices: form.prices.filter((_, j) => j !== i) })}
                    className="px-2 text-slate-300 hover:text-rose-500 text-sm cursor-pointer"
                    aria-label="この金額を削除"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                onClick={() => updateForm({ prices: [...form.prices, { label: '', price: '' }] })}
                className="text-[11px] font-bold text-sky-600 hover:underline cursor-pointer"
              >
                ＋ 金額を追加
              </button>
            </div>

            <label className="block space-y-1">
              <span className="text-xs font-black text-slate-700">どんな人向けか</span>
              <textarea
                rows={2}
                className={inputClass}
                placeholder="例：落ち着いた声で雑談配信をしたい方、歌枠中心で活動したい方"
                value={form.targetAudience}
                onChange={(e) => updateForm({ targetAudience: e.target.value })}
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-black text-slate-700">詳細</span>
              <textarea
                rows={6}
                className={inputClass}
                placeholder="キャラクターの設定、納品物（立ち絵・差分・表情パーツなど）、利用条件、応募時に書いてほしいことなど"
                value={form.description}
                onChange={(e) => updateForm({ description: e.target.value })}
              />
            </label>

            {/* 納品物 */}
            <div className="space-y-2 p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100">
              <div>
                <span className="text-xs font-black text-slate-700">お迎えすると受け取れるもの（納品物）</span>
                <p className="text-[10px] text-slate-400">✓付きの一覧で表示されます。何がもらえるか分かると、応募されやすくなります。</p>
              </div>
              {form.deliverables.map((d, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    className={`${inputClass} min-w-0`}
                    maxLength={60}
                    placeholder="例：表情差分 ×5"
                    value={d}
                    onChange={(e) => updateForm({ deliverables: form.deliverables.map((x, j) => (j === i ? e.target.value : x)) })}
                  />
                  <button
                    onClick={() => updateForm({ deliverables: form.deliverables.filter((_, j) => j !== i) })}
                    className="px-2 text-slate-300 hover:text-rose-500 text-sm cursor-pointer"
                    aria-label="削除"
                  >
                    ✕
                  </button>
                </div>
              ))}
              {form.deliverables.length < MAX_SOUL_DELIVERABLES && (
                <div className="flex flex-wrap gap-1.5">
                  {DELIVERABLE_PRESETS.filter((p) => !form.deliverables.includes(p)).map((preset) => (
                    <button
                      key={preset}
                      onClick={() => updateForm({ deliverables: [...form.deliverables, preset] })}
                      className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                    >
                      ＋ {preset}
                    </button>
                  ))}
                  <button
                    onClick={() => updateForm({ deliverables: [...form.deliverables, ''] })}
                    className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-500 text-white cursor-pointer"
                  >
                    ＋ 自由に追加
                  </button>
                </div>
              )}
            </div>

            {/* キャラクター設定 */}
            <div className="space-y-2 p-4 rounded-2xl bg-violet-50/50 border border-violet-100">
              <div>
                <span className="text-xs font-black text-slate-700">キャラクター設定表</span>
                <p className="text-[10px] text-slate-400">年齢・身長・性格などを表にして表示します。</p>
              </div>
              {form.characterProfile.map((item, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    className={`${inputClass.replace('w-full', '')} w-24 sm:w-32 shrink-0`}
                    maxLength={20}
                    placeholder="項目"
                    value={item.label}
                    onChange={(e) =>
                      updateForm({
                        characterProfile: form.characterProfile.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)),
                      })
                    }
                  />
                  <input
                    className={`${inputClass} min-w-0`}
                    maxLength={100}
                    placeholder="内容（例：158cm）"
                    value={item.value}
                    onChange={(e) =>
                      updateForm({
                        characterProfile: form.characterProfile.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)),
                      })
                    }
                  />
                  <button
                    onClick={() => updateForm({ characterProfile: form.characterProfile.filter((_, j) => j !== i) })}
                    className="px-2 text-slate-300 hover:text-rose-500 text-sm cursor-pointer"
                    aria-label="削除"
                  >
                    ✕
                  </button>
                </div>
              ))}
              {form.characterProfile.length < MAX_SOUL_PROFILE_ITEMS && (
                <div className="flex flex-wrap gap-1.5">
                  {PROFILE_PRESETS.filter((p) => !form.characterProfile.some((x) => x.label === p)).map((preset) => (
                    <button
                      key={preset}
                      onClick={() => updateForm({ characterProfile: [...form.characterProfile, { label: preset, value: '' }] })}
                      className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-white border border-violet-200 text-violet-700 hover:bg-violet-50 cursor-pointer"
                    >
                      ＋ {preset}
                    </button>
                  ))}
                  <button
                    onClick={() => updateForm({ characterProfile: [...form.characterProfile, { label: '', value: '' }] })}
                    className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-violet-500 text-white cursor-pointer"
                  >
                    ＋ 自由に追加
                  </button>
                </div>
              )}
            </div>

            {/* よくある質問 */}
            <div className="space-y-2 p-4 rounded-2xl bg-sky-50/50 border border-sky-100">
              <div>
                <span className="text-xs font-black text-slate-700">よくある質問（Q&amp;A）</span>
                <p className="text-[10px] text-slate-400">「名前は変えられますか？」など、応募前に気になりそうなことを先に答えておけます。</p>
              </div>
              {form.faqs.map((faq, i) => (
                <div key={i} className="space-y-1.5 bg-white rounded-xl p-3 border border-sky-100">
                  <div className="flex gap-2">
                    <input
                      className={inputClass}
                      maxLength={100}
                      placeholder="質問（例：名前は変えられますか？）"
                      value={faq.q}
                      onChange={(e) => updateForm({ faqs: form.faqs.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)) })}
                    />
                    <button
                      onClick={() => updateForm({ faqs: form.faqs.filter((_, j) => j !== i) })}
                      className="px-2 text-slate-300 hover:text-rose-500 text-sm cursor-pointer"
                      aria-label="削除"
                    >
                      ✕
                    </button>
                  </div>
                  <textarea
                    rows={2}
                    className={inputClass}
                    maxLength={500}
                    placeholder="答え"
                    value={faq.a}
                    onChange={(e) => updateForm({ faqs: form.faqs.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)) })}
                  />
                </div>
              ))}
              {form.faqs.length < MAX_SOUL_FAQS && (
                <button
                  onClick={() => updateForm({ faqs: [...form.faqs, { q: '', a: '' }] })}
                  className="text-[11px] font-bold text-sky-600 hover:underline cursor-pointer"
                >
                  ＋ 質問を追加
                </button>
              )}
            </div>

            {/* お迎えまでの流れ */}
            <FlowStepsEditor
              title="お迎えまでの流れ"
              steps={form.flowSteps}
              defaultSteps={DEFAULT_SOUL_FLOW}
              onChange={(flowSteps) => updateForm({ flowSteps })}
            />

            {form.id && (
              <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer">
                <input type="checkbox" checked={form.isClosed} onChange={(e) => updateForm({ isClosed: e.target.checked })} />
                募集を締め切る（決まった場合など。ページには「募集終了」と表示されます）
              </label>
            )}

            {errorMessage && <p className="text-xs font-bold text-rose-500">{errorMessage}</p>}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setForm(null)}
                className="px-5 py-2.5 rounded-full text-xs font-bold text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                キャンセル
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2.5 rounded-full bg-sky-500 hover:bg-sky-600 text-white text-xs font-black shadow-sm disabled:opacity-50 cursor-pointer"
              >
                {saving ? '保存中...' : form.id ? '保存する' : '掲載する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
