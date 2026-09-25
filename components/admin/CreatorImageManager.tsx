'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { convertToWebp } from '@/lib/imageUtils'
import { extractStoragePath } from '@/lib/storageUtils'

// 管理者がクリエイターの画像（アイコン・作品）を削除・差し替えするパネル。
// 「ユーザー管理」の一覧（名前をクリックして開く）と「画像管理」ページの両方で使う。
// 実際の書き換えは security definer のRPC（管理者確認つき）で行い、操作は理由つきで
// クリエイターに通知され、admin_audit_log に記録される（supabase/add_admin_image_moderation.sql）。

export type ManagedUser = {
  user_id: string
  display_name: string | null
  avatar_url: string | null
}

type WorkRow = {
  id: string
  title: string | null
  image_url: string
  before_image_url: string | null
  sort_order: string | number | null
}

// 差し替え用にアップロードするファイルの行き先（どの画像の差し替えか）
type PendingUpload =
  | { kind: 'work'; itemId: string; field: 'image' | 'before' }
  | { kind: 'avatar' }

const PLACEHOLDER_URL = '/moderated-placeholder.svg'
const REASON_PRESETS = ['著作権侵害の疑い', '不適切な内容', '規約違反', '本人の依頼']
const publicUrlOf = (path: string) => `/storage/v1/object/public/portfolios/${path}`

