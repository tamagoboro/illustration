import { NextResponse } from 'next/server'
import { TwitterApi } from 'twitter-api-v2'

// X API クライアント（画像アップロード用に write 権限が必要）
const twitterClient = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY!,
  appSecret: process.env.TWITTER_API_SECRET!,
  accessToken: process.env.TWITTER_ACCESS_TOKEN!,
  accessSecret: process.env.TWITTER_ACCESS_SECRET!,
})

export async function POST(req: Request) {
  try {
    // 1. セキュリティチェック（Webhook用のシークレットキー検証）
    const authHeader = req.headers.get('x-webhook-secret')
    if (authHeader !== process.env.SUPABASE_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()

    // 2. 初回登録（INSERT）のみ実行し、更新（UPDATE）などはスキップ
    if (body.type !== 'INSERT') {
      return NextResponse.json({ message: 'Skipped: Not an INSERT event' }, { status: 200 })
    }

    const profile = body.record

    if (!profile || !profile.display_name) {
      return NextResponse.json({ message: 'No profile data found' }, { status: 400 })
    }

    // 3. ツイート文面の作成
    const name = profile.display_name
    const comment = profile.status_comment || profile.bio || 'よろしくお願いします！'
    const creatorUrl = `https://illustration-jq5k.vercel.app/creator/${profile.user_id}`

    const tweetText = `${name}\n\n` +
      `「${comment}」\n\n` +
      `▼ プロフィール・作品を見る\n${creatorUrl}\n\n` +
      `#イラストレーター #イラストレーター検索サイト\n` +
      `#イラスト依頼`

    // 4. 画像のアップロード処理（サムネイルまたはアバターが存在する場合）
    let mediaId: string | undefined
    const imageUrl = profile.thumbnail_url || profile.avatar_url

    if (imageUrl) {
      try {
        // 画像を取得して Buffer 化
        const imageRes = await fetch(imageUrl)
        if (imageRes.ok) {
          const arrayBuffer = await imageRes.arrayBuffer()
          const buffer = Buffer.from(arrayBuffer)
          const mimeType = imageRes.headers.get('content-type') || 'image/jpeg'

          // X (v1.1 API) へ画像をアップロード
          mediaId = await twitterClient.v1.uploadMedia(buffer, { mimeType })
        }
      } catch (imgError) {
        console.error('画像のアップロードに失敗しました（テキストのみで投稿します）:', imgError)
      }
    }

    // 5. Xへ投稿（画像がある場合は添付）
    if (mediaId) {
      await twitterClient.v2.tweet({
        text: tweetText,
        media: { media_ids: [mediaId] },
      })
    } else {
      await twitterClient.v2.tweet(tweetText)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('X自動投稿エラー:', error)
    return NextResponse.json({ error: 'Failed to post tweet' }, { status: 500 })
  }
}