'use client'

import { useEffect, useState, CSSProperties } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { convertToWebp } from '@/lib/imageUtils'
import { invalidateIconRingsCache } from '@/lib/iconRings'

type RingRow = {
  id: string
  name: string
  cost: number
  image_url: string
  sort_order: number
  available_from: string | null
  available_until: string | null
}

// datetime-local入力用のフォーマット変換（タイムゾーンはブラウザのローカル時刻として扱う）
const toDatetimeLocalValue = (iso: string | null): string => {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const fromDatetimeLocalValue = (value: string): string | null => {
  if (!value) return null
  return new Date(value).toISOString()
}

const formatWindowLabel = (from: string | null, until: string | null): string => {
  if (!from && !until) return '無期限'
  const fmt = (iso: string) => new Date(iso).toLocaleString('ja-JP', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  if (from && until) return `${fmt(from)} 〜 ${fmt(until)}`
  if (from) return `${fmt(from)} 〜`
  return `〜 ${fmt(until as string)}`
}

// 透過部分が見えるようにチェッカー柄の背景を敷くためのスタイル
const CHECKER_BG: CSSProperties = {
  backgroundImage:
    'linear-gradient(45deg, #e2e8f0 25%, transparent 25%), linear-gradient(-45deg, #e2e8f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e2e8f0 75%), linear-gradient(-45deg, transparent 75%, #e2e8f0 75%)',
  backgroundSize: '10px 10px',
  backgroundPosition: '0 0, 0 5px, 5px -5px, -5px 0px',
}

export default function AdminRingsPage() {
  const [checking, setChecking] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loggedIn, setLoggedIn] = useState(false)

  const [rings, setRings] = useState<RingRow[]>([])
  const [loadingRings, setLoadingRings] = useState(true)

  // 新規追加フォーム
  const [newName, setNewName] = useState('')
  const [newCost, setNewCost] = useState('100')
  const [newFile, setNewFile] = useState<File | null>(null)
  const [newAvailableFrom, setNewAvailableFrom] = useState('')
  const [newAvailableUntil, setNewAvailableUntil] = useState('')
  const [creating, setCreating] = useState(false)
  const [formError, setFormError] = useState('')

  // 編集中の行
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editCost, setEditCost] = useState('')
  const [editAvailableFrom, setEditAvailableFrom] = useState('')
  const [editAvailableUntil, setEditAvailableUntil] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser()
      const uid = data?.user?.id || null
      setLoggedIn(!!uid)

      if (uid) {
        const { data: adminRow } = await supabase
          .from('admins')
          .select('user_id')
          .eq('user_id', uid)
          .maybeSingle()
        setIsAdmin(!!adminRow)
      }
      setChecking(false)
    }
    init()
  }, [])

  const refreshRings = async () => {
    setLoadingRings(true)
    const { data, error } = await supabase
      .from('icon_rings')
      .select('*')
      .order('sort_order', { ascending: true })
    if (!error && data) setRings(data as RingRow[])
    setLoadingRings(false)
  }

  useEffect(() => {
    if (isAdmin) refreshRings()
  }, [isAdmin])

  const uploadRingImage = async (id: string, file: File) => {
    const webpBlob = await convertToWebp(file, 0.9, 800)
    const path = `rings/${id}.webp`
    const { error: uploadError } = await supabase.storage
      .from('portfolios')
      .upload(path, webpBlob, { contentType: 'image/webp', upsert: true })
    if (uploadError) throw uploadError

    const { data: publicUrlData } = supabase.storage.from('portfolios').getPublicUrl(path)
    // キャッシュ避けのため差し替え時は更新時刻をクエリに付与
    return `${publicUrlData.publicUrl}?v=${Date.now()}`
  }

  const handleCreate = async () => {
    setFormError('')
    if (!newName.trim()) {
      setFormError('リング名を入力してください。')
      return
    }
    const cost = Number(newCost)
    if (!Number.isFinite(cost) || cost < 0) {
      setFormError('価格は0以上の数値で入力してください。')
      return
    }
    if (!newFile) {
      setFormError('リング画像を選択してください。')
      return
    }

    setCreating(true)
    try {
      const id = crypto.randomUUID()
      const imageUrl = await uploadRingImage(id, newFile)

      const { error: insertError } = await supabase.from('icon_rings').insert({
        id,
        name: newName.trim(),
        cost,
        image_url: imageUrl,
        sort_order: rings.length,
        available_from: fromDatetimeLocalValue(newAvailableFrom),
        available_until: fromDatetimeLocalValue(newAvailableUntil),
      })
      if (insertError) throw insertError

      invalidateIconRingsCache()
      setNewName('')
      setNewCost('100')
      setNewFile(null)
      setNewAvailableFrom('')
      setNewAvailableUntil('')
      await refreshRings()
    } catch (e: any) {
      console.error('リング追加エラー:', e)
      setFormError('追加に失敗しました。' + (e?.message || ''))
    } finally {
      setCreating(false)
    }
  }

  const startEdit = (ring: RingRow) => {
    setEditingId(ring.id)
    setEditName(ring.name)
    setEditCost(String(ring.cost))
    setEditAvailableFrom(toDatetimeLocalValue(ring.available_from))
    setEditAvailableUntil(toDatetimeLocalValue(ring.available_until))
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditName('')
    setEditCost('')
    setEditAvailableFrom('')
    setEditAvailableUntil('')
  }

  const saveEdit = async (id: string) => {
    const cost = Number(editCost)
    if (!editName.trim() || !Number.isFinite(cost) || cost < 0) return

    setBusyId(id)
    const { error } = await supabase
      .from('icon_rings')
      .update({
        name: editName.trim(),
        cost,
        available_from: fromDatetimeLocalValue(editAvailableFrom),
        available_until: fromDatetimeLocalValue(editAvailableUntil),
      })
      .eq('id', id)
    setBusyId(null)

    if (error) {
      alert('更新に失敗しました。')
      return
    }
    invalidateIconRingsCache()
    cancelEdit()
    await refreshRings()
  }

  const handleReplaceImage = async (id: string, file: File) => {
    setBusyId(id)
    try {
      const imageUrl = await uploadRingImage(id, file)
      const { error } = await supabase.from('icon_rings').update({ image_url: imageUrl }).eq('id', id)
      if (error) throw error
      invalidateIconRingsCache()
      await refreshRings()
    } catch (e) {
      console.error('画像差し替えエラー:', e)
      alert('画像の差し替えに失敗しました。')
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`「${name}」を削除します。すでに購入・装着しているユーザーの表示にも影響します。よろしいですか？`)) {
      return
    }
    setBusyId(id)
    const { error } = await supabase.from('icon_rings').delete().eq('id', id)
    setBusyId(null)

    if (error) {
      alert('削除に失敗しました。')
      return
    }
    invalidateIconRingsCache()
    await refreshRings()
  }

  if (checking) {
    return <div className="p-8 text-center text-xs font-bold text-slate-400">読み込み中...</div>
  }

  if (!loggedIn) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 text-center space-y-3 max-w-sm w-full">
          <p className="text-sm font-bold text-slate-700">ログインが必要です</p>
          <Link
            href="/login"
            className="inline-block px-5 py-2.5 bg-gradient-to-r from-sky-400 to-cyan-400 text-white font-bold text-xs rounded-xl shadow-sm"
          >
            ログイン
          </Link>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 text-center space-y-2 max-w-sm w-full">
          <p className="text-sm font-bold text-slate-700">このページへのアクセス権がありません</p>
          <p className="text-xs text-slate-400">管理者アカウントでログインしてください。</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50/60 pb-24">
      <header className="px-4 sm:px-6 py-3.5 bg-white/90 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30 shadow-xs">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <Link href="/rewards" className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors">
            <span>←</span> マイページへ
          </Link>
          <h1 className="text-sm font-bold text-slate-900">アイコンリング管理</h1>
          <div className="flex items-center gap-3">
            <Link href="/admin/analytics" className="text-[11px] font-bold text-slate-400 hover:text-sky-600 transition-colors">
              PV解析
            </Link>
            <Link href="/admin/users" className="text-[11px] font-bold text-slate-400 hover:text-sky-600 transition-colors">
              ユーザー管理
            </Link>
            <Link href="/admin/reports" className="text-[11px] font-bold text-slate-400 hover:text-sky-600 transition-colors">
              通報管理
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
        {/* 新規追加 */}
        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-3">
          <h2 className="text-xs font-black text-slate-900 uppercase tracking-widest">新しいリングを追加</h2>

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">リング名</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="例：桜舞う輪"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">価格 (pt)</label>
              <input
                type="number"
                min={0}
                value={newCost}
                onChange={(e) => setNewCost(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              リング画像（円形・中央が透明なPNG推奨）
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setNewFile(e.target.files?.[0] || null)}
              className="block w-full text-xs text-slate-500
                file:mr-3 file:py-2 file:px-4
                file:rounded-xl file:border-0
                file:text-xs file:font-bold
                file:bg-sky-50 file:text-sky-700
                hover:file:bg-sky-100
                file:cursor-pointer cursor-pointer"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">公開・購入開始（空欄=無期限）</label>
              <input
                type="datetime-local"
                value={newAvailableFrom}
                onChange={(e) => setNewAvailableFrom(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">購入終了（空欄=無期限）</label>
              <input
                type="datetime-local"
                value={newAvailableUntil}
                onChange={(e) => setNewAvailableUntil(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
              />
            </div>
          </div>
          <p className="text-[10px] text-slate-400 -mt-1">
            期間外は未所持ユーザーのショップに表示されなくなります。すでに購入・装着済みの場合は期間を過ぎても使い続けられます。
          </p>

          {formError && (
            <p className="text-[11px] font-bold text-rose-500">{formError}</p>
          )}

          <button
            onClick={handleCreate}
            disabled={creating}
            className="px-4 py-2.5 bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs rounded-xl transition cursor-pointer disabled:opacity-50"
          >
            {creating ? '追加中...' : '追加する'}
          </button>
        </div>

        {/* 一覧 */}
        <div className="space-y-3">
          <h2 className="text-xs font-black text-slate-900 uppercase tracking-widest">登録済みのリング</h2>

          {loadingRings ? (
            <p className="text-xs text-slate-400">読み込み中...</p>
          ) : rings.length === 0 ? (
            <p className="text-xs text-slate-400">まだリングが登録されていません。</p>
          ) : (
            <div className="space-y-3">
              {rings.map((ring) => {
                const isEditing = editingId === ring.id
                const isBusy = busyId === ring.id

                return (
                  <div key={ring.id} className="bg-white rounded-3xl p-4 border border-slate-100 shadow-sm flex items-center gap-4">
                    <div
                      className="w-16 h-16 rounded-2xl overflow-hidden shrink-0 border border-slate-200"
                      style={CHECKER_BG}
                    >
                      <img src={ring.image_url} alt={ring.name} className="w-full h-full object-contain" />
                    </div>

                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <div className="space-y-2">
                          <div className="flex flex-col sm:flex-row gap-2">
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-sm"
                            />
                            <input
                              type="number"
                              min={0}
                              value={editCost}
                              onChange={(e) => setEditCost(e.target.value)}
                              className="w-24 px-2.5 py-1.5 rounded-lg border border-slate-200 text-sm"
                            />
                          </div>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <div className="flex-1">
                              <label className="block text-[10px] font-bold text-slate-500 mb-0.5">開始（空欄=無期限）</label>
                              <input
                                type="datetime-local"
                                value={editAvailableFrom}
                                onChange={(e) => setEditAvailableFrom(e.target.value)}
                                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs"
                              />
                            </div>
                            <div className="flex-1">
                              <label className="block text-[10px] font-bold text-slate-500 mb-0.5">終了（空欄=無期限）</label>
                              <input
                                type="datetime-local"
                                value={editAvailableUntil}
                                onChange={(e) => setEditAvailableUntil(e.target.value)}
                                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs"
                              />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <>
                          <span className="text-xs font-black text-slate-800 block truncate">{ring.name}</span>
                          <span className="text-[11px] text-slate-400">{ring.cost.toLocaleString()} pt</span>
                          <span className="text-[10px] text-slate-400 block">
                            販売期間: {formatWindowLabel(ring.available_from, ring.available_until)}
                          </span>
                        </>
                      )}

                      <label className="inline-block mt-1.5 text-[10px] font-bold text-sky-600 hover:underline cursor-pointer">
                        画像を差し替え
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={isBusy}
                          onChange={(e) => {
                            const f = e.target.files?.[0]
                            if (f) handleReplaceImage(ring.id, f)
                            e.target.value = ''
                          }}
                        />
                      </label>
                    </div>

                    <div className="flex flex-col gap-1.5 shrink-0">
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => saveEdit(ring.id)}
                            disabled={isBusy}
                            className="px-3 py-1.5 bg-sky-500 hover:bg-sky-600 text-white font-bold text-[11px] rounded-lg transition cursor-pointer disabled:opacity-50"
                          >
                            保存
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-[11px] rounded-lg transition cursor-pointer"
                          >
                            取消
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => startEdit(ring)}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-[11px] rounded-lg transition cursor-pointer"
                          >
                            編集
                          </button>
                          <button
                            onClick={() => handleDelete(ring.id, ring.name)}
                            disabled={isBusy}
                            className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-[11px] rounded-lg transition cursor-pointer disabled:opacity-50"
                          >
                            削除
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
