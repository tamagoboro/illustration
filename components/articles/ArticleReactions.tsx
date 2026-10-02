'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { copyText } from '@/lib/clipboard'

// 記事の「いいね・シェア・コメント」（テーブルは supabase/add_article_reactions.sql）。
// いいねとコメントはログインが必要。シェアは誰でもできる。
// 記事ページ本体は5分ごとに作り直す静的なページなので、ここだけブラウザから最新の状態を読み込む。

const COMMENT_MAX_LENGTH = 500
// Xでシェアしたときにもらえるポイント（supabase/add_article_share_points.sql の claim_article_share と合わせる）
const SHARE_POINTS = 50

type Comment = {
  id: string
  user_id: string
  content: string
  created_at: string
  name: string
  avatarUrl: string | null
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })

export default function ArticleReactions({ articleId, slug, title }: { articleId: string; slug: string; title: string }) {
  const [userId, setUserId] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [liked, setLiked] = useState(false)
  const [liking, setLiking] = useState(false)
  // この記事のシェアで、もうポイントを受け取ったか（ログインしていないときは null）
  const [shareClaimed, setShareClaimed] = useState<boolean | null>(null)
  const [comments, setComments] = useState<Comment[] | null>(null)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const loginHref = `/login?next=${encodeURIComponent(`/articles/${slug}`)}`

  const flash = (message: string) => {
    setNotice(message)
    setTimeout(() => setNotice(null), 3000)
  }

  const loadComments = useCallback(async () => {
    const { data, error } = await supabase
      .from('article_comments')
      .select('id, user_id, content, created_at')
      .eq('article_id', articleId)
      .order('created_at', { ascending: true })
    if (error) {
      console.error('記事コメントの取得エラー:', error)
      setComments([])
      return
    }
    const rows = data || []
    const ids = Array.from(new Set(rows.map((r) => r.user_id)))
    const { data: profiles } = ids.length
      ? await supabase.from('profiles').select('user_id, display_name, avatar_url').in('user_id', ids)
      : { data: [] as { user_id: string; display_name: string; avatar_url: string | null }[] }
    const map = new Map((profiles || []).map((p) => [p.user_id, p]))
    setComments(
      rows.map((r) => ({
        ...r,
        name: map.get(r.user_id)?.display_name || 'ユーザー',
        avatarUrl: map.get(r.user_id)?.avatar_url || null,
      }))
    )
  }, [articleId])

  useEffect(() => {
    let active = true
    const init = async () => {
      const { data } = await supabase.auth.getUser()
      const uid = data.user?.id ?? null
      const [countRes, mineRes, adminRes, shareRes] = await Promise.all([
        supabase.from('article_likes').select('*', { count: 'exact', head: true }).eq('article_id', articleId),
        uid
          ? supabase.from('article_likes').select('article_id').eq('article_id', articleId).eq('user_id', uid).maybeSingle()
          : Promise.resolve({ data: null }),
        uid ? supabase.from('admins').select('user_id').eq('user_id', uid).maybeSingle() : Promise.resolve({ data: null }),
        uid
          ? supabase.from('article_shares').select('article_id').eq('article_id', articleId).eq('user_id', uid).maybeSingle()
          : Promise.resolve({ data: null }),
      ])
      if (!active) return
      setUserId(uid)
      setLikeCount(countRes.count || 0)
      setLiked(!!mineRes.data)
      setIsAdmin(!!adminRes.data)
      setShareClaimed(uid ? !!shareRes.data : null)
    }
    init()
    loadComments()
    return () => {
      active = false
    }
  }, [articleId, loadComments])

  const toggleLike = async () => {
    if (!userId) return flash('いいねするにはログインが必要です')
    if (liking) return
    setLiking(true)
    const { error } = liked
      ? await supabase.from('article_likes').delete().eq('article_id', articleId).eq('user_id', userId)
      : await supabase.from('article_likes').insert({ article_id: articleId, user_id: userId })
    setLiking(false)
    // 23505 = すでにいいね済み（画面の表示が古かっただけ）なので、押した状態に直す
    if (error && error.code !== '23505') {
      console.error('記事いいねのエラー:', error)
      flash(`いいねできませんでした（${error.message}）`)
      return
    }
    if (error) return setLiked(true)
    setLiked(!liked)
    setLikeCount((c) => Math.max(0, c + (liked ? -1 : 1)))
  }

  const addComment = async (e: React.FormEvent) => {
    e.preventDefault()
    const text = input.trim()
    if (!userId || !text || sending) return
    if (text.length > COMMENT_MAX_LENGTH) return flash(`コメントは${COMMENT_MAX_LENGTH}文字以内で入力してください`)
    setSending(true)
    const { error } = await supabase.from('article_comments').insert({ article_id: articleId, user_id: userId, content: text })
    setSending(false)
    if (error) {
      console.error('記事コメントの送信エラー:', error)
      flash(`コメントを送信できませんでした（${error.message}）`)
      return
    }
    setInput('')
    await loadComments()
  }

  const deleteComment = async (comment: Comment) => {
    if (!confirm(comment.user_id === userId ? 'このコメントを削除しますか？' : '管理者として、このコメントを削除しますか？')) return
    const { error } = await supabase.from('article_comments').delete().eq('id', comment.id)
    if (error) {
      console.error('記事コメントの削除エラー:', error)
      flash('コメントを削除できませんでした')
      return
    }
    setComments((prev) => (prev || []).filter((c) => c.id !== comment.id))
  }

  const pageUrl = () => `${window.location.origin}/articles/${slug}`

  const shareOnX = () => {
    const text = `${title}｜Drawker`
    window.open(`https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(pageUrl())}`, '_blank', 'noopener,noreferrer')
    claimSharePoints()
  }

  // ログイン中なら、シェアのお礼にポイントを付ける（1記事につき1回。二重付与はDB側で防いでいる）
  const claimSharePoints = async () => {
    if (!userId || shareClaimed) return
    const { data, error } = await supabase.rpc('claim_article_share', { p_article_id: articleId })
    if (error) {
      console.error('シェアポイントの付与エラー:', error)
      return
    }
    setShareClaimed(true)
    if (data?.claimed) {
      flash(`🎉 シェアありがとうございます！${data.points}ptを獲得しました`)
      // 開いているページ（マイページなど）の残高表示を更新してもらう
      window.dispatchEvent(new CustomEvent('drawker:points-updated', { detail: { balance: data.balance } }))
    }
  }

  // スマホでは端末の共有メニュー、PCではリンクをコピー
  const shareOrCopy = async () => {
    const url = pageUrl()
    if (window.matchMedia?.('(pointer: coarse)').matches && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: `${title}｜Drawker`, url })
        return
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') return
      }
    }
    if (await copyText(url)) flash('🔗 リンクをコピーしました')
    else window.prompt('コピーできませんでした。下のURLを選択してコピーしてください。', url)
  }

  return (
    <section className="mt-12 pt-8 border-t border-slate-100 space-y-8">
      {/* いいね・シェア */}
      <div className="space-y-3">
        <p className="text-center text-xs font-bold text-slate-500">この記事が役に立ったら、いいね・シェアしてもらえるとうれしいです</p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            onClick={toggleLike}
            disabled={liking}
            aria-pressed={liked}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-black border-2 transition cursor-pointer disabled:opacity-50 active:scale-95 ${
              liked ? 'bg-rose-50 border-rose-200 text-rose-500' : 'bg-white border-slate-200 text-slate-500 hover:border-rose-200 hover:text-rose-500'
            }`}
          >
            <span className="text-base">{liked ? '♥' : '♡'}</span>
            <span>いいね</span>
            <span className="tabular-nums">{likeCount}</span>
          </button>
          <button
            onClick={shareOnX}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-black bg-slate-900 text-white hover:bg-slate-700 transition cursor-pointer"
          >
            𝕏 でシェア
            {shareClaimed !== true && (
              <span className="px-2 py-0.5 rounded-full bg-amber-300 text-amber-900 text-[10px] font-black">+{SHARE_POINTS}pt</span>
            )}
          </button>
          <button
            onClick={shareOrCopy}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-black border-2 border-slate-200 bg-white text-slate-600 hover:border-sky-300 hover:text-sky-600 transition cursor-pointer"
          >
            🔗 リンクを共有
          </button>
        </div>
        <p className="text-center text-[11px] font-bold text-slate-400">
          {shareClaimed === true
            ? `この記事のシェアポイント（${SHARE_POINTS}pt）は受け取り済みです`
            : shareClaimed === false
              ? `Xでシェアすると ${SHARE_POINTS}pt もらえます（1記事につき1回）`
              : `ログインしてXでシェアすると ${SHARE_POINTS}pt もらえます（1記事につき1回）`}
        </p>
        {notice && (
          <p role="status" className="text-center text-xs font-bold text-sky-700">
            {notice}
            {!userId && notice.includes('ログイン') && (
              <Link href={loginHref} className="ml-2 underline">
                ログインする
              </Link>
            )}
          </p>
        )}
      </div>

      {/* コメント */}
      <div className="space-y-4">
        <h2 className="text-base font-black text-slate-800">
          💬 コメント{comments && comments.length > 0 && <span className="ml-1 text-slate-400 tabular-nums">（{comments.length}）</span>}
        </h2>

        {comments === null ? (
          <p className="text-xs font-bold text-slate-400">読み込み中...</p>
        ) : comments.length === 0 ? (
          <p className="text-xs font-bold text-slate-400">まだコメントはありません。感想や質問をどうぞ！</p>
        ) : (
          <ul className="space-y-3">
            {comments.map((comment) => (
              <li key={comment.id} className="flex gap-3">
                <Link href={`/creator/${comment.user_id}`} className="shrink-0 w-9 h-9 rounded-full overflow-hidden bg-slate-100">
                  {comment.avatarUrl && <img src={comment.avatarUrl} alt="" className="w-full h-full object-cover" />}
                </Link>
                <div className="min-w-0 flex-1 bg-slate-50 rounded-2xl rounded-tl-md px-4 py-2.5">
                  <div className="flex flex-wrap items-center gap-x-2">
                    <span className="text-xs font-black text-slate-800">{comment.name}</span>
                    <span className="text-[10px] font-bold text-slate-400" suppressHydrationWarning>
                      {formatDate(comment.created_at)}
                    </span>
                    {(comment.user_id === userId || isAdmin) && (
                      <button onClick={() => deleteComment(comment)} className="text-[10px] font-bold text-slate-300 hover:text-rose-500 cursor-pointer">
                        削除{comment.user_id !== userId && '（運営）'}
                      </button>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-slate-700 whitespace-pre-wrap break-words">{comment.content}</p>
                </div>
              </li>
            ))}
          </ul>
        )}

        {userId ? (
          <form onSubmit={addComment} className="space-y-2">
            <textarea
              rows={3}
              maxLength={COMMENT_MAX_LENGTH}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="感想や、わからなかったところ、取り上げてほしい内容などをどうぞ"
              className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400 resize-none"
            />
            <div className="flex items-center justify-between">
              <span className={`text-[11px] font-bold tabular-nums ${input.length >= COMMENT_MAX_LENGTH - 20 ? 'text-rose-500' : 'text-slate-300'}`}>
                {input.length}/{COMMENT_MAX_LENGTH}
              </span>
              <button
                type="submit"
                disabled={!input.trim() || sending}
                className="px-6 py-2.5 rounded-full text-xs font-black bg-sky-500 text-white hover:bg-sky-600 disabled:opacity-40 cursor-pointer"
              >
                {sending ? '送信中...' : 'コメントする'}
              </button>
            </div>
          </form>
        ) : (
          <div className="rounded-2xl bg-sky-50 border border-sky-100 px-4 py-4 text-center space-y-2">
            <p className="text-xs font-bold text-slate-600">コメントといいねは、ログインするとできます</p>
            <Link href={loginHref} className="inline-block px-5 py-2 rounded-full text-xs font-black bg-sky-500 text-white hover:bg-sky-600">
              ログイン・新規登録
            </Link>
          </div>
        )}
      </div>
    </section>
  )
}
