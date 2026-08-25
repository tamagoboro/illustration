import { NextResponse } from 'next/server'
import { TwitterApi } from 'twitter-api-v2'

export async function POST(req: Request) {
  try {
    // 1. セキュリティチェック
    const authHeader = req.headers.get('x-webhook-secret')
    if (authHeader !== process.env.SUPABASE_WEBHOOK_SECRET) {
      console.warn('Webhook認証エラー: Secretキーが一致しません')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()

    // 2. 初回登録（INSERT）のみ実行
    if (body.type !== 'INSERT') {
      return NextResponse.json({ message: 'Skipped: Not an INSERT event' }, { status: 200 })
    }

    const profile = body.record
    if (!profile || !profile.display_name) {
      return NextResponse.json({ message: 'No profile data found' }, { status: 400 })
    }

    // 3. 環境変数の存在確認
    if (
      !process.env.TWITTER_API_KEY ||
      !process.env.TWITTER_API_SECRET ||
      !process.env.TWITTER_ACCESS_TOKEN ||
      !process.env.TWITTER_ACCESS_SECRET
    ) {
      console.error('X APIの環境変数が設定されていません')
      return NextResponse.json({ error: 'Twitter API keys are missing' }, { status: 500 })
    }

    const twitterClient = new TwitterApi({
      appKey: process.env.TWITTER_API_KEY,
      appSecret: process.env.TWITTER_API_SECRET,
      accessToken: process.env.TWITTER_ACCESS_TOKEN,
      accessSecret: process.env.TWITTER_ACCESS_SECRET,
    })

    // 4. ツイート文面の作成
    const name = profile.display_name
    const comment = profile.status_comment || profile.bio || 'よろしくお願いします！'
    const creatorUrl = `https://illustration-jq5k.vercel.app/creator/${profile.user_id}`

    const tweetText = `${name}\n\n` +
      `「${comment}」\n\n` +
      `▼ プロフィール・作品を見る\n${creatorUrl}\n\n` +
      `#イラストレーター #イラストレーター検索サイト\n` +
      `#イラスト依頼`

    // 5. 画像の取得とアップロード
    let mediaId: string | undefined
    const imageUrl = profile.thumbnail_url || profile.avatar_url

    if (imageUrl) {
      try {
        const imageRes = await fetch(imageUrl)
        if (imageRes.ok) {
          const arrayBuffer = await imageRes.arrayBuffer()
          const buffer = Buffer.from(arrayBuffer)
          const mimeType = imageRes.headers.get('content-type') || 'image/jpeg'

          // 画像アップロード実行
          mediaId = await twitterClient.v1.uploadMedia(buffer, { mimeType })
        } else {
          console.error(`画像の取得に失敗しました: HTTP ${imageRes.status}`)
        }
      } catch (imgError) {
        console.error('画像アップロードエラー（テキストのみで試行します）:', imgError)
      }
    }

    // 6. Xへ投稿
    if (mediaId) {
      await twitterClient.v2.tweet({
        text: tweetText,
        media: { media_ids: [mediaId] },
      })
    } else {
      await twitterClient.v2.tweet(tweetText)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    // X APIのエラーレスポンス詳細を出力
    console.error('X自動投稿エラー詳細:', error?.data || error)
    return NextResponse.json({ error: 'Failed to post tweet', details: error?.data }, { status: 500 })
  }
}