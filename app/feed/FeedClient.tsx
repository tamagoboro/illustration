'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { convertToWebp } from '@/lib/imageUtils'
import { extractStoragePath } from '@/lib/storageUtils'
import AvatarRing from '@/components/AvatarRing'
import ProtectedImage from '@/components/ProtectedImage'
import PostReportModal, { PostReportTarget } from '@/components/PostReportModal'
import { BlockKind, loadUserBlocks, setUserBlock } from '@/lib/userBlocks'
import { backgroundImageStyle } from '@/lib/background'
import SimpleHeader from '@/components/SimpleHeader'

type Comment = {
  id: string
  user_id: string
  content: string
  created_at: string
  profiles: {
    display_name: string
    avatar_url: string | null
  } | null
}

type PostWithAuthor = {
  id: string
  user_id: string
  content: string
  image_urls: string[]
  is_sensitive: boolean
  created_at: string
  profiles: {
    display_name: string
    avatar_url: string | null
  } | null
  likes_count: number
  comments_count: number
  is_liked_by_me: boolean
}

type FeedTab = 'all' | 'following'

// 「⋯」メニュー（通報・ミュート・ブロック・管理者による削除）を開いている対象
type ActionTarget =
  | { kind: 'post'; post: PostWithAuthor }
  | { kind: 'comment'; postId: string; comment: Comment }

const FEED_PAGE_SIZE = 30
// supabase/improve_feed.sql の posts_content_length / post_comments_content_length と合わせる
const POST_MAX_LENGTH = 500

// 「何を書けばいいか分からない」を減らすための話題。押すと本文の末尾にハッシュタグが付き、入力欄の例文が変わる
const POST_TOPICS = [
  { tag: '#制作中', label: '🎨 今やってること', placeholder: '今描いているもの、作業の進み具合、こだわっているところなど' },
  { tag: '#質問', label: '❓ わからないこと', placeholder: '例：IRIAMの立ち絵を頼まれたけど、パーツ分けって必要？みんなは料金どうしてる？' },
  { tag: '#依頼募集中', label: '📮 依頼がほしい', placeholder: '例：アイコン・立ち絵の依頼を受付中です！得意な絵柄や料金、空き枠を書いておくと見つけてもらいやすくなります' },
  { tag: '#依頼したい', label: '🙋 描いてほしい', placeholder: '例：VTuberデビュー用の立ち絵を描いてくれる方を探しています。ふんわりした雰囲気が好きです' },
  { tag: '#雑談', label: '☕ 雑談', placeholder: '最近うれしかったこと、使っている画材やソフト、なんでもどうぞ' },
  { tag: '#はじめまして', label: '👋 自己紹介', placeholder: '例：はじめまして！普段はSDキャラを描いています。仲良くしてください' },
]
const DEFAULT_PLACEHOLDER = 'わからないこと、依頼がほしい、今描いているもの…なんでも気軽にどうぞ！（#ハッシュタグ も使えます）'
const COMMENT_MAX_LENGTH = 500
// 「人気のタグ」を数える対象（タグ付きの新しい投稿から何件まで見るか）
const POPULAR_TAG_SAMPLE_SIZE = 200

// 一覧では、いいね・コメントは件数だけを取る（全行を取ると投稿や反応が増えるほど重くなるため）。
// コメントの本文は、コメント欄を開いたときにその投稿の分だけ読み込む。
const POST_SELECT_WITH_COUNTS = `
  *,
  profiles:user_id (display_name, avatar_url),
  post_likes (count),
  post_comments (count)
`
// 件数だけの取得ができない環境向けの予備（行を取って数える）
const POST_SELECT_WITH_ROWS = `
  *,
  profiles:user_id (display_name, avatar_url),
  post_likes (user_id),
  post_comments (id)
`
const COMMENT_SELECT = 'id, user_id, content, created_at, profiles:user_id (display_name, avatar_url)'

// 件数だけ取った場合は [{ count: n }]、行を取った場合は行の配列で返ってくる。どちらでも件数にする
const countOf = (rel: any): number => {
  if (!Array.isArray(rel)) return 0
  return typeof rel[0]?.count === 'number' ? rel[0].count : rel.length
}

// ilike の検索文字列で特別な意味を持つ文字（% _ \）を、文字そのものとして扱わせる
const escapeLikePattern = (text: string) => text.replace(/[\\%_]/g, '\\$&')

// 「3分前」「2日前」のような相対表記。1週間以上前は日付で表示する
const formatRelativeTime = (iso: string) => {
  const diffSec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diffSec < 60) return 'たった今'
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}分前`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}時間前`
  if (diffSec < 86400 * 7) return `${Math.floor(diffSec / 86400)}日前`
  return new Date(iso).toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' })
}

