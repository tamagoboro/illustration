'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

const REPORT_REASONS = [
  '無断転載・著作権侵害の疑い',
  'なりすまし・詐欺の疑い',
  '不適切な内容',
  'その他',
]

// 通報する対象。user_id は投稿者／コメントした人／募集を出した人
export type PostReportTarget = { type: 'post' | 'post_comment' | 'wanted_post'; id: string; user_id: string }

const REPORT_TITLES: Record<PostReportTarget['type'], string> = {
  post: 'この投稿を通報',
  post_comment: 'このコメントを通報',
  wanted_post: 'この募集を通報',
}

// フィードの投稿・コメントと、募集ボードの募集を通報するモーダル。
// クリエイターページの通報（プロフィール・作品）と同じ reports テーブルに、target_type を変えて保存する
// （supabase/improve_feed.sql / add_wanted_board.sql）。運営は /admin/reports で確認・削除できる。
export default function PostReportModal({
  target,
  onClose,
}: {
  target: PostReportTarget
  onClose: () => void
}) {
  const [reason, setReason] = useState(REPORT_REASONS[0])
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const { data: { user: reporter } } = await supabase.auth.getUser()
      const { error } = await supabase.from('reports').insert({
        reporter_id: reporter?.id || null,
        target_type: target.type,
        target_id: target.id,
        creator_id: target.user_id,
        reason,
        comment: comment.trim() || null,
      })
      if (error) throw error
      setSubmitted(true)
    } catch (error: any) {
      console.error('通報エラー:', error)
      // P0001 は連投防止チェックが意図的に発生させたエラーなので、内容をそのまま案内する
      const message =
        error?.code === 'P0001' && error?.message
          ? error.message
          : '通報の送信に失敗しました。時間をおいて再度お試しください。'
      alert(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-sky-950/70 backdrop-blur-md flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl border border-sky-100 relative">
        <button
          onClick={onClose}
          aria-label="閉じる"
          className="absolute top-4 right-4 text-slate-300 hover:text-slate-600 text-sm font-black cursor-pointer"
        >
          ✕
        </button>

        {submitted ? (
          <div className="text-center py-6 space-y-2">
            <p className="text-2xl">✅</p>
            <p className="text-sm font-bold text-slate-700">通報を受け付けました</p>
            <p className="text-xs text-slate-400">運営が内容を確認します。ご協力ありがとうございます。</p>
            <button
              onClick={onClose}
              className="mt-2 px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
            >
              閉じる
            </button>
          </div>
        ) : (
          <>
            <div>
              <h3 className="text-sm font-black text-slate-900">{REPORT_TITLES[target.type]}</h3>
              <p className="text-[11px] text-slate-400 mt-1">
                無断転載や規約違反の疑いがある場合にお知らせください。内容は運営のみが確認します。
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-700">通報理由</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white"
              >
                {REPORT_REASONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-700">詳細（任意）</label>
              <textarea
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="具体的な状況（元の作品のURLなど）が分かると助かります"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white resize-none"
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full py-3 bg-rose-500 hover:bg-rose-600 text-white font-extrabold rounded-xl text-xs transition disabled:opacity-50 cursor-pointer"
            >
              {submitting ? '送信中...' : '通報を送信する'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
