'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { convertToWebp } from '@/lib/imageUtils'

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
  }
  likes_count?: number
  is_liked_by_me?: boolean
}

export default function FeedPage() {
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [posts, setPosts] = useState<PostWithAuthor[]>([])
  const [loading, setLoading] = useState(true)

  // 投稿用ステート
  const [content, setContent] = useState('')
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [previewUrls, setPreviewUrls] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [searchTag, setSearchTag] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUser(data.user)
    })
    fetchPosts()
  }, [])

  const fetchPosts = async () => {
    setLoading(true)
    const { data: userResp } = await supabase.auth.getUser()
    const activeUserId = userResp.user?.id

    const { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        profiles:user_id (display_name, avatar_url),
        post_likes (user_id)
      `)
      .order('created_at', { ascending: false })

    if (!error && data) {
      const formatted = data.map((post: any) => ({
        ...post,
        likes_count: post.post_likes?.length || 0,
        is_liked_by_me: activeUserId
          ? post.post_likes?.some((l: any) => l.user_id === activeUserId)
          : false,
      }))
      setPosts(formatted)
    }
    setLoading(false)
  }

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
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentUser) return alert('投稿するにはログインが必要です')
    if (!content.trim() && selectedFiles.length === 0) return
    if (content.length > 200) return alert('文字数は200文字までにしてください')

    setIsSubmitting(true)
    try {
      const uploadedImageUrls: string[] = []

      for (const file of selectedFiles) {
        const webpBlob = await convertToWebp(file)
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
      })

      if (insertError) throw insertError

      setContent('')
      setSelectedFiles([])
      setPreviewUrls([])
      fetchPosts()
    } catch (err) {
      console.error(err)
      alert('投稿に失敗しました')
    } finally {
      setIsSubmitting(false)
    }
  }

  const toggleLike = async (post: PostWithAuthor) => {
    if (!currentUser) return alert('いいねをするにはログインが必要です')

    if (post.is_liked_by_me) {
      await supabase
        .from('post_likes')
        .delete()
        .eq('post_id', post.id)
        .eq('user_id', currentUser.id)
    } else {
      await supabase
        .from('post_likes')
        .insert({ post_id: post.id, user_id: currentUser.id })
    }

    setPosts((prev) =>
      prev.map((p) => {
        if (p.id === post.id) {
          return {
            ...p,
            is_liked_by_me: !p.is_liked_by_me,
            likes_count: (p.likes_count || 0) + (p.is_liked_by_me ? -1 : 1),
          }
        }
        return p
      })
    )
  }

  const renderFormattedContent = (text: string) => {
    const parts = text.split(/(#[^\s#]+)/g)
    return parts.map((part, i) => {
      if (part.startsWith('#')) {
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

  const filteredPosts = useMemo(() => {
    if (!searchTag) return posts
    return posts.filter((p) => p.content.includes(searchTag))
  }, [posts, searchTag])

  // 画像の枚数に応じたCSSグリッドクラスの動的判定
  const getImageGridClass = (count: number) => {
    if (count === 1) return 'grid-cols-1'
    if (count === 2) return 'grid-cols-2'
    if (count === 3) return 'grid-cols-2 [&>*:first-child]:col-span-2'
    return 'grid-cols-2'
  }

  return (
    <div className="min-h-screen bg-slate-50/50 py-8 px-4">
      <div className="max-w-xl mx-auto space-y-6">
        
        {/* ヘッダータイトル */}
        <div className="flex items-center justify-between px-2">
          <h1 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <span className="text-pink-500">✨</span>タイムライン
          </h1>
          {searchTag && (
            <button
              onClick={() => setSearchTag('')}
              className="text-xs font-bold text-pink-600 bg-pink-50 border border-pink-200 px-3 py-1.5 rounded-full hover:bg-pink-100 transition flex items-center gap-1 cursor-pointer"
            >
              <span>{searchTag}</span>
              <span className="text-pink-400">✕ 解除</span>
            </button>
          )}
        </div>

        {/* 投稿入力エリア */}
        <div className="bg-white/80 backdrop-blur-md rounded-3xl p-5 border border-slate-200/80 shadow-sm transition-all focus-within:shadow-md">
          {currentUser ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <textarea
                rows={3}
                maxLength={200}
                placeholder="いまどんな作品を描いてる？（最大200文字 / #ハッシュタグ可）"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full text-sm text-slate-800 placeholder-slate-400 bg-transparent resize-none border-none focus:outline-none focus:ring-0 leading-relaxed"
              />

              {/* 選択画像プレビュー */}
              {previewUrls.length > 0 && (
                <div className={`grid gap-2 ${getImageGridClass(previewUrls.length)}`}>
                  {previewUrls.map((url, i) => (
                    <div key={i} className="relative aspect-video rounded-2xl overflow-hidden bg-slate-100 group border border-slate-200/60">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeFile(i)}
                        className="absolute top-2 right-2 bg-slate-900/60 hover:bg-slate-900 backdrop-blur-md text-white rounded-full w-7 h-7 text-xs font-bold flex items-center justify-center transition cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <div className="flex items-center gap-4">
                  <label className="group flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-pink-600 cursor-pointer transition">
                    <div className="w-8 h-8 rounded-xl bg-slate-100 group-hover:bg-pink-50 flex items-center justify-center text-slate-600 group-hover:text-pink-500 transition">
                      🖼️
                    </div>
                    <span>画像 ({selectedFiles.length}/4)</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleFileChange}
                      className="hidden"
                      disabled={selectedFiles.length >= 4}
                    />
                  </label>

                  <span className={`text-xs font-bold ${content.length >= 190 ? 'text-rose-500' : 'text-slate-300'}`}>
                    {content.length}/200
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || (!content.trim() && selectedFiles.length === 0)}
                  className="bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-bold text-xs px-6 py-2.5 rounded-full shadow-md hover:shadow-lg disabled:opacity-40 transition-all transform active:scale-95 cursor-pointer"
                >
                  {isSubmitting ? '送信中...' : '投稿する'}
                </button>
              </div>
            </form>
          ) : (
            <div className="text-center py-6 space-y-2">
              <p className="text-xs font-bold text-slate-500">ログインすると作品の投稿や「いいね」ができます</p>
              <Link
                href="/login"
                className="inline-block text-xs font-black text-pink-600 hover:text-pink-700 bg-pink-50 hover:bg-pink-100 px-5 py-2.5 rounded-full transition"
              >
                ログインして参加する
              </Link>
            </div>
          )}
        </div>

        {/* タイムラインリスト */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2].map((n) => (
              <div key={n} className="bg-white/50 rounded-3xl p-5 border border-slate-200/50 space-y-3 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-200" />
                  <div className="space-y-1.5">
                    <div className="w-24 h-3 bg-slate-200 rounded" />
                    <div className="w-16 h-2 bg-slate-200 rounded" />
                  </div>
                </div>
                <div className="w-full h-12 bg-slate-200 rounded-xl" />
              </div>
            ))}
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="text-center py-16 bg-white/40 rounded-3xl border border-dashed border-slate-200">
            <p className="text-sm font-bold text-slate-400">投稿がありません</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredPosts.map((post) => (
              <article
                key={post.id}
                className="bg-white rounded-3xl p-5 border border-slate-200/70 shadow-sm hover:border-slate-300 transition-all space-y-3.5"
              >
                {/* ユーザーヘッダー */}
                <div className="flex items-center justify-between">
                  <Link href={`/${post.user_id}`} className="flex items-center gap-3 group">
                    <div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden border border-slate-200/60 shrink-0 group-hover:scale-105 transition-transform">
                      {post.profiles?.avatar_url ? (
                        <img
                          src={post.profiles.avatar_url}
                          alt={post.profiles.display_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300 font-bold text-xs">
                          ?
                        </div>
                      )}
                    </div>
                    <div>
                      <h2 className="text-xs font-black text-slate-800 group-hover:text-pink-600 transition-colors">
                        {post.profiles?.display_name || 'クリエイター'}
                      </h2>
                      <time className="text-[10px] text-slate-400 font-medium">
                        {new Date(post.created_at).toLocaleString('ja-JP', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </time>
                    </div>
                  </Link>

                  <Link
                    href={`/${post.user_id}`}
                    className="text-[11px] font-bold text-pink-600 bg-pink-50 hover:bg-pink-100 px-3 py-1.5 rounded-full transition"
                  >
                    依頼窓口 →
                  </Link>
                </div>

                {/* 投稿本文 */}
                <p className="text-xs text-slate-700 leading-relaxed font-normal whitespace-pre-wrap">
                  {renderFormattedContent(post.content)}
                </p>

                {/* 画像グリッド */}
                {post.image_urls && post.image_urls.length > 0 && (
                  <div className={`grid gap-2 ${getImageGridClass(post.image_urls.length)}`}>
                    {post.image_urls.map((url, i) => (
                      <div
                        key={i}
                        className="aspect-video rounded-2xl overflow-hidden bg-slate-100 border border-slate-200/50 group/img"
                      >
                        <img
                          src={url}
                          alt=""
                          className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-300"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* アクションエリア (いいね) */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100/80">
                  <button
                    onClick={() => toggleLike(post)}
                    className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full transition cursor-pointer ${
                      post.is_liked_by_me
                        ? 'text-rose-500 bg-rose-50'
                        : 'text-slate-400 hover:text-rose-500 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-sm">{post.is_liked_by_me ? '❤️' : '🤍'}</span>
                    <span>{post.likes_count || 0}</span>
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}