// フィードの画面本体。postId を渡すと、その投稿1件だけを表示する個別ページ（/feed/[postId]）になる。
// 投稿の表示・いいね・コメント・編集の処理を一覧と個別ページで二重に持たないよう、同じ部品を使い回している。
export default function FeedClient({ postId }: { postId?: string }) {
  const isSinglePost = !!postId
  const [currentUser, setCurrentUser] = useState<any>(null)
  // いいねの連打で二重送信になったり、失敗時に表示だけ変わってDBと食い違ったりするのを防ぐ
  const [likingPostIds, setLikingPostIds] = useState<Set<string>>(new Set())
  const [posts, setPosts] = useState<PostWithAuthor[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [ringMap, setRingMap] = useState<Record<string, string | null>>({})
  // 絞り込みを続けて切り替えたとき、先に出した古い読み込みの結果で画面を上書きしないための通し番号
  const requestSeq = useRef(0)

  // 新規投稿ステート
  const [content, setContent] = useState('')
  const postInputRef = useRef<HTMLTextAreaElement>(null)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [previewUrls, setPreviewUrls] = useState<string[]>([])
  const [isSensitive, setIsSensitive] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // 絞り込みステート（どれもサーバー側で絞り込むので、読み込み済みの投稿だけでなく全投稿が対象になる）
  const [feedTab, setFeedTab] = useState<FeedTab>('all')
  const [searchTag, setSearchTag] = useState('')
  const [imagesOnly, setImagesOnly] = useState(false)
  // フォロー中の人数（「フォロー中」タブを開くまでは null）
  const [followingCount, setFollowingCount] = useState<number | null>(null)
  const [popularTags, setPopularTags] = useState<[string, number][]>([])

  // 編集ステート
  const [editingPostId, setEditingPostId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [editSensitive, setEditSensitive] = useState(false)

  // コメント展開・入力ステート
  // 個別ページでは最初からコメント欄を開いておく
  const [openCommentPostId, setOpenCommentPostId] = useState<string | null>(postId ?? null)
  const [commentInput, setCommentInput] = useState('')
  const [commentsByPost, setCommentsByPost] = useState<Record<string, Comment[]>>({})
  const [isSendingComment, setIsSendingComment] = useState(false)

  // 「リンク」を押してURLをコピーした直後の投稿（ボタンの表示を一時的に切り替える）
  const [copiedPostId, setCopiedPostId] = useState<string | null>(null)
  const [reportTarget, setReportTarget] = useState<PostReportTarget | null>(null)
  const [actionTarget, setActionTarget] = useState<ActionTarget | null>(null)
  // 管理者は、通報を待たずに「⋯」メニューから投稿・コメントを削除できる
  const [isAdmin, setIsAdmin] = useState(false)

  // 自分がブロック・ミュートしている相手（相手のユーザーID → 種類）。その人の投稿・コメントは出さない。
  // 投稿の読み込み（fetchPosts）の中でも使うので、最新の値を ref にも持つ
  const [blockMap, setBlockMap] = useState<Record<string, BlockKind>>({})
  const blockMapRef = useRef<Record<string, BlockKind> | null>(null)

  // 表示まわりのステート
  const [myAvatarUrl, setMyAvatarUrl] = useState<string | null>(null)
  const [revealedPostIds, setRevealedPostIds] = useState<Set<string>>(new Set())
  const [lightbox, setLightbox] = useState<{ urls: string[]; index: number; name: string } | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      setCurrentUser(data.user)
      if (data.user) {
        const { data: me } = await supabase
          .from('profiles')
          .select('avatar_url')
          .eq('user_id', data.user.id)
          .maybeSingle()
        setMyAvatarUrl(me?.avatar_url ?? null)

        const { data: adminRow } = await supabase
          .from('admins')
          .select('user_id')
          .eq('user_id', data.user.id)
          .maybeSingle()
        setIsAdmin(!!adminRow)
      }
    })
    if (isSinglePost) return
    // 個別ページのハッシュタグから /feed?tag=... で来たときは、そのタグで絞り込んだ状態で開く
    const tag = new URLSearchParams(window.location.search).get('tag')
    if (tag) setSearchTag(tag)
    fetchPopularTags()
  }, [])

  // 最初の表示と、絞り込み（タブ・タグ・画像つき）を変えたときに1ページ目から読み込む
  useEffect(() => {
    fetchPosts()
  }, [feedTab, searchTag, imagesOnly])

  // コメント欄を開いたときに、その投稿のコメントを読み込む
  useEffect(() => {
    if (openCommentPostId && !commentsByPost[openCommentPostId]) fetchComments(openCommentPostId)
  }, [openCommentPostId])

  // 拡大表示中は背景スクロールを止め、Esc/←/→ で操作できるようにする
  useEffect(() => {
    if (!lightbox) return
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(null)
      if (e.key === 'ArrowRight')
        setLightbox((lb) => (lb ? { ...lb, index: (lb.index + 1) % lb.urls.length } : lb))
      if (e.key === 'ArrowLeft')
        setLightbox((lb) => (lb ? { ...lb, index: (lb.index - 1 + lb.urls.length) % lb.urls.length } : lb))
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = 'unset'
      window.removeEventListener('keydown', onKey)
    }
  }, [lightbox])

  // 装着中のアイコンリングをまとめて取得して ringMap に足す
  const fetchRings = async (userIds: string[]) => {
    if (userIds.length === 0) return
    const { data: ringsData } = await supabase
      .from('public_equipped_rings')
      .select('user_id, equipped_ring_id')
      .in('user_id', userIds)
    setRingMap((prev) => {
      const merged = { ...prev }
      ;(ringsData || []).forEach((r: any) => {
        merged[r.user_id] = r.equipped_ring_id
      })
      return merged
    })
  }

  const fetchPosts = async (pageToLoad = 0, append = false) => {
    const seq = ++requestSeq.current
    if (append) setLoadingMore(true)
    else setLoading(true)

    const finish = (rows: PostWithAuthor[], more: boolean) => {
      if (seq !== requestSeq.current) {
        // 途中で絞り込みが変わり、新しい読み込みに置き換わった。結果は捨てる
        if (append) setLoadingMore(false)
        return
      }
      setPosts((prev) => (append ? [...prev, ...rows] : rows))
      setPage(pageToLoad)
      setHasMore(more)
      if (append) setLoadingMore(false)
      else setLoading(false)
    }

    const { data: userResp } = await supabase.auth.getUser()
    const activeUserId = userResp.user?.id

    // ブロック・ミュートしている相手（最初の読み込みのときに1回だけ取得する）
    if (activeUserId && !blockMapRef.current) {
      blockMapRef.current = await loadUserBlocks(activeUserId)
      setBlockMap(blockMapRef.current)
    }
    const hiddenUserIds = Object.keys(blockMapRef.current || {})

    // 「フォロー中」タブ：フォローしているクリエイターの投稿だけに絞る
    let followingIds: string[] | null = null
    if (!postId && feedTab === 'following') {
      if (!activeUserId) return finish([], false)
      const { data: follows } = await supabase
        .from('creator_follows')
        .select('creator_id')
        .eq('follower_id', activeUserId)
      followingIds = (follows || []).map((f: any) => f.creator_id as string)
      if (seq === requestSeq.current) setFollowingCount(followingIds.length)
      if (followingIds.length === 0) return finish([], false)
    }

    const from = pageToLoad * FEED_PAGE_SIZE
    const to = from + FEED_PAGE_SIZE - 1

    const runQuery = (select: string) => {
      let query = supabase.from('posts').select(select)
      // 個別ページはURLを直接開いているので、ブロック・ミュート中の相手の投稿でもそのまま表示する
      if (postId) return query.eq('id', postId)
      if (hiddenUserIds.length > 0) query = query.not('user_id', 'in', `(${hiddenUserIds.join(',')})`)
      if (followingIds) query = query.in('user_id', followingIds)
      if (searchTag) query = query.ilike('content', `%${escapeLikePattern(searchTag)}%`)
      if (imagesOnly) query = query.neq('image_urls', '{}')
      return query.order('created_at', { ascending: false }).range(from, to)
    }

    let { data, error } = await runQuery(POST_SELECT_WITH_COUNTS)
    if (error) {
      console.error('投稿の取得エラー（件数のみの取得に失敗したため、行を取得して数えます）:', error)
      ;({ data, error } = await runQuery(POST_SELECT_WITH_ROWS))
    }
    if (error || !data) {
      console.error('投稿の取得エラー:', error)
      return finish([], false)
    }

    const rows = data as unknown as any[]
    const postIds = rows.map((p) => p.id as string)

    // 自分がいいね済みの投稿
    const likedIds = new Set<string>()
    if (activeUserId && postIds.length > 0) {
      const { data: myLikes } = await supabase
        .from('post_likes')
        .select('post_id')
        .eq('user_id', activeUserId)
        .in('post_id', postIds)
      ;(myLikes || []).forEach((l: any) => likedIds.add(l.post_id))
    }

    const formatted: PostWithAuthor[] = rows.map(({ post_likes, post_comments, ...post }) => ({
      ...post,
      image_urls: post.image_urls || [],
      likes_count: countOf(post_likes),
      comments_count: countOf(post_comments),
      is_liked_by_me: likedIds.has(post.id),
    }))

    finish(formatted, !postId && rows.length === FEED_PAGE_SIZE)
    fetchRings(Array.from(new Set(formatted.map((p) => p.user_id))))
  }

  const handleLoadMore = () => {
    if (loadingMore || !hasMore) return
    fetchPosts(page + 1, true)
  }

  // よく使われているハッシュタグ。タグ付きの新しい投稿から数える（絞り込み中でも中身は変わらない）
  const fetchPopularTags = async () => {
    const { data } = await supabase
      .from('posts')
      .select('content')
      .like('content', '%#%')
      .order('created_at', { ascending: false })
      .limit(POPULAR_TAG_SAMPLE_SIZE)

    const counts: Record<string, number> = {}
    ;(data || []).forEach((p: any) => {
      new Set<string>((p.content as string).match(/#[^\s#]+/g) || []).forEach((tag) => {
        counts[tag] = (counts[tag] || 0) + 1
      })
    })
    setPopularTags(
      Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12)
    )
  }

  const fetchComments = async (targetPostId: string) => {
    const { data, error } = await supabase
      .from('post_comments')
      .select(COMMENT_SELECT)
      .eq('post_id', targetPostId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('コメントの取得エラー:', error)
      return
    }
    const comments = (data || []) as unknown as Comment[]
    setCommentsByPost((prev) => ({ ...prev, [targetPostId]: comments }))
    // 一覧の件数は読み込み時点のものなので、実際の件数に合わせ直す
    setPosts((prev) => prev.map((p) => (p.id === targetPostId ? { ...p, comments_count: comments.length } : p)))
    fetchRings(Array.from(new Set(comments.map((c) => c.user_id))))
  }

  // 画像選択処理
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return
    const files = Array.from(e.target.files)

    if (selectedFiles.length + files.length > 4) {
      alert('画像は最大4枚まで選択可能です')
      return
    }

    const updatedFiles = [...selectedFiles, ...files].slice(0, 4)
    setSelectedFiles(updatedFiles)
    setPreviewUrls(updatedFiles.map((file) => URL.createObjectURL(file)))
  }

  const removeFile = (index: number) => {
    const updatedFiles = selectedFiles.filter((_, i) => i !== index)
    setSelectedFiles(updatedFiles)
    setPreviewUrls(updatedFiles.map((file) => URL.createObjectURL(file)))
    if (updatedFiles.length === 0) setIsSensitive(false)
  }

  // 新規投稿
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentUser) return alert('投稿するにはログインが必要です')
    if (!content.trim() && selectedFiles.length === 0) return
    if (content.length > POST_MAX_LENGTH) return alert(`文字数は${POST_MAX_LENGTH}文字までにしてください`)

    setIsSubmitting(true)
    try {
      const uploadedImageUrls: string[] = []

      for (const file of selectedFiles) {
        const webpBlob = await convertToWebp(file, 0.85, 1600)
        const fileName = `${currentUser.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.webp`

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('portfolios')
          .upload(fileName, webpBlob, { contentType: 'image/webp' })

        if (uploadError) throw uploadError

        const { data: publicUrlData } = supabase.storage
          .from('portfolios')
          .getPublicUrl(uploadData.path)

        uploadedImageUrls.push(publicUrlData.publicUrl)
      }

      const { error: insertError } = await supabase.from('posts').insert({
        user_id: currentUser.id,
        content: content.trim(),
        image_urls: uploadedImageUrls,
        // ぼかすのは画像だけなので、画像が無い投稿には付けない
        is_sensitive: isSensitive && uploadedImageUrls.length > 0,
      })

      if (insertError) throw insertError

      setContent('')
      setSelectedFiles([])
      setPreviewUrls([])
      setIsSensitive(false)
      fetchPosts()
      fetchPopularTags()
    } catch (err) {
      console.error(err)
      alert('投稿に失敗しました')
    } finally {
      setIsSubmitting(false)
    }
  }

  // 投稿削除
  const handleDeletePost = async (post: PostWithAuthor) => {
    if (!confirm('この投稿を削除してもよろしいですか？')) return

    const { error } = await supabase.from('posts').delete().eq('id', post.id)
    if (error) {
      alert('削除に失敗しました')
      return
    }
    setPosts((prev) => prev.filter((p) => p.id !== post.id))

    // 投稿の画像ファイルもストレージから消す。失敗しても投稿の削除自体は完了しているので、記録だけ残す
    const paths = post.image_urls.map((u) => extractStoragePath(u)).filter((p): p is string => !!p)
    if (paths.length > 0) {
      const { error: removeError } = await supabase.storage.from('portfolios').remove(paths)
      if (removeError) console.error('画像ファイルの削除エラー:', removeError)
    }
  }

  // 投稿編集の開始
  const startEdit = (post: PostWithAuthor) => {
    setEditingPostId(post.id)
    setEditContent(post.content)
    setEditSensitive(post.is_sensitive)
  }

  // 投稿編集の保存
  const handleUpdatePost = async (post: PostWithAuthor) => {
    const hasImages = post.image_urls.length > 0
    if (!editContent.trim() && !hasImages) return alert('内容を入力してください')
    if (editContent.length > POST_MAX_LENGTH) return alert(`${POST_MAX_LENGTH}文字以内で入力してください`)

    const changes = { content: editContent.trim(), is_sensitive: editSensitive && hasImages }
    const { error } = await supabase.from('posts').update(changes).eq('id', post.id)

    if (error) {
      alert('更新に失敗しました')
      return
    }
    // 一覧を読み込み直すと先頭に戻ってしまうので、その投稿だけ書き換える
    setEditingPostId(null)
    setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, ...changes } : p)))
  }

  // いいね機能
  const toggleLike = async (post: PostWithAuthor) => {
    if (!currentUser) return alert('いいねをするにはログインが必要です')
    if (likingPostIds.has(post.id)) return // 連打防止（前の処理が終わるまで二重送信しない）

    setLikingPostIds((prev) => new Set(prev).add(post.id))

    const wasLiked = post.is_liked_by_me
    const { error } = wasLiked
      ? await supabase.from('post_likes').delete().eq('post_id', post.id).eq('user_id', currentUser.id)
      : await supabase.from('post_likes').insert({ post_id: post.id, user_id: currentUser.id })

    setLikingPostIds((prev) => {
      const next = new Set(prev)
      next.delete(post.id)
      return next
    })

    if (error) {
      console.error('いいねの更新エラー:', error)
      // P0001 はDB側のチェック（投稿者にブロックされている等）が意図的に出したエラーなので、内容をそのまま案内する
      if (error.code === 'P0001' && error.message) alert(error.message)
      return // 失敗時は表示を変えない（DBの状態と食い違わせない）
    }

    setPosts((prev) =>
      prev.map((p) => {
        if (p.id === post.id) {
          return {
            ...p,
            is_liked_by_me: !wasLiked,
            likes_count: Math.max(0, p.likes_count + (wasLiked ? -1 : 1)),
          }
        }
        return p
      })
    )
  }

  // コメント送信
  const handleAddComment = async (targetPostId: string) => {
    if (!currentUser) return alert('コメントをするにはログインが必要です')
    if (!commentInput.trim() || isSendingComment) return
    if (commentInput.length > COMMENT_MAX_LENGTH) return alert(`コメントは${COMMENT_MAX_LENGTH}文字以内で入力してください`)

    setIsSendingComment(true)
    const { error } = await supabase.from('post_comments').insert({
      post_id: targetPostId,
      user_id: currentUser.id,
      content: commentInput.trim(),
    })
    setIsSendingComment(false)

    if (error) {
      console.error('コメントの送信エラー:', error)
      alert(error.code === 'P0001' && error.message ? error.message : 'コメントの送信に失敗しました')
      return
    }
    setCommentInput('')
    // 一覧を読み込み直すと先頭に戻ってしまうので、その投稿のコメントだけ取り直す
    fetchComments(targetPostId)
  }

  // 自分のコメントを削除
  const handleDeleteComment = async (targetPostId: string, commentId: string) => {
    if (!confirm('このコメントを削除してもよろしいですか？')) return

    const { error } = await supabase.from('post_comments').delete().eq('id', commentId)
    if (error) {
      alert('コメントの削除に失敗しました')
      return
    }
    dropComment(targetPostId, commentId)
  }

  // 一覧からコメントを1件取り除き、件数を合わせる
  const dropComment = (targetPostId: string, commentId: string) => {
    setCommentsByPost((prev) => ({
      ...prev,
      [targetPostId]: (prev[targetPostId] || []).filter((c) => c.id !== commentId),
    }))
    setPosts((prev) =>
      prev.map((p) => (p.id === targetPostId ? { ...p, comments_count: Math.max(0, p.comments_count - 1) } : p))
    )
  }

  // 「⋯」メニューの対象を書いた人（ユーザーIDと表示名）
  const actionUser = actionTarget
    ? actionTarget.kind === 'post'
      ? { id: actionTarget.post.user_id, name: actionTarget.post.profiles?.display_name || 'クリエイター' }
      : { id: actionTarget.comment.user_id, name: actionTarget.comment.profiles?.display_name || 'ユーザー' }
    : null

  // ブロック／ミュートする。その人の投稿・コメントは、この画面からすぐに消える
  const handleBlockUser = async (kind: BlockKind) => {
    if (!currentUser || !actionUser) return
    const message =
      kind === 'block'
        ? `${actionUser.name}さんをブロックしますか？\n\n・相手の投稿・コメントが表示されなくなります\n・相手は、あなたの投稿へのコメント・いいねと、あなたのフォローができなくなります\n\n解除は「ブロック・ミュートの管理」からできます。`
        : `${actionUser.name}さんをミュートしますか？\n\n・相手の投稿・コメントが表示されなくなります（相手には伝わりません）\n\n解除は「ブロック・ミュートの管理」からできます。`
    if (!confirm(message)) return

    const ok = await setUserBlock(currentUser.id, actionUser.id, kind)
    if (!ok) {
      alert('設定に失敗しました。時間をおいて再度お試しください。')
      return
    }
    const next = { ...(blockMapRef.current || {}), [actionUser.id]: kind }
    blockMapRef.current = next
    setBlockMap(next)
    if (!isSinglePost) setPosts((prev) => prev.filter((p) => p.user_id !== actionUser.id))
    setActionTarget(null)
  }

  // 管理者による削除（admin_remove_post / admin_remove_post_comment）。
  // 書いた本人に理由つきで通知され、操作は admin_audit_log に残る
  const handleAdminRemove = async () => {
    if (!isAdmin || !actionTarget) return
    const label = actionTarget.kind === 'post' ? '投稿' : 'コメント'
    const reason = window.prompt(`管理者としてこの${label}を削除します。理由を入力してください（本人に通知されます）。`)
    if (reason === null) return
    if (!reason.trim()) {
      alert('理由を入力してください。')
      return
    }

    if (actionTarget.kind === 'post') {
      const { post } = actionTarget
      const { data, error } = await supabase.rpc('admin_remove_post', {
        p_post_id: post.id,
        p_reason: reason.trim(),
        p_notify: true,
      })
      if (error) {
        console.error('投稿削除エラー:', error)
        alert('削除に失敗しました。' + error.message)
        return
      }
      setPosts((prev) => prev.filter((p) => p.id !== post.id))
      // 投稿の画像ファイルもストレージから消す。失敗しても投稿の削除自体は完了しているので、記録だけ残す
      const paths = ((data || []) as string[]).map((u) => extractStoragePath(u)).filter((p): p is string => !!p)
      if (paths.length > 0) {
        const { error: removeError } = await supabase.storage.from('portfolios').remove(paths)
        if (removeError) console.error('画像ファイルの削除エラー:', removeError)
      }
    } else {
      const { postId: targetPostId, comment } = actionTarget
      const { error } = await supabase.rpc('admin_remove_post_comment', {
        p_comment_id: comment.id,
        p_reason: reason.trim(),
        p_notify: true,
      })
      if (error) {
        console.error('コメント削除エラー:', error)
        alert('削除に失敗しました。' + error.message)
        return
      }
      dropComment(targetPostId, comment.id)
    }
    setActionTarget(null)
  }

  // 投稿の個別ページ（/feed/[postId]）のURLを共有する。SNSに貼ると投稿の画像がカードとして表示される。
  // スマホでは端末の共有メニュー（LINEなどへ直接送れる）を開き、PCではURLをコピーする
  const handleSharePostLink = async (post: PostWithAuthor) => {
    const url = `${window.location.origin}/feed/${post.id}`

    if (typeof navigator.share === 'function' && window.matchMedia('(pointer: coarse)').matches) {
      try {
        await navigator.share({ title: `${post.profiles?.display_name || 'クリエイター'}さんの投稿｜Drawker`, url })
        return
      } catch (e: any) {
        // 共有メニューを閉じただけなら何もしない。それ以外の失敗はコピーに切り替える
        if (e?.name === 'AbortError') return
      }
    }

    try {
      await navigator.clipboard.writeText(url)
      setCopiedPostId(post.id)
      setTimeout(() => setCopiedPostId((prev) => (prev === post.id ? null : prev)), 2000)
    } catch {
      // クリップボードが使えない環境（権限なし・古いブラウザなど）では、URLを表示して手でコピーしてもらう
      window.prompt('コピーできませんでした。下のURLを選択してコピーしてください。', url)
    }
  }

  const handleSharePostOnX = (post: PostWithAuthor) => {
    const url = `${window.location.origin}/feed/${post.id}`
    const text = `${post.profiles?.display_name || 'クリエイター'}さんの投稿｜Drawker`
    window.open(
      `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
      '_blank',
      'noopener,noreferrer'
    )
  }

  const renderFormattedContent = (text: string) => {
    const parts = text.split(/(#[^\s#]+)/g)
    return parts.map((part, i) => {
      if (part.startsWith('#')) {
        // 個別ページには絞り込む対象の一覧が無いので、フィードの一覧へ移動してそのタグで絞り込む
        if (isSinglePost) {
          return (
            <Link
              key={i}
              href={`/feed?tag=${encodeURIComponent(part)}`}
              className="text-pink-500 font-bold hover:underline transition-colors"
            >
              {part}
            </Link>
          )
        }
        return (
          <button
            key={i}
            onClick={() => setSearchTag(part)}
            className="text-pink-500 font-bold hover:underline cursor-pointer transition-colors"
          >
            {part}
          </button>
        )
      }
      return part
    })
  }

  const getImageGridClass = (count: number) => {
    if (count === 1) return 'grid-cols-1'
    if (count === 3) return 'grid-cols-2 [&>*:first-child]:col-span-2'
    return 'grid-cols-2'
  }

  // 1枚のときは元の縦横比のまま（縦長イラストが切れないよう高さだけ制限）、複数枚は正方形で並べる
  const getImageCellClass = (count: number, index: number) => {
    if (count === 1) return 'max-h-[560px]'
    if (count === 3 && index === 0) return 'aspect-[2/1]'
    return 'aspect-square'
  }

  const revealPost = (id: string) => setRevealedPostIds((prev) => new Set(prev).add(id))

  const isFiltered = !!searchTag || imagesOnly
  // 「フォロー中」タブはログインしていないと使えない
  const needsLoginForTab = feedTab === 'following' && !currentUser

  return (
    <div className="min-h-screen pb-24 relative bg-cover bg-center" style={backgroundImageStyle}>
      <div className="absolute inset-0 bg-gradient-to-b from-sky-400/20 via-sky-100/10 to-sky-900/20 backdrop-blur-[2px] pointer-events-none -z-10" />
      <SimpleHeader label="フィード" />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-8 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] gap-6 items-start">
        {/* メインカラム */}
        <div className="space-y-5 min-w-0">
          {/* タイトル（個別ページでは一覧へ戻るリンク） */}
          {isSinglePost ? (
            <div className="px-1">
              <Link
                href="/feed"
                className="inline-flex items-center gap-1.5 text-[11px] font-black text-sky-700 bg-white/90 hover:bg-white border border-white/70 px-4 py-2 rounded-full shadow-2xs transition"
              >
                ← フィードに戻る
              </Link>
            </div>
          ) : (
            <div className="flex items-end justify-between gap-3 px-1">
              <div>
                <p className="text-[10px] font-black text-sky-600 tracking-[0.2em] drop-shadow-xs">FEED</p>
                <h1 className="text-2xl font-black text-slate-800 tracking-tight drop-shadow-sm">みんなの制作日記</h1>
                <p className="text-[11px] text-slate-600 font-medium drop-shadow-xs">
                  わからないこと・依頼がほしい・今描いているもの。なんでも気軽に書き込もう
                </p>
              </div>
            </div>
          )}

          {/* 新規投稿フォーム・絞り込みバーは一覧のときだけ */}
          {!isSinglePost && (
            <>
              {/* 新規投稿フォーム */}
              <div className="bg-white/90 backdrop-blur-md rounded-3xl p-4 sm:p-5 border border-white/70 shadow-sm transition-all focus-within:shadow-md focus-within:ring-2 focus-within:ring-sky-200">
                {currentUser ? (
                  <form onSubmit={handleSubmit} className="flex gap-3">
                    <div className="shrink-0 w-10 h-10 rounded-full overflow-hidden bg-sky-100 border border-sky-100">
                      {myAvatarUrl && <img src={myAvatarUrl} alt="" className="w-full h-full object-cover" />}
                    </div>
                    <div className="flex-1 min-w-0 space-y-3">
                      <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-0.5">
                        {POST_TOPICS.map((topic) => {
                          const active = content.includes(topic.tag)
                          return (
                            <button
                              key={topic.tag}
                              type="button"
                              onClick={() => {
                                setContent((prev) =>
                                  active
                                    ? prev.replace(new RegExp(`\\s*${topic.tag}(?![^\\s#])`, 'g'), '').trimStart()
                                    : `${prev.trimEnd()}${prev.trim() ? ' ' : ''}${topic.tag} `
                                )
                                postInputRef.current?.focus()
                              }}
                              className={`shrink-0 whitespace-nowrap text-[11px] font-bold px-3 py-1.5 rounded-full border transition cursor-pointer ${
                                active ? 'bg-sky-500 border-sky-500 text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-sky-300 hover:text-sky-600'
                              }`}
                            >
                              {topic.label}
                            </button>
                          )
                        })}
                      </div>
                      <textarea
                        ref={postInputRef}
                        rows={3}
                        maxLength={POST_MAX_LENGTH}
                        placeholder={POST_TOPICS.find((t) => content.includes(t.tag))?.placeholder || DEFAULT_PLACEHOLDER}
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        className="w-full text-sm text-slate-800 placeholder-slate-400 bg-transparent resize-none border-none focus:outline-none focus:ring-0 leading-relaxed pt-2"
                      />

                      {previewUrls.length > 0 && (
                        <div className="grid grid-cols-4 gap-2">
                          {previewUrls.map((url, i) => (
                            <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-slate-100 border border-slate-200/60">
                              <img src={url} alt="" className="w-full h-full object-cover" />
                              <button
                                type="button"
                                onClick={() => removeFile(i)}
                                className="absolute top-1 right-1 bg-slate-900/60 hover:bg-slate-900 text-white rounded-full w-6 h-6 text-[10px] font-bold flex items-center justify-center transition cursor-pointer"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* センシティブ指定（ぼかすのは画像なので、画像を選んだときだけ出す） */}
                      {selectedFiles.length > 0 && (
                        <label className="flex items-center gap-2 text-[11px] font-bold text-slate-500 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={isSensitive}
                            onChange={(e) => setIsSensitive(e.target.checked)}
                            className="w-3.5 h-3.5 accent-sky-500"
                          />
                          センシティブな内容を含む（画像をぼかして表示し、タップで見られるようにします）
                        </label>
                      )}

                      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                        <div className="flex items-center gap-3">
                          <label
                            className={`flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-full transition ${
                              selectedFiles.length >= 4
                                ? 'text-slate-300 bg-slate-50 cursor-not-allowed'
                                : 'text-sky-600 bg-sky-50 hover:bg-sky-100 cursor-pointer'
                            }`}
                          >
                            <span>🖼</span>
                            <span>画像 {selectedFiles.length}/4</span>
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              onChange={handleFileChange}
                              className="hidden"
                              disabled={selectedFiles.length >= 4}
                            />
                          </label>
                          <span className={`text-[11px] font-bold tabular-nums ${content.length >= POST_MAX_LENGTH - 10 ? 'text-rose-500' : 'text-slate-300'}`}>
                            {content.length}/{POST_MAX_LENGTH}
                          </span>
                        </div>

                        <button
                          type="submit"
                          disabled={isSubmitting || (!content.trim() && selectedFiles.length === 0)}
                          className="bg-gradient-to-r from-sky-500 to-cyan-500 hover:brightness-105 text-white font-black text-xs px-6 py-2.5 rounded-full shadow-sm hover:shadow-md disabled:opacity-40 disabled:shadow-none transition-all active:scale-95 cursor-pointer"
                        >
                          {isSubmitting ? '送信中...' : '投稿する'}
                        </button>
                      </div>
                    </div>
                  </form>
                ) : (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 py-1">
                    <div className="text-center sm:text-left space-y-0.5">
                      <p className="text-xs font-black text-slate-700">わからないこと・依頼がほしい・今描いているもの、気軽に書き込もう</p>
                      <p className="text-[11px] font-bold text-slate-500">ログインすると、投稿・「いいね」・コメントができます</p>
                    </div>
                    <Link
                      href="/login"
                      className="shrink-0 text-xs font-black text-white bg-sky-500 hover:bg-sky-600 px-5 py-2.5 rounded-full shadow-sm transition"
                    >
                      ログインして参加する
                    </Link>
                  </div>
                )}
              </div>

              {/* 絞り込みバー */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex bg-white/85 backdrop-blur-md rounded-full p-1 border border-white/70 shadow-2xs">
                  {[
                    { value: 'all' as const, label: 'すべて' },
                    { value: 'following' as const, label: 'フォロー中' },
                  ].map((tab) => (
                    <button
                      key={tab.value}
                      onClick={() => setFeedTab(tab.value)}
                      className={`px-4 py-1.5 rounded-full text-[11px] font-black transition cursor-pointer ${
                        feedTab === tab.value ? 'bg-sky-500 text-white shadow-2xs' : 'text-slate-500 hover:text-sky-600'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setImagesOnly((v) => !v)}
                  aria-pressed={imagesOnly}
                  className={`text-[11px] font-black px-4 py-2 rounded-full border transition cursor-pointer shadow-2xs ${
                    imagesOnly
                      ? 'bg-sky-500 text-white border-sky-500'
                      : 'bg-white/85 text-slate-500 border-white/70 hover:text-sky-600'
                  }`}
                >
                  🖼 画像つきのみ
                </button>
                {searchTag && (
                  <button
                    onClick={() => setSearchTag('')}
                    className="text-[11px] font-black text-sky-700 bg-white/90 border border-sky-200 px-3 py-1.5 rounded-full hover:bg-sky-50 transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <span>{searchTag}</span>
                    <span className="text-slate-400">✕</span>
                  </button>
                )}
              </div>
            </>
          )}

          {/* タイムライン */}
          {loading ? (
            <div className="space-y-4">
              {(isSinglePost ? [1] : [1, 2, 3]).map((n) => (
                <div key={n} className="bg-white/85 rounded-3xl p-5 space-y-3 animate-pulse border border-white/70">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-sky-100" />
                    <div className="space-y-1.5">
                      <div className="h-3 w-24 bg-sky-100 rounded" />
                      <div className="h-2 w-12 bg-sky-50 rounded" />
                    </div>
                  </div>
                  <div className="h-3 w-3/4 bg-sky-50 rounded" />
                  <div className="aspect-video bg-sky-50 rounded-2xl" />
                </div>
              ))}
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-16 px-4 bg-white/85 backdrop-blur-md rounded-3xl border border-white/70 space-y-2">
              <p className="text-3xl">🎨</p>
              {isSinglePost ? (
                <>
                  <p className="text-sm font-black text-slate-600">この投稿は見つかりませんでした</p>
                  <p className="text-[11px] text-slate-400 font-bold">削除されたか、URLが間違っている可能性があります</p>
                </>
              ) : needsLoginForTab ? (
                <>
                  <p className="text-sm font-black text-slate-600">フォロー中のクリエイターの投稿を見るにはログインが必要です</p>
                  <Link
                    href="/login"
                    className="inline-block mt-1 text-xs font-black text-white bg-sky-500 hover:bg-sky-600 px-5 py-2.5 rounded-full shadow-sm transition"
                  >
                    ログインする
                  </Link>
                </>
              ) : feedTab === 'following' && followingCount === 0 ? (
                <>
                  <p className="text-sm font-black text-slate-600">まだ誰もフォローしていません</p>
                  <p className="text-[11px] text-slate-400 font-bold">
                    クリエイターのページで「フォロー」を押すと、その人の投稿がここに並びます
                  </p>
                </>
              ) : isFiltered || feedTab === 'following' ? (
                <p className="text-sm font-black text-slate-600">条件に合う投稿がありません</p>
              ) : (
                <>
                  <p className="text-sm font-black text-slate-600">まだ投稿がありません</p>
                  {currentUser && (
                    <p className="text-[11px] text-slate-400 font-bold">
                      「はじめまして」や「今描いているもの」など、最初のひとことを書いてみませんか？
                    </p>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {posts.map((post) => {
                const isMyPost = currentUser?.id === post.user_id
                const images = post.image_urls
                const isHidden = post.is_sensitive && !revealedPostIds.has(post.id)
                const authorName = post.profiles?.display_name || 'クリエイター'
                // ブロック・ミュートしている相手のコメントは出さない
                const comments = commentsByPost[post.id]?.filter((c) => !blockMap[c.user_id])

                return (
                  <article
                    key={post.id}
                    className="bg-white/95 backdrop-blur-md rounded-3xl p-4 sm:p-5 border border-white/70 shadow-sm hover:shadow-md transition-all space-y-3"
                  >
                    {/* 投稿者 */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <Link href={`/creator/${post.user_id}`} className="shrink-0 hover:scale-105 transition-transform">
                          <AvatarRing
                            src={post.profiles?.avatar_url}
                            alt={authorName}
                            size={42}
                            ringId={ringMap[post.user_id]}
                            fallback={
                              <div className="w-full h-full rounded-full bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-300 font-black text-xs">
                                {authorName.slice(0, 1)}
                              </div>
                            }
                          />
                        </Link>
                        <div className="min-w-0">
                          <h2 className="text-sm font-black text-slate-800 truncate">
                            <Link href={`/creator/${post.user_id}`} className="hover:text-sky-600 transition-colors">
                              {authorName}
                            </Link>
                          </h2>
                          {/* 投稿時刻は、その投稿の個別ページへのリンク */}
                          <Link
                            href={`/feed/${post.id}`}
                            className="text-[10px] text-slate-400 font-bold hover:text-sky-600 hover:underline"
                          >
                            <time dateTime={post.created_at} title={new Date(post.created_at).toLocaleString('ja-JP')}>
                              {formatRelativeTime(post.created_at)}
                            </time>
                          </Link>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {isMyPost && (
                          <>
                            <button
                              onClick={() => startEdit(post)}
                              className="text-[11px] font-bold text-slate-400 hover:text-slate-700 hover:bg-slate-50 px-2 py-1 rounded-lg transition cursor-pointer"
                            >
                              編集
                            </button>
                            <button
                              onClick={() => handleDeletePost(post)}
                              className="text-[11px] font-bold text-rose-400 hover:text-rose-600 hover:bg-rose-50 px-2 py-1 rounded-lg transition cursor-pointer"
                            >
                              削除
                            </button>
                          </>
                        )}
                        {!isMyPost && (
                          <>
                            {/* 通報・ミュート・ブロック（管理者は削除も） */}
                            <button
                              onClick={() => setActionTarget({ kind: 'post', post })}
                              aria-label="この投稿のメニュー"
                              className="text-sm font-black text-slate-300 hover:text-slate-600 hover:bg-slate-50 px-2 py-0.5 rounded-lg transition cursor-pointer"
                            >
                              ⋯
                            </button>
                            <Link
                              href={`/creator/${post.user_id}`}
                              className="text-[11px] font-black text-sky-600 bg-sky-50 hover:bg-sky-100 px-3 py-1.5 rounded-full transition"
                            >
                              依頼する →
                            </Link>
                          </>
                        )}
                      </div>
                    </div>

                    {/* 本文（編集中はテキストエリア） */}
                    {editingPostId === post.id ? (
                      <div className="space-y-2 bg-sky-50/60 p-3 rounded-2xl border border-sky-100">
                        <textarea
                          rows={3}
                          maxLength={POST_MAX_LENGTH}
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="w-full text-sm text-slate-800 bg-transparent resize-none focus:outline-none"
                        />
                        {images.length > 0 && (
                          <label className="flex items-center gap-2 text-[11px] font-bold text-slate-500 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={editSensitive}
                              onChange={(e) => setEditSensitive(e.target.checked)}
                              className="w-3.5 h-3.5 accent-sky-500"
                            />
                            センシティブな内容を含む（画像をぼかして表示）
                          </label>
                        )}
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setEditingPostId(null)}
                            className="text-xs font-bold text-slate-500 px-3 py-1.5 rounded-lg hover:bg-white cursor-pointer"
                          >
                            キャンセル
                          </button>
                          <button
                            onClick={() => handleUpdatePost(post)}
                            className="text-xs font-bold bg-sky-500 hover:bg-sky-600 text-white px-4 py-1.5 rounded-lg cursor-pointer"
                          >
                            保存
                          </button>
                        </div>
                      </div>
                    ) : (
                      post.content && (
                        <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap break-words">
                          {renderFormattedContent(post.content)}
                        </p>
                      )
                    )}

                    {/* 画像 */}
                    {images.length > 0 && (
                      <div className="relative rounded-2xl overflow-hidden">
                        <div className={`grid gap-1 ${getImageGridClass(images.length)} ${isHidden ? 'blur-2xl scale-105' : ''}`}>
                          {images.map((url, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => !isHidden && setLightbox({ urls: images, index: i, name: authorName })}
                              className={`relative overflow-hidden bg-slate-100 cursor-zoom-in group/img ${getImageCellClass(images.length, i)}`}
                            >
                              <ProtectedImage
                                src={url}
                                alt=""
                                watermarkText={authorName}
                                loading="lazy"
                                decoding="async"
                                wrapperClassName={images.length === 1 ? 'relative w-full' : 'relative w-full h-full'}
                                className={
                                  images.length === 1
                                    ? 'block w-full max-h-[560px] object-contain bg-slate-50'
                                    : 'w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-500'
                                }
                              />
                            </button>
                          ))}
                        </div>
                        {isHidden && (
                          <button
                            type="button"
                            onClick={() => revealPost(post.id)}
                            className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-900/30 text-white cursor-pointer"
                          >
                            <span className="text-[11px] font-black bg-slate-900/60 px-3 py-1 rounded-full">センシティブな内容</span>
                            <span className="text-xs font-black underline underline-offset-2">タップして表示</span>
                          </button>
                        )}
                      </div>
                    )}

                    {/* いいね・コメント */}
                    <div className="flex items-center gap-1 pt-1">
                      <button
                        onClick={() => toggleLike(post)}
                        disabled={likingPostIds.has(post.id)}
                        className={`flex items-center gap-1.5 text-xs font-black px-3 py-1.5 rounded-full transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 ${
                          post.is_liked_by_me ? 'text-rose-500 bg-rose-50' : 'text-slate-400 hover:text-rose-500 hover:bg-rose-50'
                        }`}
                      >
                        <span className="text-sm">{post.is_liked_by_me ? '♥' : '♡'}</span>
                        <span className="tabular-nums">{post.likes_count}</span>
                      </button>

                      <button
                        onClick={() => {
                          setOpenCommentPostId(openCommentPostId === post.id ? null : post.id)
                          setCommentInput('')
                        }}
                        className={`flex items-center gap-1.5 text-xs font-black px-3 py-1.5 rounded-full transition cursor-pointer ${
                          openCommentPostId === post.id ? 'text-sky-600 bg-sky-50' : 'text-slate-400 hover:text-sky-600 hover:bg-sky-50'
                        }`}
                      >
                        <span>💬</span>
                        <span className="tabular-nums">{post.comments_count}</span>
                      </button>

                      {/* 共有：投稿の個別ページ（/feed/[postId]）のURL */}
                      <div className="flex items-center gap-1 ml-auto">
                        <button
                          onClick={() => handleSharePostLink(post)}
                          className={`flex items-center gap-1.5 text-[11px] font-black px-3 py-1.5 rounded-full transition cursor-pointer ${
                            copiedPostId === post.id ? 'text-sky-600 bg-sky-50' : 'text-slate-400 hover:text-sky-600 hover:bg-sky-50'
                          }`}
                        >
                          <span>🔗</span>
                          <span>{copiedPostId === post.id ? 'コピー済み' : 'リンク'}</span>
                        </button>
                        <button
                          onClick={() => handleSharePostOnX(post)}
                          className="flex items-center gap-1.5 text-[11px] font-black px-3 py-1.5 rounded-full text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer"
                        >
                          <span>𝕏</span>
                          <span>シェア</span>
                        </button>
                      </div>
                    </div>

                    {/* コメント */}
                    {openCommentPostId === post.id && (
                      <div className="pt-3 border-t border-slate-100 space-y-3">
                        {!comments ? (
                          <p className="text-[11px] text-slate-400 font-bold text-center py-1">コメントを読み込み中...</p>
                        ) : comments.length > 0 ? (
                          <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                            {comments.map((comment) => (
                              <div key={comment.id} className="flex gap-2.5">
                                <Link href={`/creator/${comment.user_id}`} className="shrink-0 pt-0.5">
                                  <AvatarRing
                                    src={comment.profiles?.avatar_url}
                                    alt=""
                                    size={28}
                                    ringId={ringMap[comment.user_id]}
                                    fallback={<div className="w-full h-full rounded-full bg-slate-200" />}
                                  />
                                </Link>
                                <div className="bg-slate-50 rounded-2xl rounded-tl-md px-3 py-2 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[11px] font-black text-slate-800 truncate">
                                      {comment.profiles?.display_name || 'ユーザー'}
                                    </span>
                                    <span className="text-[9px] text-slate-400 font-bold shrink-0">
                                      {formatRelativeTime(comment.created_at)}
                                    </span>
                                    {currentUser?.id === comment.user_id ? (
                                      <button
                                        onClick={() => handleDeleteComment(post.id, comment.id)}
                                        className="text-[9px] font-bold text-rose-400 hover:text-rose-600 hover:underline shrink-0 cursor-pointer"
                                      >
                                        削除
                                      </button>
                                    ) : (
                                      <button
                                        onClick={() => setActionTarget({ kind: 'comment', postId: post.id, comment })}
                                        aria-label="このコメントのメニュー"
                                        className="text-xs font-black leading-none text-slate-300 hover:text-slate-600 px-1 shrink-0 cursor-pointer"
                                      >
                                        ⋯
                                      </button>
                                    )}
                                  </div>
                                  <p className="text-xs text-slate-600 whitespace-pre-wrap break-words">{comment.content}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-400 font-bold text-center py-1">
                            まだコメントはありません。最初のコメントをどうぞ！
                          </p>
                        )}

                        {currentUser ? (
                          <form
                            onSubmit={(e) => {
                              e.preventDefault()
                              handleAddComment(post.id)
                            }}
                            className="space-y-1"
                          >
                            <div className="flex gap-2">
                              <input
                                type="text"
                                maxLength={COMMENT_MAX_LENGTH}
                                placeholder="コメントを入力..."
                                value={commentInput}
                                onChange={(e) => setCommentInput(e.target.value)}
                                className="flex-1 min-w-0 text-xs px-4 py-2 rounded-full bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-400/50 focus:bg-white"
                              />
                              <button
                                type="submit"
                                disabled={!commentInput.trim() || isSendingComment}
                                className="bg-sky-500 hover:bg-sky-600 disabled:opacity-40 text-white text-xs font-black px-4 py-2 rounded-full transition cursor-pointer"
                              >
                                送信
                              </button>
                            </div>
                            {/* 上限が近づいたときだけ文字数を出す */}
                            {commentInput.length >= COMMENT_MAX_LENGTH - 50 && (
                              <p className={`text-[10px] font-bold tabular-nums text-right pr-1 ${commentInput.length >= COMMENT_MAX_LENGTH ? 'text-rose-500' : 'text-slate-400'}`}>
                                {commentInput.length}/{COMMENT_MAX_LENGTH}
                              </p>
                            )}
                          </form>
                        ) : (
                          <p className="text-[10px] text-slate-400 text-center font-bold">
                            <Link href="/login" className="text-sky-600 hover:underline">ログイン</Link>
                            するとコメントできます
                          </p>
                        )}
                      </div>
                    )}
                  </article>
                )
              })}
            </div>
          )}

          {/* 個別ページ：ほかの投稿への導線 */}
          {isSinglePost && !loading && (
            <div className="text-center pt-2">
              <Link
                href="/feed"
                className="inline-block px-8 py-2.5 bg-white/90 hover:bg-white border border-white/70 text-sky-700 font-black text-xs rounded-full transition shadow-sm"
              >
                ほかの投稿も見る →
              </Link>
            </div>
          )}

          {/* もっと見る */}
          {!loading && hasMore && posts.length > 0 && (
            <div className="text-center pt-2">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="px-8 py-2.5 bg-white/90 hover:bg-white border border-white/70 text-sky-700 font-black text-xs rounded-full transition cursor-pointer disabled:opacity-50 shadow-sm"
              >
                {loadingMore ? '読み込み中...' : 'もっと見る'}
              </button>
            </div>
          )}

          {/* ブロック・ミュートしている人がいるときだけ、解除ページへの導線を出す */}
          {!isSinglePost && Object.keys(blockMap).length > 0 && (
            <p className="text-center">
              <Link href="/blocks" className="text-[10px] font-bold text-slate-500 hover:text-sky-600 hover:underline drop-shadow-xs">
                ブロック・ミュートの管理（{Object.keys(blockMap).length}人）
              </Link>
            </p>
          )}
        </div>

        {/* サイドバー（PCのみ） */}
        <aside className="hidden lg:block space-y-4 sticky top-20">
          {!isSinglePost && (
            <div className="bg-white/90 backdrop-blur-md rounded-3xl p-5 border border-white/70 shadow-sm space-y-3">
              <h2 className="text-xs font-black text-slate-700 tracking-wider"># 人気のタグ</h2>
              {popularTags.length === 0 ? (
                <p className="text-[11px] text-slate-400 font-bold">まだタグ付きの投稿がありません</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {popularTags.map(([tag, count]) => (
                    <button
                      key={tag}
                      onClick={() => setSearchTag(searchTag === tag ? '' : tag)}
                      className={`text-[11px] font-bold px-2.5 py-1 rounded-full border transition cursor-pointer ${
                        searchTag === tag
                          ? 'bg-sky-500 text-white border-sky-500'
                          : 'bg-sky-50 text-sky-700 border-sky-100 hover:bg-sky-100'
                      }`}
                    >
                      {tag}
                      <span className={`ml-1 ${searchTag === tag ? 'text-sky-100' : 'text-sky-400'}`}>{count}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="bg-gradient-to-br from-sky-500 to-cyan-400 rounded-3xl p-5 text-white shadow-sm space-y-2">
            <p className="text-sm font-black">お気に入りの絵柄を見つけたら</p>
            <p className="text-[11px] text-sky-50 font-medium leading-relaxed">
              料金・納期・商用利用の条件でクリエイターを比較して、そのまま依頼の相談ができます。
            </p>
            <Link
              href="/"
              className="inline-block mt-1 text-[11px] font-black bg-white text-sky-700 px-4 py-2 rounded-full hover:bg-sky-50 transition"
            >
              クリエイターを探す →
            </Link>
          </div>
        </aside>
      </div>

      {/* 画像の拡大表示 */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold cursor-pointer"
            aria-label="閉じる"
          >
            ✕
          </button>
          {lightbox.urls.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setLightbox({ ...lightbox, index: (lightbox.index - 1 + lightbox.urls.length) % lightbox.urls.length })
                }}
                className="absolute left-3 sm:left-6 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white text-lg font-bold cursor-pointer"
                aria-label="前の画像"
              >
                ‹
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setLightbox({ ...lightbox, index: (lightbox.index + 1) % lightbox.urls.length })
                }}
                className="absolute right-3 sm:right-6 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white text-lg font-bold cursor-pointer"
                aria-label="次の画像"
              >
                ›
              </button>
              <span className="absolute bottom-5 left-1/2 -translate-x-1/2 text-xs font-bold text-white/70 tabular-nums">
                {lightbox.index + 1} / {lightbox.urls.length}
              </span>
            </>
          )}
          <div onClick={(e) => e.stopPropagation()} className="max-w-5xl max-h-[85vh]">
            <ProtectedImage
              src={lightbox.urls[lightbox.index]}
              alt=""
              watermarkText={lightbox.name}
              wrapperClassName="relative"
              className="block max-w-full max-h-[85vh] object-contain rounded-lg"
            />
          </div>
        </div>
      )}

      {/* 「⋯」メニュー：通報・ミュート・ブロック（管理者は削除も） */}
      {actionTarget && actionUser && (
        <div
          className="fixed inset-0 z-50 bg-sky-950/70 backdrop-blur-md flex items-end sm:items-center justify-center p-4"
          onClick={() => setActionTarget(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-sm w-full p-5 space-y-2 shadow-2xl border border-sky-100"
          >
            <p className="text-xs font-black text-slate-700 px-1 pb-1 truncate">
              {actionUser.name}さんの{actionTarget.kind === 'post' ? '投稿' : 'コメント'}
            </p>

            <button
              onClick={() => {
                setReportTarget(
                  actionTarget.kind === 'post'
                    ? { type: 'post', id: actionTarget.post.id, user_id: actionTarget.post.user_id }
                    : { type: 'post_comment', id: actionTarget.comment.id, user_id: actionTarget.comment.user_id }
                )
                setActionTarget(null)
              }}
              className="w-full text-left px-4 py-3 rounded-2xl bg-slate-50 hover:bg-rose-50 transition cursor-pointer"
            >
              <span className="block text-xs font-black text-slate-800">🚩 通報する</span>
              <span className="block text-[10px] font-bold text-slate-400">無断転載や規約違反の疑いを運営に知らせます</span>
            </button>

            {currentUser ? (
              <>
                <button
                  onClick={() => handleBlockUser('mute')}
                  className="w-full text-left px-4 py-3 rounded-2xl bg-slate-50 hover:bg-sky-50 transition cursor-pointer"
                >
                  <span className="block text-xs font-black text-slate-800">🔇 この人をミュートする</span>
                  <span className="block text-[10px] font-bold text-slate-400">
                    投稿・コメントが表示されなくなります（相手には伝わりません）
                  </span>
                </button>
                <button
                  onClick={() => handleBlockUser('block')}
                  className="w-full text-left px-4 py-3 rounded-2xl bg-slate-50 hover:bg-sky-50 transition cursor-pointer"
                >
                  <span className="block text-xs font-black text-slate-800">🚫 この人をブロックする</span>
                  <span className="block text-[10px] font-bold text-slate-400">
                    ミュートに加えて、相手はあなたの投稿へのコメント・いいね、あなたのフォローができなくなります
                  </span>
                </button>
              </>
            ) : (
              <p className="text-[10px] font-bold text-slate-400 px-1">
                <Link href="/login" className="text-sky-600 hover:underline">ログイン</Link>
                すると、ミュート・ブロックができます
              </p>
            )}

            {isAdmin && (
              <button
                onClick={handleAdminRemove}
                className="w-full text-left px-4 py-3 rounded-2xl bg-rose-50 hover:bg-rose-100 transition cursor-pointer"
              >
                <span className="block text-xs font-black text-rose-700">🛡️ 管理者として削除する</span>
                <span className="block text-[10px] font-bold text-rose-400">理由が本人に通知され、操作履歴に残ります</span>
              </button>
            )}

            <div className="flex items-center justify-between gap-3 pt-2">
              {currentUser ? (
                <Link href="/blocks" className="text-[10px] font-bold text-slate-400 hover:text-sky-600 hover:underline">
                  ブロック・ミュートの管理 →
                </Link>
              ) : (
                <span />
              )}
              <button
                onClick={() => setActionTarget(null)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 通報モーダル */}
      {reportTarget && <PostReportModal target={reportTarget} onClose={() => setReportTarget(null)} />}
    </div>
  )
}
