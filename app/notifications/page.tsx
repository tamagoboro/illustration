'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import SimpleHeader from '@/components/SimpleHeader'
import { backgroundImageStyle } from '@/lib/background'

type NotificationRow = {
  id: string
  type: string
  title: string
  body: string | null
  link_url: string | null
  is_read: boolean
  created_at: string
}

const PAGE_SIZE = 30

// ベルのドロップダウン（直近20件・本文は2行で省略）の「すべての通知を見る」から来る、
// 全件を見られる一覧ページ。本文を省略せず表示し、もっと見るでページングする。
export default function NotificationsPage() {
  const [checking, setChecking] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [notifications, setNotifications] = useState<NotificationRow[]>([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')

  const unreadCount = notifications.filter((n) => !n.is_read).length

  const loadNotifications = async (uid: string, reset: boolean) => {
    setLoading(true)
    const offset = reset ? 0 : notifications.length
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)

    setLoading(false)
    if (error) {
      console.error('通知一覧の取得エラー:', error)
      return
    }
    const rows = (data || []) as NotificationRow[]
    setNotifications((prev) => (reset ? rows : [...prev, ...rows]))
    setHasMore(rows.length === PAGE_SIZE)
  }

  useEffect(() => {
    let isMounted = true
    supabase.auth.getUser().then(({ data }) => {
      if (!isMounted) return
      const uid = data?.user?.id || null
      setUserId(uid)
      setChecking(false)
      if (uid) loadNotifications(uid, true)
    })
    return () => {
      isMounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const markAsRead = async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)))
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
  }

  const markAllAsRead = async () => {
    if (!userId) return
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false)
  }

  const visibleNotifications = filter === 'unread' ? notifications.filter((n) => !n.is_read) : notifications

  if (checking) {
    return <div className="p-8 text-center text-xs font-bold text-slate-400">読み込み中...</div>
  }

  if (!userId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative bg-cover bg-center" style={backgroundImageStyle}>
        <div className="absolute inset-0 bg-gradient-to-b from-sky-400/20 via-sky-100/10 to-sky-900/20 backdrop-blur-[2px] pointer-events-none -z-10" />
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

  return (
    <div className="min-h-screen pb-24 relative bg-cover bg-center" style={backgroundImageStyle}>
      <div className="absolute inset-0 bg-gradient-to-b from-sky-400/20 via-sky-100/10 to-sky-900/20 backdrop-blur-[2px] pointer-events-none -z-10" />
      <SimpleHeader label="通知一覧" />

      <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-8 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-lg font-black text-slate-800">通知一覧</h1>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllAsRead}
              className="text-[11px] font-bold text-sky-600 hover:underline cursor-pointer shrink-0"
            >
              すべて既読にする
            </button>
          )}
        </div>

        <div className="flex gap-1.5">
          {(['all', 'unread'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-[11px] font-bold rounded-xl transition cursor-pointer ${
                filter === f ? 'bg-sky-500 text-white' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {f === 'all' ? 'すべて' : `未読${unreadCount > 0 ? ` (${unreadCount})` : ''}`}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {visibleNotifications.length === 0 ? (
            <p className="text-center text-sm text-slate-500 font-bold py-16">
              {filter === 'unread' ? '未読の通知はありません' : 'まだ通知はありません'}
            </p>
          ) : (
            visibleNotifications.map((n) => (
              <Link
                key={n.id}
                href={n.link_url || '#'}
                onClick={() => {
                  if (!n.is_read) markAsRead(n.id)
                }}
                className={`block bg-white rounded-2xl p-4 border shadow-xs hover:shadow-md transition-all ${
                  n.is_read ? 'border-slate-100 opacity-70' : 'border-sky-200'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {!n.is_read && <span className="w-2 h-2 rounded-full bg-sky-500 mt-1.5 shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-800">{n.title}</p>
                    {n.body && (
                      <p className="text-xs text-slate-500 mt-1 whitespace-pre-wrap leading-relaxed">{n.body}</p>
                    )}
                    <p className="text-[10px] text-slate-300 mt-2">
                      {new Date(n.created_at).toLocaleString('ja-JP')}
                    </p>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>

        {hasMore && filter === 'all' && (
          <button
            type="button"
            onClick={() => userId && loadNotifications(userId, false)}
            disabled={loading}
            className="w-full py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-500 font-bold text-xs rounded-xl transition cursor-pointer disabled:opacity-50"
          >
            {loading ? '読み込み中...' : 'もっと見る'}
          </button>
        )}
      </div>
    </div>
  )
}
