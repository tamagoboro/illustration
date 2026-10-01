'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { backgroundImageStyle } from '@/lib/background'
import SimpleHeader from '@/components/SimpleHeader'
import { NOTIFICATION_TYPE_GROUPS, ALL_NOTIFICATION_TYPES } from '@/lib/notificationTypes'

// Discord通知の設定ページ。
// Webhook URLの登録・解除・テスト送信はサーバー（/api/discord/webhook）で行い、URLは暗号化して保存される。
// このページに戻ってくるのは伏せ字（hint）だけで、保存したURLそのものは二度と表示されない。
export default function NotificationSettingsPage() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [hint, setHint] = useState<string | null>(null)
  const [enabled, setEnabled] = useState(true)
  const [types, setTypes] = useState<string[]>(ALL_NOTIFICATION_TYPES)
  const [urlInput, setUrlInput] = useState('')
  const [busy, setBusy] = useState<'save' | 'test' | 'delete' | null>(null)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [savingSettings, setSavingSettings] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        router.push('/login')
        return
      }
      setUserId(data.user.id)
      const { data: settings } = await supabase
        .from('notification_settings')
        .select('discord_enabled, discord_types, discord_webhook_hint')
        .eq('user_id', data.user.id)
        .maybeSingle()
      if (settings) {
        setEnabled(settings.discord_enabled)
        setTypes(settings.discord_types || [])
        setHint(settings.discord_webhook_hint)
      }
      setLoading(false)
    })
  }, [router])

  // 自分のアクセストークンを付けてAPIを呼ぶ（サーバー側で本人確認する）
  const callApi = async (method: 'POST' | 'PUT' | 'DELETE', body?: object) => {
    const { data } = await supabase.auth.getSession()
    const res = await fetch('/api/discord/webhook', {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token ?? ''}` },
      body: body ? JSON.stringify(body) : undefined,
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(json.error || '通信に失敗しました')
    return json
  }

  const handleSaveWebhook = async () => {
    setBusy('save')
    setMessage(null)
    try {
      const json = await callApi('POST', { url: urlInput })
      setHint(json.hint)
      setUrlInput('')
      setMessage({ kind: 'ok', text: '連携しました！Discordにテストメッセージを送ったので確認してください。' })
    } catch (e: any) {
      setMessage({ kind: 'error', text: e.message })
    } finally {
      setBusy(null)
    }
  }

  const handleTest = async () => {
    setBusy('test')
    setMessage(null)
    try {
      await callApi('PUT')
      setMessage({ kind: 'ok', text: 'テスト通知を送りました。Discordを確認してください。' })
    } catch (e: any) {
      setMessage({ kind: 'error', text: e.message })
    } finally {
      setBusy(null)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Discordとの連携を解除しますか？')) return
    setBusy('delete')
    setMessage(null)
    try {
      await callApi('DELETE')
      setHint(null)
      setMessage({ kind: 'ok', text: '連携を解除しました。' })
    } catch (e: any) {
      setMessage({ kind: 'error', text: e.message })
    } finally {
      setBusy(null)
    }
  }

  const saveSettings = async (nextEnabled: boolean, nextTypes: string[]) => {
    if (!userId) return
    setEnabled(nextEnabled)
    setTypes(nextTypes)
    setSavingSettings(true)
    const { error } = await supabase.from('notification_settings').upsert(
      { user_id: userId, discord_enabled: nextEnabled, discord_types: nextTypes, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )
    setSavingSettings(false)
    if (error) {
      console.error('通知設定の保存エラー:', error)
      setMessage({ kind: 'error', text: '設定の保存に失敗しました。' })
    }
  }

  const toggleType = (type: string) =>
    saveSettings(enabled, types.includes(type) ? types.filter((t) => t !== type) : [...types, type])

  return (
    <div className="min-h-screen pb-24 relative bg-cover bg-center" style={backgroundImageStyle}>
      <div className="absolute inset-0 bg-gradient-to-b from-sky-400/20 via-sky-100/10 to-sky-900/20 backdrop-blur-[2px] pointer-events-none -z-10" />
      <SimpleHeader label="通知設定" />

      <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-8 space-y-5">
        <div>
          <Link href="/dashboard" className="text-[11px] font-bold text-sky-700 hover:underline drop-shadow-xs">
            ← ダッシュボードに戻る
          </Link>
          <h1 className="text-2xl font-black text-slate-800 drop-shadow-sm mt-1">🔔 Discord通知</h1>
          <p className="text-xs text-slate-600 font-medium drop-shadow-xs">
            リクエストや魂募集への応募、フォローなどを、あなたのDiscordサーバーにお知らせします。
          </p>
        </div>

        {loading ? (
          <p className="text-center text-xs font-bold text-slate-500 py-16">読み込み中...</p>
        ) : (
          <>
            {/* 連携 */}
            <section className="bg-white/95 rounded-3xl p-6 border border-white/70 shadow-sm space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-black text-slate-800">Discordとの連携</h2>
                {hint ? (
                  <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">● 連携中</span>
                ) : (
                  <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-slate-100 text-slate-500">未設定</span>
                )}
              </div>

              {hint && (
                <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 rounded-2xl px-4 py-3">
                  <code className="text-[11px] text-slate-500">{hint}</code>
                  <div className="flex gap-2">
                    <button
                      onClick={handleTest}
                      disabled={busy !== null}
                      className="text-[11px] font-bold px-3 py-1.5 rounded-full bg-sky-50 text-sky-700 hover:bg-sky-100 disabled:opacity-50 cursor-pointer"
                    >
                      {busy === 'test' ? '送信中...' : 'テスト送信'}
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={busy !== null}
                      className="text-[11px] font-bold px-3 py-1.5 rounded-full text-rose-500 hover:bg-rose-50 disabled:opacity-50 cursor-pointer"
                    >
                      解除
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-700 block">
                  {hint ? '別のWebhook URLに変更する' : 'Webhook URL'}
                </label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    autoComplete="off"
                    placeholder="https://discord.com/api/webhooks/..."
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    className="flex-1 min-w-0 px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400/40"
                  />
                  <button
                    onClick={handleSaveWebhook}
                    disabled={!urlInput.trim() || busy !== null}
                    className="shrink-0 px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-black disabled:opacity-40 cursor-pointer"
                  >
                    {busy === 'save' ? '確認中...' : '連携する'}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  URLは暗号化して保存され、ほかのユーザーや運営画面に表示されることはありません。
                  <Link href="/guide/discord-webhook" className="font-bold text-sky-600 underline ml-1">
                    Webhook URLの取得方法 →
                  </Link>
                </p>
              </div>

              {message && (
                <p className={`text-xs font-bold ${message.kind === 'ok' ? 'text-emerald-600' : 'text-rose-500'}`}>
                  {message.text}
                </p>
              )}
            </section>

            {/* 通知の種類 */}
            <section className={`bg-white/95 rounded-3xl p-6 border border-white/70 shadow-sm space-y-5 ${hint ? '' : 'opacity-60'}`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-black text-slate-800">Discordに送る通知</h2>
                  <p className="text-[11px] text-slate-500">
                    {savingSettings ? '保存中...' : 'オン・オフはすぐに保存されます。サイト内の通知ベルにはすべて届きます。'}
                  </p>
                </div>
                <Toggle checked={enabled} onChange={() => saveSettings(!enabled, types)} label="Discord通知全体" />
              </div>

              <div className={`space-y-5 ${enabled ? '' : 'opacity-40 pointer-events-none'}`}>
                {NOTIFICATION_TYPE_GROUPS.map((group) => (
                  <div key={group.title} className="space-y-2">
                    <h3 className="text-[11px] font-black text-slate-400 tracking-wider">{group.title}</h3>
                    <div className="divide-y divide-slate-100 rounded-2xl border border-slate-100">
                      {group.items.map((item) => (
                        <div key={item.type} className="flex items-center justify-between gap-3 px-4 py-3">
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-700">{item.label}</p>
                            <p className="text-[10px] text-slate-400">{item.description}</p>
                          </div>
                          <Toggle checked={types.includes(item.type)} onChange={() => toggleType(item.type)} label={item.label} />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  )
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={`relative shrink-0 w-11 h-6 rounded-full transition-colors cursor-pointer ${checked ? 'bg-sky-500' : 'bg-slate-200'}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-5' : ''}`}
      />
    </button>
  )
}
