'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Bell } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type NotificationRow = {
  id: string
  type: string
  title: string
  body: string | null
  link_url: string | null
  is_read: boolean
  created_at: string
}

// ヘッダーに置くだけで、ログイン中のユーザー宛の通知（新着リクエスト・お気に入りクリエイターの
// 受付再開など）をベルアイコン＋未読バッジで表示する。未ログイン時は何も表示しない。
export default function NotificationBell() {
  const [userId, setUserId] = useState<string | null>(null)
  const [notifications, setNotifications] = useState<NotificationRow[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const unreadCount = notifications.filter((n) => !n.is_read).length

  const refreshNotifications = async (uid: string) => {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(20)

    if (!error && data) setNotifications(data as NotificationRow[])
  }

  useEffect(() => {
    let isMounted = true
    supabase.auth.getUser().then(({ data }) => {
      const uid = data?.user?.id || null
      if (!isMounted) return
      setUserId(uid)
      if (uid) refreshNotifications(uid)
    })
    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
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

  if (!userId) return null

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-label="通知"
        className="relative w-9 h-9 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer"
      >
        <Bell size={18} strokeWidth={2} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[15px] h-[15px] px-[3px] rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 max-w-[90vw] bg-white rounded-2xl border border-slate-200 shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <span className="text-xs font-black text-slate-800">通知</span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="text-[10px] font-bold text-sky-600 hover:underline cursor-pointer"
              >
                すべて既読にする
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="text-xs text-slate-300 text-center py-8">通知はありません</p>
            ) : (
              notifications.map((n) => (
                <Link
                  key={n.id}
                  href={n.link_url || '#'}
                  onClick={() => {
                    if (!n.is_read) markAsRead(n.id)
                    setIsOpen(false)
                  }}
                  className={`block px-4 py-3 border-b border-slate-50 hover:bg-slate-50 transition-colors ${
                    n.is_read ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {!n.is_read && <span className="w-1.5 h-1.5 rounded-full bg-sky-500 mt-1.5 shrink-0" />}
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800">{n.title}</p>
                      {n.body && <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">{n.body}</p>}
                      <p className="text-[10px] text-slate-300 mt-1">
                        {new Date(n.created_at).toLocaleString('ja-JP')}
                      </p>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
