'use client'

import { useEffect, useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { backgroundImageStyle } from '@/lib/background'
import SimpleHeader from '@/components/SimpleHeader'
import PostReportModal from '@/components/PostReportModal'
import {
  WantedPost,
  WantedApplication,
  PosterProfile,
  WANTED_POST_COLUMNS,
  WANTED_MESSAGE_MAX,
  normalizeWantedPost,
  isWantedOpen,
  todayInJapan,
  formatBudget,
  formatDate,
  formatYen,
  loadProfilesByIds,
  loadApplicationCounts,
} from '@/lib/wanted'

type ApplicantProfile = PosterProfile & { price_min: number | null }

const APPLICATION_COLUMNS = 'id, post_id, creator_id, message, proposed_price, created_at'

// 募集の詳細ページ。見る人によって出るものが変わる。
//   募集を出した本人 … 届いた応募の一覧、編集・締め切り・削除
//   クリエイター     … 応募フォーム（応募済みなら自分の応募と取り下げ）
//   それ以外         … 募集の内容と、応募するための案内
// 応募の内容は、DB側の権限（RLS）で「応募した本人」と「募集を出した人」にしか返ってこない。
export default function WantedDetailClient({ postId }: { postId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [post, setPost] = useState<WantedPost | null>(null)
  const [poster, setPoster] = useState<PosterProfile | null>(null)
  const [applicationCount, setApplicationCount] = useState(0)

  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isCreator, setIsCreator] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  // 募集を出した本人に見せる応募一覧
  const [applications, setApplications] = useState<WantedApplication[]>([])
  const [applicants, setApplicants] = useState<Record<string, ApplicantProfile>>({})
  // クリエイター本人の応募
  const [myApplication, setMyApplication] = useState<WantedApplication | null>(null)

  const [message, setMessage] = useState('')
  const [proposedPrice, setProposedPrice] = useState('')
  const [busy, setBusy] = useState(false)
  const [isReportOpen, setIsReportOpen] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)

  const today = todayInJapan()

  useEffect(() => {
    const load = async () => {
      const [{ data: row }, { data: userResp }] = await Promise.all([
        supabase.from('wanted_posts').select(WANTED_POST_COLUMNS).eq('id', postId).maybeSingle(),
        supabase.auth.getUser(),
      ])
      if (!row) {
        setLoading(false)
        return
      }
      const loaded = normalizeWantedPost(row)
      const uid = userResp.user?.id || null
      setPost(loaded)
      setCurrentUserId(uid)

      const [profileMap, countMap] = await Promise.all([
        loadProfilesByIds([loaded.user_id]),
        loadApplicationCounts([loaded.id]),
      ])
      setPoster(profileMap[loaded.user_id] || null)
      setApplicationCount(countMap[loaded.id] || 0)

      if (uid) {
        const [{ data: me }, { data: adminRow }] = await Promise.all([
          supabase.from('profiles').select('has_dashboard_setup').eq('user_id', uid).maybeSingle(),
          supabase.from('admins').select('user_id').eq('user_id', uid).maybeSingle(),
        ])
        setIsCreator(!!me?.has_dashboard_setup)
        setIsAdmin(!!adminRow)

        if (uid === loaded.user_id) {
          await loadApplications(loaded.id)
        } else {
          const { data: mine } = await supabase
            .from('wanted_applications')
            .select(APPLICATION_COLUMNS)
            .eq('post_id', loaded.id)
            .eq('creator_id', uid)
            .maybeSingle()
          setMyApplication((mine as WantedApplication | null) ?? null)
        }
      }
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId])

  const loadApplications = async (id: string) => {
    const { data, error } = await supabase
      .from('wanted_applications')
      .select(APPLICATION_COLUMNS)
      .eq('post_id', id)
      .order('created_at', { ascending: true })
    if (error) {
      console.error('応募の取得エラー:', error)
      return
    }
    const rows = (data || []) as WantedApplication[]
    setApplications(rows)
    setApplicationCount(rows.length)

    const creatorIds = Array.from(new Set(rows.map((r) => r.creator_id)))
    if (creatorIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url, price_min')
        .in('user_id', creatorIds)
      const map: Record<string, ApplicantProfile> = {}
      ;(profiles || []).forEach((p: any) => {
        map[p.user_id] = { display_name: p.display_name, avatar_url: p.avatar_url, price_min: p.price_min ?? null }
      })
      setApplicants(map)
    }
  }

  const handleApply = async (e: FormEvent) => {
    e.preventDefault()
    if (!post || !currentUserId || busy) return
    if (!message.trim()) return

    const trimmedPrice = proposedPrice.trim()
    const parsedPrice = trimmedPrice === '' ? null : Math.max(0, parseInt(trimmedPrice, 10) || 0)

    setBusy(true)
    const { data, error } = await supabase
      .from('wanted_applications')
      .insert({ post_id: post.id, creator_id: currentUserId, message: message.trim(), proposed_price: parsedPrice })
      .select(APPLICATION_COLUMNS)
      .maybeSingle()
    setBusy(false)

    if (error || !data) {
      console.error('応募エラー:', error)
      // P0001 はDB側のチェック（締切・クリエイター登録の有無など）が意図的に出したエラーなので、内容をそのまま案内する
      alert(
        error?.code === 'P0001' && error.message
          ? error.message
          : error?.code === '23505'
            ? 'この募集にはすでに応募しています。'
            : '応募に失敗しました。時間をおいて、もう一度お試しください。'
      )
      return
    }
    setMyApplication(data as WantedApplication)
    setApplicationCount((c) => c + 1)
    setMessage('')
    setProposedPrice('')
  }

  const handleWithdraw = async () => {
    if (!myApplication || busy) return
    if (!confirm('応募を取り下げますか？')) return

    setBusy(true)
    const { error } = await supabase.from('wanted_applications').delete().eq('id', myApplication.id)
    setBusy(false)
    if (error) {
      console.error('応募の取り下げエラー:', error)
      alert('取り下げに失敗しました。時間をおいて、もう一度お試しください。')
      return
    }
    setMyApplication(null)
    setApplicationCount((c) => Math.max(0, c - 1))
  }

  // 募集を締め切る／もう一度受け付ける
  const handleToggleStatus = async () => {
    if (!post || busy) return
    const nextStatus = post.status === 'open' ? 'closed' : 'open'
    if (nextStatus === 'closed' && !confirm('この募集を締め切りますか？（あとから受付を再開できます）')) return

    setBusy(true)
    const { error } = await supabase.from('wanted_posts').update({ status: nextStatus }).eq('id', post.id)
    setBusy(false)
    if (error) {
      console.error('募集の状態変更エラー:', error)
      alert('変更に失敗しました。時間をおいて、もう一度お試しください。')
      return
    }
    setPost({ ...post, status: nextStatus })
  }

  const handleDelete = async () => {
    if (!post || busy) return
    const isOwner = currentUserId === post.user_id
    const messageText = isOwner
      ? 'この募集を削除しますか？届いた応募も一緒に消え、元に戻せません。'
      : '管理者としてこの募集を削除しますか？届いた応募も一緒に消え、元に戻せません。'
    if (!confirm(messageText)) return

    setBusy(true)
    const { error } = await supabase.from('wanted_posts').delete().eq('id', post.id)
    setBusy(false)
    if (error) {
      console.error('募集の削除エラー:', error)
      alert('削除に失敗しました。時間をおいて、もう一度お試しください。')
      return
    }
    router.push('/wanted')
  }

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/wanted/${postId}`
    try {
      await navigator.clipboard.writeText(url)
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    } catch {
      window.prompt('コピーできませんでした。下のURLを選択してコピーしてください。', url)
    }
  }

  const handleShareOnX = () => {
    if (!post) return
    const url = `${window.location.origin}/wanted/${post.id}`
    // ハッシュタグは2個まで（Xは3個以上付けると検索に出にくくなると言われているため）
    const text = `【クリエイター募集】${post.title}\n予算: ${formatBudget(post)}\n\n#絵師募集 #イラスト依頼`
    window.open(
      `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
      '_blank',
      'noopener,noreferrer'
    )
  }

  const shell = (children: React.ReactNode) => (
    <div className="min-h-screen pb-24 relative bg-cover bg-center" style={backgroundImageStyle}>
      <div className="absolute inset-0 bg-gradient-to-b from-sky-400/20 via-sky-100/10 to-sky-900/20 backdrop-blur-[2px] pointer-events-none -z-10" />
      <SimpleHeader label="募集ボード" />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-8 space-y-5">
        <div className="px-1">
          <Link
            href="/wanted"
            className="inline-flex items-center gap-1.5 text-[11px] font-black text-sky-700 bg-white/90 hover:bg-white border border-white/70 px-4 py-2 rounded-full shadow-2xs transition"
          >
            ← 募集ボードに戻る
          </Link>
        </div>
        {children}
      </div>
    </div>
  )

  if (loading) {
    return shell(<p className="text-xs text-slate-600 font-bold drop-shadow-sm text-center py-8">読み込み中...</p>)
  }

  if (!post) {
    return shell(
      <div className="text-center py-16 px-4 bg-white/85 backdrop-blur-md rounded-3xl border border-white/70 space-y-2">
        <p className="text-sm font-black text-slate-600">この募集は見つかりませんでした</p>
        <p className="text-[11px] text-slate-400 font-bold">削除されたか、URLが間違っている可能性があります</p>
      </div>
    )
  }

  const isOwner = currentUserId === post.user_id
  const open = isWantedOpen(post, today)
  const posterName = poster?.display_name || 'ユーザー'
  const cardClass = 'bg-white/95 backdrop-blur-md rounded-3xl p-5 sm:p-6 border border-white/70 shadow-sm'

  return shell(
    <>
      {/* 募集の内容 */}
      <article className={`${cardClass} space-y-4`}>
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-lg sm:text-xl font-black text-slate-800 leading-snug break-words min-w-0">{post.title}</h1>
          <span
            className={`shrink-0 text-[10px] font-black px-2.5 py-1 rounded-full ${
              open ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
            }`}
          >
            {open ? '募集中' : '締切'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="shrink-0 w-7 h-7 rounded-full overflow-hidden bg-sky-100">
            {poster?.avatar_url && <img src={poster.avatar_url} alt="" className="w-full h-full object-cover" />}
          </div>
          <span className="text-xs font-bold text-slate-600 truncate">{posterName}</span>
          <span className="text-[10px] font-bold text-slate-400 shrink-0">{formatDate(post.created_at)} に掲載</span>
        </div>

        <dl className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-3 rounded-2xl bg-sky-50/70 border border-sky-100">
            <dt className="text-[10px] font-bold text-slate-400">予算</dt>
            <dd className="font-black text-sky-700 mt-0.5">{formatBudget(post)}</dd>
          </div>
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
            <dt className="text-[10px] font-bold text-slate-400">希望納期</dt>
            <dd className="font-black text-slate-700 mt-0.5">{post.desired_deadline ? formatDate(post.desired_deadline) : '相談して決めたい'}</dd>
          </div>
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
            <dt className="text-[10px] font-bold text-slate-400">募集の締切</dt>
            <dd className="font-black text-slate-700 mt-0.5">{post.apply_until ? formatDate(post.apply_until) : '決まり次第'}</dd>
          </div>
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
            <dt className="text-[10px] font-bold text-slate-400">商用利用</dt>
            <dd className="font-black text-slate-700 mt-0.5">{post.commercial_use ? '予定あり' : '予定なし'}</dd>
          </div>
        </dl>

        {post.tastes.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {post.tastes.map((taste) => (
              <span key={taste} className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-pink-50 text-pink-600">
                #{taste}
              </span>
            ))}
          </div>
        )}

        {post.description && (
          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap break-words">{post.description}</p>
        )}

        <div className="flex items-center gap-1 flex-wrap pt-3 border-t border-slate-100">
          <span className="text-[11px] font-black text-sky-600 mr-auto">応募 {applicationCount}件</span>
          <button
            onClick={handleCopyLink}
            className={`text-[11px] font-black px-3 py-1.5 rounded-full transition cursor-pointer ${
              linkCopied ? 'text-sky-600 bg-sky-50' : 'text-slate-400 hover:text-sky-600 hover:bg-sky-50'
            }`}
          >
            🔗 {linkCopied ? 'コピー済み' : 'リンク'}
          </button>
          <button
            onClick={handleShareOnX}
            className="text-[11px] font-black px-3 py-1.5 rounded-full text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer"
          >
            𝕏 シェア
          </button>
          {!isOwner && (
            <button
              onClick={() => setIsReportOpen(true)}
              className="text-[11px] font-bold px-3 py-1.5 rounded-full text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition cursor-pointer"
            >
              通報
            </button>
          )}
        </div>
      </article>

      {/* 募集を出した本人：操作と、届いた応募 */}
      {isOwner && (
        <>
          <div className={`${cardClass} flex flex-wrap items-center gap-2`}>
            <Link
              href={`/wanted/new?id=${post.id}`}
              className="text-xs font-black text-sky-700 bg-sky-50 hover:bg-sky-100 px-4 py-2 rounded-full transition"
            >
              編集する
            </Link>
            <button
              onClick={handleToggleStatus}
              disabled={busy}
              className="text-xs font-black text-slate-600 bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-full transition cursor-pointer disabled:opacity-50"
            >
              {post.status === 'open' ? '募集を締め切る' : '受付を再開する'}
            </button>
            <button
              onClick={handleDelete}
              disabled={busy}
              className="text-xs font-bold text-rose-500 hover:bg-rose-50 px-4 py-2 rounded-full transition cursor-pointer disabled:opacity-50 ml-auto"
            >
              削除する
            </button>
          </div>

          <section className={`${cardClass} space-y-3`}>
            <div>
              <h2 className="text-sm font-black text-slate-800">届いた応募（{applications.length}件）</h2>
              <p className="text-[11px] text-slate-400 font-bold mt-0.5">
                応募の内容は、あなたと応募した本人にしか見えません。気になる人のページを開いて、そのまま依頼の相談ができます。
              </p>
            </div>

            {applications.length === 0 ? (
              <p className="text-xs text-slate-400 font-bold text-center py-4">
                まだ応募はありません。「𝕏 シェア」で募集を知らせると、見つけてもらいやすくなります。
              </p>
            ) : (
              <div className="space-y-3">
                {applications.map((application) => {
                  const applicant = applicants[application.creator_id]
                  return (
                    <div key={application.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2.5">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="shrink-0 w-9 h-9 rounded-full overflow-hidden bg-sky-100">
                            {applicant?.avatar_url && (
                              <img src={applicant.avatar_url} alt="" className="w-full h-full object-cover" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-black text-slate-800 truncate">{applicant?.display_name || 'クリエイター'}</p>
                            <p className="text-[10px] font-bold text-slate-400">
                              {formatDate(application.created_at)} に応募
                              {applicant?.price_min ? ` ／ 参考最低価格 ${formatYen(applicant.price_min)}〜` : ''}
                            </p>
                          </div>
                        </div>
                        <Link
                          href={`/creator/${application.creator_id}`}
                          target="_blank"
                          className="shrink-0 text-[11px] font-black text-white bg-sky-500 hover:bg-sky-600 px-4 py-2 rounded-full transition"
                        >
                          作品を見て依頼する →
                        </Link>
                      </div>
                      {application.proposed_price !== null && (
                        <p className="text-xs font-black text-sky-700">希望金額: {formatYen(application.proposed_price)}</p>
                      )}
                      <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap break-words">{application.message}</p>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </>
      )}

      {/* 募集を出した本人以外：応募 */}
      {!isOwner && (
        <section className={`${cardClass} space-y-3`}>
          <h2 className="text-sm font-black text-slate-800">この募集に応募する</h2>

          {myApplication ? (
            <div className="space-y-2.5">
              <p className="text-xs font-black text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3">
                ✓ 応募済みです。募集した人があなたのページを見て、依頼の相談を送ります。
              </p>
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1.5">
                {myApplication.proposed_price !== null && (
                  <p className="text-xs font-black text-sky-700">希望金額: {formatYen(myApplication.proposed_price)}</p>
                )}
                <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap break-words">{myApplication.message}</p>
              </div>
              <button
                onClick={handleWithdraw}
                disabled={busy}
                className="text-[11px] font-bold text-rose-500 hover:underline cursor-pointer disabled:opacity-50"
              >
                応募を取り下げる
              </button>
            </div>
          ) : !open ? (
            <p className="text-xs text-slate-500 font-bold">この募集は締め切られました。</p>
          ) : !currentUserId ? (
            <div className="space-y-2.5">
              <p className="text-xs text-slate-600 font-medium leading-relaxed">
                応募するには、クリエイターとして登録（無料）が必要です。応募したことは、募集した人以外には見えません。
              </p>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/login?signup=creator"
                  className="text-xs font-black text-white bg-sky-500 hover:bg-sky-600 px-5 py-2.5 rounded-full shadow-sm transition"
                >
                  無料でクリエイター登録する
                </Link>
                <Link
                  href="/login"
                  className="text-xs font-black text-sky-700 bg-white border border-sky-200 hover:bg-sky-50 px-5 py-2.5 rounded-full transition"
                >
                  ログイン
                </Link>
              </div>
            </div>
          ) : !isCreator ? (
            <div className="space-y-2.5">
              <p className="text-xs text-slate-600 font-medium leading-relaxed">
                応募できるのは、ポートフォリオを登録したクリエイターです。ダッシュボードで作品と料金の目安を登録すると、応募できるようになります。
              </p>
              <Link
                href="/dashboard"
                className="inline-block text-xs font-black text-white bg-sky-500 hover:bg-sky-600 px-5 py-2.5 rounded-full shadow-sm transition"
              >
                ダッシュボードでポートフォリオを作る →
              </Link>
            </div>
          ) : (
            <form onSubmit={handleApply} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  メッセージ <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={5}
                  required
                  maxLength={WANTED_MESSAGE_MAX}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="対応できる内容・納期の目安・近い作例などを書いてください。あなたのポートフォリオへのリンクは自動で伝わります。"
                  className="w-full px-3 py-2.5 rounded-xl border border-sky-100 bg-white text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400 resize-y leading-relaxed"
                />
                <p className="text-[10px] text-slate-400 mt-1 text-right tabular-nums">
                  {message.length}/{WANTED_MESSAGE_MAX}
                </p>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">希望金額（任意）</label>
                <div className="relative max-w-xs">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-semibold">¥</span>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    value={proposedPrice}
                    onChange={(e) => setProposedPrice(e.target.value)}
                    placeholder="10000"
                    className="w-full pl-7 pr-3 py-2.5 rounded-xl border border-sky-100 bg-white text-sm font-bold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400"
                  />
                </div>
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                応募の内容は、募集した人とあなたにしか見えません。連絡先などの個人情報は書かず、やり取りは依頼の相談が届いてから行ってください。
              </p>
              <button
                type="submit"
                disabled={busy || !message.trim()}
                className="w-full py-3 bg-gradient-to-r from-sky-500 to-cyan-500 hover:brightness-105 text-white font-black rounded-2xl transition text-sm shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-95"
              >
                {busy ? '送信中...' : 'この内容で応募する'}
              </button>
            </form>
          )}
        </section>
      )}

      {/* 管理者：通報がなくても削除できる */}
      {isAdmin && !isOwner && (
        <div className={`${cardClass} flex items-center justify-between gap-3`}>
          <p className="text-[11px] font-bold text-rose-500">🛡️ 管理者メニュー</p>
          <button
            onClick={handleDelete}
            disabled={busy}
            className="text-xs font-black text-rose-700 bg-rose-50 hover:bg-rose-100 px-4 py-2 rounded-full transition cursor-pointer disabled:opacity-50"
          >
            この募集を削除する
          </button>
        </div>
      )}

      {isReportOpen && (
        <PostReportModal
          target={{ type: 'wanted_post', id: post.id, user_id: post.user_id }}
          onClose={() => setIsReportOpen(false)}
        />
      )}
    </>
  )
}