export default function CreatorImageManager({
  user,
  onChanged,
}: {
  user: ManagedUser
  onChanged?: (info: { avatar_url: string | null }) => void
}) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user.avatar_url)
  const [works, setWorks] = useState<WorkRow[]>([])
  const [loadingWorks, setLoadingWorks] = useState(true)
  const [reason, setReason] = useState('')
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  const fileInputRef = useRef<HTMLInputElement>(null)
  const pendingUploadRef = useRef<PendingUpload | null>(null)

  const loadWorks = async () => {
    setLoadingWorks(true)
    const { data, error } = await supabase
      .from('portfolio_items')
      .select('id, title, image_url, before_image_url, sort_order')
      .eq('user_id', user.user_id)
      .order('sort_order', { ascending: true })
    setLoadingWorks(false)
    if (error) {
      console.error('作品の取得エラー:', error)
      setMessage('作品の取得に失敗しました。')
      return
    }
    setWorks((data || []) as WorkRow[])
  }

  useEffect(() => {
    setAvatarUrl(user.avatar_url)
    setMessage('')
    loadWorks()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.user_id])

  const reload = async () => {
    await loadWorks()
    const { data } = await supabase.from('profiles').select('avatar_url').eq('user_id', user.user_id).maybeSingle()
    const nextAvatar = (data?.avatar_url as string | null | undefined) ?? null
    setAvatarUrl(nextAvatar)
    onChanged?.({ avatar_url: nextAvatar })
  }

  const requireReason = (): string | null => {
    const trimmed = reason.trim()
    if (!trimmed) {
      alert('理由を入力してください（クリエイターに通知されます）。')
      return null
    }
    return trimmed
  }

  // 使われなくなった画像ファイルをストレージから削除する。失敗しても操作自体は完了しているので、記録だけ残す。
  const removeStorageFiles = async (urls: (string | null)[]) => {
    const paths = urls.map((u) => extractStoragePath(u)).filter((p): p is string => !!p)
    if (paths.length === 0) return
    const { error } = await supabase.storage.from('portfolios').remove(paths)
    if (error) console.error('画像ファイルの削除エラー:', error)
  }

  const uploadReplacement = async (file: File): Promise<{ url: string; path: string }> => {
    const webpBlob = await convertToWebp(file, 0.85, 1600)
    const path = `moderation/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.webp`
    const { error } = await supabase.storage.from('portfolios').upload(path, webpBlob, { contentType: 'image/webp' })
    if (error) throw error
    const { data } = supabase.storage.from('portfolios').getPublicUrl(path)
    return { url: data.publicUrl, path }
  }

  const finish = async (doneMessage: string) => {
    setMessage(doneMessage)
    setReason('')
    await reload()
  }

  const handleRemoveWork = async (item: WorkRow) => {
    const r = requireReason()
    if (!r) return
    if (!confirm('この作品を削除します。クリエイターに理由つきで通知されます。よろしいですか？')) return

    setBusyKey(`work:${item.id}`)
    const { data, error } = await supabase.rpc('admin_remove_portfolio_item', { p_item_id: item.id, p_reason: r })
    setBusyKey(null)
    if (error) {
      console.error('作品削除エラー:', error)
      alert('削除に失敗しました。' + error.message)
      return
    }
    await removeStorageFiles((data || []) as string[])
    await finish('作品を削除しました。')
  }

  const replaceWork = async (item: WorkRow, field: 'image' | 'before', newUrl: string | null, uploadedPath?: string) => {
    const r = requireReason()
    if (!r) {
      if (uploadedPath) await removeStorageFiles([publicUrlOf(uploadedPath)])
      return
    }
    setBusyKey(`work:${item.id}`)
    const { data, error } = await supabase.rpc('admin_replace_portfolio_image', {
      p_item_id: item.id,
      p_field: field,
      p_new_url: newUrl,
      p_reason: r,
    })
    setBusyKey(null)
    if (error) {
      console.error('作品画像の差し替えエラー:', error)
      alert('差し替えに失敗しました。' + error.message)
      if (uploadedPath) await removeStorageFiles([publicUrlOf(uploadedPath)])
      return
    }
    await removeStorageFiles([data as string])
    await finish(newUrl ? '画像を差し替えました。' : '画像を削除しました。')
  }

  const replaceAvatar = async (newUrl: string | null, uploadedPath?: string) => {
    const r = requireReason()
    if (!r) {
      if (uploadedPath) await removeStorageFiles([publicUrlOf(uploadedPath)])
      return
    }
    setBusyKey('avatar')
    const { data, error } = await supabase.rpc('admin_replace_avatar', {
      p_user_id: user.user_id,
      p_new_url: newUrl,
      p_reason: r,
    })
    setBusyKey(null)
    if (error) {
      console.error('アイコンの差し替えエラー:', error)
      alert('操作に失敗しました。' + error.message)
      if (uploadedPath) await removeStorageFiles([publicUrlOf(uploadedPath)])
      return
    }
    await removeStorageFiles([data as string])
    await finish(newUrl ? 'アイコンを差し替えました。' : 'アイコンを削除しました。')
  }

  const startUpload = (pending: PendingUpload) => {
    if (!requireReason()) return
    pendingUploadRef.current = pending
    fileInputRef.current?.click()
  }

  const handleFileChosen = async (file: File | undefined) => {
    const pending = pendingUploadRef.current
    pendingUploadRef.current = null
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (!file || !pending) return

    setBusyKey(pending.kind === 'avatar' ? 'avatar' : `work:${pending.itemId}`)
    let uploaded: { url: string; path: string }
    try {
      uploaded = await uploadReplacement(file)
    } catch (e) {
      console.error('差し替え画像のアップロードエラー:', e)
      setBusyKey(null)
      alert('画像のアップロードに失敗しました。')
      return
    }
    setBusyKey(null)

    if (pending.kind === 'avatar') {
      await replaceAvatar(uploaded.url, uploaded.path)
    } else {
      const item = works.find((w) => w.id === pending.itemId)
      if (item) await replaceWork(item, pending.field, uploaded.url, uploaded.path)
    }
  }

  const btnBase = 'px-3 py-1.5 font-bold text-[11px] rounded-lg cursor-pointer disabled:opacity-50 transition'

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFileChosen(e.target.files?.[0])}
      />

      <div className="space-y-1.5">
        <label className="text-[11px] font-black text-slate-700">
          理由（必須・クリエイターに通知されます）
        </label>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="例: 著作権侵害の疑いがあるため"
          maxLength={200}
          className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:border-sky-400 bg-white"
        />
        <div className="flex flex-wrap gap-1.5">
          {REASON_PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setReason(p)}
              className="text-[10px] font-bold bg-white hover:bg-slate-100 border border-slate-200 text-slate-500 px-2 py-1 rounded-lg cursor-pointer"
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {message && <p className="text-[11px] font-bold text-emerald-600">{message}</p>}

      <div className="flex items-center gap-3 bg-white rounded-xl p-2.5 border border-slate-100">
        <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-100 shrink-0">
          {avatarUrl && <img src={avatarUrl} alt="" className="w-full h-full object-cover" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-black text-slate-700">アイコン</p>
          {!avatarUrl && <p className="text-[10px] text-slate-400">未設定</p>}
        </div>
        {avatarUrl && (
          <div className="flex gap-1.5 flex-wrap justify-end">
            <button
              onClick={() => startUpload({ kind: 'avatar' })}
              disabled={busyKey === 'avatar'}
              className={`${btnBase} bg-sky-50 hover:bg-sky-100 text-sky-700`}
            >
              差し替え
            </button>
            <button
              onClick={() => {
                if (!requireReason()) return
                if (confirm('アイコンを削除します。よろしいですか？')) replaceAvatar(null)
              }}
              disabled={busyKey === 'avatar'}
              className={`${btnBase} bg-rose-50 hover:bg-rose-100 text-rose-600`}
            >
              削除
            </button>
          </div>
        )}
      </div>

      {loadingWorks ? (
        <p className="text-[11px] text-slate-500 font-bold text-center py-3">作品を読み込み中...</p>
      ) : works.length === 0 ? (
        <p className="text-[11px] text-slate-500 font-bold text-center py-3">このクリエイターの作品はありません</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {works.map((w) => {
            const busy = busyKey === `work:${w.id}`
            return (
              <div key={w.id} className="bg-white rounded-xl p-2.5 border border-slate-100 space-y-2">
                <div className="flex gap-2">
                  <div className="flex-1 aspect-square rounded-lg overflow-hidden bg-slate-100">
                    <img src={w.image_url} alt="" className="w-full h-full object-cover" />
                  </div>
                  {w.before_image_url && (
                    <div className="w-1/3 space-y-1">
                      <div className="aspect-square rounded-lg overflow-hidden bg-slate-100">
                        <img src={w.before_image_url} alt="" className="w-full h-full object-cover" />
                      </div>
                      <p className="text-[9px] font-bold text-slate-400 text-center">ビフォー</p>
                    </div>
                  )}
                </div>
                {w.title && <p className="text-[11px] font-bold text-slate-600 truncate">{w.title}</p>}

                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => startUpload({ kind: 'work', itemId: w.id, field: 'image' })}
                    disabled={busy}
                    className={`${btnBase} bg-sky-50 hover:bg-sky-100 text-sky-700`}
                  >
                    差し替え
                  </button>
                  <button
                    onClick={() => {
                      if (!requireReason()) return
                      if (confirm('この画像を「非表示」の代替画像に差し替えます。よろしいですか？')) {
                        replaceWork(w, 'image', PLACEHOLDER_URL)
                      }
                    }}
                    disabled={busy}
                    className={`${btnBase} bg-slate-100 hover:bg-slate-200 text-slate-600`}
                  >
                    非表示画像にする
                  </button>
                  {w.before_image_url && (
                    <button
                      onClick={() => {
                        if (!requireReason()) return
                        if (confirm('ビフォー画像を削除します。よろしいですか？')) replaceWork(w, 'before', null)
                      }}
                      disabled={busy}
                      className={`${btnBase} bg-amber-50 hover:bg-amber-100 text-amber-700`}
                    >
                      ビフォーを削除
                    </button>
                  )}
                  <button
                    onClick={() => handleRemoveWork(w)}
                    disabled={busy}
                    className={`${btnBase} bg-rose-50 hover:bg-rose-100 text-rose-600`}
                  >
                    作品を削除
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
