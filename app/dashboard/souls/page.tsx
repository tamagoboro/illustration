'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { backgroundImageStyle } from '@/lib/background'
import { convertToWebp } from '@/lib/imageUtils'
import SimpleHeader from '@/components/SimpleHeader'
import {
  SoulListing,
  SoulPrice,
  COMMERCIAL_USE_LABELS,
  SOUL_STATUS_LABELS,
  getSoulStatus,
  formatSoulPeriod,
  formatPrice,
  normalizePrices,
} from '@/lib/soulListings'

// クリエイター本人が「魂募集イラスト」を登録・編集・削除するページ
type FormState = {
  id: string | null
  title: string
  imageUrl: string
  imageFile: File | null
  imagePreview: string
  description: string
  targetAudience: string
  prices: { label: string; price: string }[]
  commercialUse: SoulListing['commercial_use']
  startsAt: string
  endsAt: string
  isClosed: boolean
}

const emptyForm = (): FormState => ({
  id: null,
  title: '',
  imageUrl: '',
  imageFile: null,
  imagePreview: '',
  description: '',
  targetAudience: '',
  prices: [{ label: '', price: '' }],
  commercialUse: 'allowed',
  startsAt: '',
  endsAt: '',
  isClosed: false,
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
  const [loading, setLoading] = useState(true)
  const [listings, setListings] = useState<SoulListing[]>([])
  const [form, setForm] = useState<FormState | null>(null)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const refresh = async (uid: string) => {
    const { data, error } = await supabase
      .from('soul_listings')
      .select('*')
      .eq('user_id', uid)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })
    if (error) {
      console.error('魂募集の取得エラー:', error)
      return
    }
    setListings((data || []).map((row: any) => ({ ...row, prices: normalizePrices(row.prices) })))
  }

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        router.push('/login')
        return
      }
      setUserId(data.user.id)
      await refresh(data.user.id)
      setLoading(false)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  const openEdit = (listing: SoulListing) => {
    setErrorMessage('')
    setForm({
      id: listing.id,
      title: listing.title,
      imageUrl: listing.image_url,
      imageFile: null,
      imagePreview: listing.image_url,
      description: listing.description,
      targetAudience: listing.target_audience,
      prices: listing.prices.length
        ? listing.prices.map((p) => ({ label: p.label, price: p.price === null ? '' : String(p.price) }))
        : [{ label: '', price: '' }],
      commercialUse: listing.commercial_use,
      startsAt: listing.starts_at || '',
      endsAt: listing.ends_at || '',
      isClosed: listing.is_closed,
    })
  }

  const updateForm = (patch: Partial<FormState>) => setForm((f) => (f ? { ...f, ...patch } : f))

  const handleImageChange = (file: File | undefined) => {
    if (!file) return
    updateForm({ imageFile: file, imagePreview: URL.createObjectURL(file) })
  }

  const handleSave = async () => {
    if (!form || !userId) return
    setErrorMessage('')
    if (!form.title.trim()) return setErrorMessage('名前を入力してください')
    if (!form.imageFile && !form.imageUrl) return setErrorMessage('イラストを1枚選んでください')
    if (form.startsAt && form.endsAt && form.startsAt > form.endsAt)
      return setErrorMessage('掲載終了日は開始日より後にしてください')

    const prices: SoulPrice[] = form.prices
      .filter((p) => p.label.trim())
      .map((p) => ({ label: p.label.trim(), price: p.price.trim() === '' ? null : Number(p.price) }))
    if (prices.some((p) => p.price !== null && (!Number.isFinite(p.price) || p.price < 0)))
      return setErrorMessage('金額は0以上の数字で入力してください（空欄にすると「応相談」になります）')

    setSaving(true)
    try {
      let imageUrl = form.imageUrl
      if (form.imageFile) {
        const webp = await convertToWebp(form.imageFile, 0.85, 1600)
        const path = `${userId}/soul_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.webp`
        const { data: uploaded, error: uploadError } = await supabase.storage
          .from('portfolios')
          .upload(path, webp, { contentType: 'image/webp' })
        if (uploadError) throw uploadError
        imageUrl = supabase.storage.from('portfolios').getPublicUrl(uploaded.path).data.publicUrl
      }

      const row = {
        user_id: userId,
        title: form.title.trim(),
        image_url: imageUrl,
        description: form.description.trim(),
        target_audience: form.targetAudience.trim(),
        prices,
        commercial_use: form.commercialUse,
        starts_at: form.startsAt || null,
        ends_at: form.endsAt || null,
        is_closed: form.isClosed,
      }
      const { error } = form.id
        ? await supabase.from('soul_listings').update(row).eq('id', form.id)
        : await supabase.from('soul_listings').insert({ ...row, sort_order: listings.length })
      if (error) throw error

      setForm(null)
      await refresh(userId)
    } catch (e) {
      console.error('魂募集の保存エラー:', e)
      setErrorMessage('保存に失敗しました。時間をおいて再度お試しください。')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (listing: SoulListing) => {
    if (!userId || !confirm(`「${listing.title}」を削除しますか？（元に戻せません）`)) return
    const { error } = await supabase.from('soul_listings').delete().eq('id', listing.id)
    if (error) {
      alert('削除に失敗しました')
      return
    }
    await refresh(userId)
  }

  const toggleClosed = async (listing: SoulListing) => {
    if (!userId) return
    const { error } = await supabase.from('soul_listings').update({ is_closed: !listing.is_closed }).eq('id', listing.id)
    if (error) {
      alert('更新に失敗しました')
      return
    }
    await refresh(userId)
  }

  return (
    <div className="min-h-screen pb-24 relative bg-cover bg-center" style={backgroundImageStyle}>
      <div className="absolute inset-0 bg-gradient-to-b from-sky-400/20 via-sky-100/10 to-sky-900/20 backdrop-blur-[2px] pointer-events-none -z-10" />
      <SimpleHeader label="魂募集の管理" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-8 space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <Link href="/dashboard" className="text-[11px] font-bold text-sky-700 hover:underline drop-shadow-xs">
              ← ダッシュボードに戻る
            </Link>
            <h1 className="text-2xl font-black text-slate-800 drop-shadow-sm mt-1">🎭 魂募集イラスト</h1>
            <p className="text-xs text-slate-600 font-medium drop-shadow-xs">
              キャラクターの「魂（中の人）」を募集するイラストを、ポートフォリオに掲載できます。
            </p>
          </div>
          <button
            onClick={() => {
              setErrorMessage('')
              setForm(emptyForm())
            }}
            className="px-5 py-2.5 rounded-full bg-sky-500 hover:bg-sky-600 text-white text-xs font-black shadow-sm cursor-pointer"
          >
            ＋ 新しく掲載する
          </button>
        </div>

        {loading ? (
          <p className="text-center text-xs font-bold text-slate-500 py-16">読み込み中...</p>
        ) : listings.length === 0 ? (
          <div className="bg-white/90 rounded-3xl p-10 text-center space-y-2 border border-white/70">
            <p className="text-3xl">🎭</p>
            <p className="text-sm font-black text-slate-700">まだ魂募集はありません</p>
            <p className="text-[11px] text-slate-500">「新しく掲載する」から、1枚目のイラストを登録してみましょう。</p>
          </div>
        ) : (
          <div className="space-y-3">
            {listings.map((listing) => {
              const status = getSoulStatus(listing)
              return (
                <div key={listing.id} className="bg-white/95 rounded-3xl p-4 border border-white/70 shadow-sm flex gap-4">
                  <img
                    src={listing.image_url}
                    alt=""
                    className="w-24 h-32 sm:w-28 sm:h-36 rounded-2xl object-cover bg-slate-100 shrink-0"
                  />
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${STATUS_STYLES[status]}`}>
                        {SOUL_STATUS_LABELS[status]}
                      </span>
                      <h2 className="text-sm font-black text-slate-800 truncate">{listing.title}</h2>
                    </div>
                    <p className="text-[11px] text-slate-500 font-bold">掲載期間：{formatSoulPeriod(listing)}</p>
                    <p className="text-[11px] text-slate-500 font-bold">
                      {listing.prices.length
                        ? listing.prices.map((p) => `${p.label} ${formatPrice(p.price)}`).join(' ／ ')
                        : '金額：未設定'}
                    </p>
                    <p className="text-[11px] text-slate-400">{COMMERCIAL_USE_LABELS[listing.commercial_use]}</p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        onClick={() => openEdit(listing)}
                        className="text-[11px] font-bold px-3 py-1.5 rounded-full bg-sky-50 text-sky-700 hover:bg-sky-100 cursor-pointer"
                      >
                        編集
                      </button>
                      <button
                        onClick={() => toggleClosed(listing)}
                        className="text-[11px] font-bold px-3 py-1.5 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer"
                      >
                        {listing.is_closed ? '募集を再開' : '募集を締め切る'}
                      </button>
                      <Link
                        href={`/creator/${listing.user_id}/souls/${listing.id}`}
                        className="text-[11px] font-bold px-3 py-1.5 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"
                      >
                        公開ページを見る
                      </Link>
                      <button
                        onClick={() => handleDelete(listing)}
                        className="text-[11px] font-bold px-3 py-1.5 rounded-full text-rose-500 hover:bg-rose-50 cursor-pointer"
                      >
                        削除
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
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

      {/* 登録・編集フォーム */}
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

            <div className="grid sm:grid-cols-[180px_1fr] gap-5">
              {/* 画像（1枚） */}
              <div className="space-y-2">
                <span className="text-xs font-black text-slate-700">イラスト（1枚）*</span>
                <label className="block aspect-[3/4] rounded-2xl border-2 border-dashed border-sky-200 bg-sky-50/50 overflow-hidden cursor-pointer hover:border-sky-400 transition-colors">
                  {form.imagePreview ? (
                    <img src={form.imagePreview} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="w-full h-full flex flex-col items-center justify-center text-sky-400 text-xs font-bold gap-1">
                      <span className="text-2xl">🖼</span>画像を選ぶ
                    </span>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleImageChange(e.target.files?.[0])}
                  />
                </label>
                {form.imagePreview && <p className="text-[10px] text-slate-400 text-center">タップで差し替え</p>}
              </div>

              <div className="space-y-4">
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

                <div className="grid grid-cols-2 gap-3">
                  <label className="block space-y-1">
                    <span className="text-xs font-black text-slate-700">掲載開始日</span>
                    <input type="date" className={inputClass} value={form.startsAt} onChange={(e) => updateForm({ startsAt: e.target.value })} />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs font-black text-slate-700">掲載終了日</span>
                    <input type="date" className={inputClass} value={form.endsAt} onChange={(e) => updateForm({ endsAt: e.target.value })} />
                  </label>
                </div>
                <p className="text-[10px] text-slate-400 -mt-2">空欄なら、開始日は「すぐ」、終了日は「期限なし」になります。</p>

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
            </div>

            {/* 金額 */}
            <div className="space-y-2">
              <span className="text-xs font-black text-slate-700">金額</span>
              {form.prices.map((p, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    className={inputClass}
                    placeholder="例：立ち絵のみ / Live2D用パーツ分け込み / 著作権譲渡込み"
                    value={p.label}
                    onChange={(e) =>
                      updateForm({ prices: form.prices.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })
                    }
                  />
                  <div className="relative w-36 shrink-0">
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
