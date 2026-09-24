// アイコン画像・作品画像を差し替えるたびに、古いファイルが Supabase Storage の
// 「portfolios」バケットに残り続けていた問題の一次対応スクリプト。
//
// ダッシュボード側のアップロード処理（app/dashboard/page.tsx）は今回修正済みで、
// 今後は保存が成功するたびに古いファイルを自動削除するようになった。
// このスクリプトは、それより前に溜まってしまった「もうどこからも参照されていない
// 古いファイル」を一度だけ掃除するためのもの。
//
// 安全のため、既定では削除せず「削除対象になりそうなファイル一覧」を表示するだけの
// ドライラン。実際に削除する場合だけ --delete を付けて実行すること。
//
// 使い方:
//   1. Supabase管理画面 > Project Settings > API から service_role キーを取得する
//      （anonキーではなく、必ずservice_roleキー。他人に絶対に渡さないこと）
//   2. 環境変数を設定して実行する（PowerShellの例）:
//        $env:NEXT_PUBLIC_SUPABASE_URL = "https://xxxx.supabase.co"
//        $env:SUPABASE_SERVICE_ROLE_KEY = "xxxxxxxx"
//        node scripts/cleanup-orphaned-storage.mjs            ← まずはドライラン
//        node scripts/cleanup-orphaned-storage.mjs --delete   ← 内容を確認してから実削除
//
// 安全設計:
//   - user_id（UUID形式）のフォルダ配下にあるファイルだけを削除候補にする。
//     bg.png（サイト背景画像）や rings/ 配下（アイコンリング画像）のような
//     ルート直下・固定パスのファイルは、ユーザーがアップロードし直す対象ではないため
//     最初から削除候補にすら入れない。
//   - profiles.avatar_url / portfolio_items.image_url / reviews.image_urls /
//     requests.image_urls / posts.image_urls / icon_rings.image_url のいずれかから
//     参照されているファイルは、どれだけ古くても削除しない。

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const BUCKET = 'portfolios'
const UUID_FOLDER_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const shouldDelete = process.argv.includes('--delete')

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('環境変数 NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を設定してから実行してください。')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

// 公開URLから「バケット内のパス」だけを取り出す
function extractPath(url) {
  if (!url) return null
  const marker = `/storage/v1/object/public/${BUCKET}/`
  const idx = url.indexOf(marker)
  if (idx === -1) return null
  return decodeURIComponent(url.slice(idx + marker.length).split('?')[0])
}

async function collectReferencedPaths() {
  const referenced = new Set()
  const add = (url) => {
    const path = extractPath(url)
    if (path) referenced.add(path)
  }
  const addArray = (urls) => {
    if (Array.isArray(urls)) urls.forEach(add)
  }

  const [profiles, portfolioItems, reviews, requests, posts, iconRings] = await Promise.all([
    supabase.from('profiles').select('avatar_url'),
    supabase.from('portfolio_items').select('image_url'),
    supabase.from('reviews').select('image_urls'),
    supabase.from('requests').select('image_urls'),
    supabase.from('posts').select('image_urls'),
    supabase.from('icon_rings').select('image_url'),
  ])

  ;(profiles.data || []).forEach((r) => add(r.avatar_url))
  ;(portfolioItems.data || []).forEach((r) => add(r.image_url))
  ;(reviews.data || []).forEach((r) => addArray(r.image_urls))
  ;(requests.data || []).forEach((r) => addArray(r.image_urls))
  ;(posts.data || []).forEach((r) => addArray(r.image_urls))
  ;(iconRings.data || []).forEach((r) => add(r.image_url))

  return referenced
}

// Storage の list() は1階層ずつしか見えないので、まずルートでフォルダ一覧を取り、
// UUID形式のフォルダ（=ユーザーの作品/アイコン置き場）だけを深掘りする
async function listAllUserFiles() {
  const allFiles = []
  let offset = 0
  const limit = 1000

  while (true) {
    const { data, error } = await supabase.storage.from(BUCKET).list('', { limit, offset })
    if (error) throw error
    if (!data || data.length === 0) break

    for (const entry of data) {
      if (entry.id === null && UUID_FOLDER_RE.test(entry.name)) {
        let subOffset = 0
        while (true) {
          const { data: subData, error: subError } = await supabase.storage
            .from(BUCKET)
            .list(entry.name, { limit, offset: subOffset })
          if (subError) throw subError
          if (!subData || subData.length === 0) break
          subData
            .filter((f) => f.id !== null)
            .forEach((f) => allFiles.push({ path: `${entry.name}/${f.name}`, size: f.metadata?.size || 0 }))
          if (subData.length < limit) break
          subOffset += limit
        }
      }
    }

    if (data.length < limit) break
    offset += limit
  }

  return allFiles
}

async function main() {
  console.log('参照されているファイルを集計中...')
  const referenced = await collectReferencedPaths()
  console.log(`参照中のファイル数: ${referenced.size}`)

  console.log('ストレージ内のファイル一覧を取得中...')
  const allFiles = await listAllUserFiles()
  console.log(`ユーザーフォルダ内の総ファイル数: ${allFiles.length}`)

  const orphaned = allFiles.filter((f) => !referenced.has(f.path))
  const totalBytes = orphaned.reduce((sum, f) => sum + f.size, 0)

  console.log('')
  console.log(`削除候補（どこからも参照されていないファイル）: ${orphaned.length}件 / 約${(totalBytes / 1024 / 1024).toFixed(1)}MB`)
  orphaned.forEach((f) => console.log(`  - ${f.path} (${(f.size / 1024).toFixed(1)}KB)`))

  if (orphaned.length === 0) {
    console.log('削除対象はありませんでした。')
    return
  }

  if (!shouldDelete) {
    console.log('')
    console.log('※ ドライランのため削除は行っていません。内容を確認のうえ、問題なければ --delete を付けて再実行してください。')
    return
  }

  console.log('')
  console.log('削除を実行します...')
  const paths = orphaned.map((f) => f.path)
  for (let i = 0; i < paths.length; i += 100) {
    const batch = paths.slice(i, i + 100)
    const { error } = await supabase.storage.from(BUCKET).remove(batch)
    if (error) {
      console.error(`削除エラー（${i}件目〜）:`, error)
    } else {
      console.log(`${i + batch.length}/${paths.length}件 削除しました`)
    }
  }
  console.log('完了しました。')
}

main().catch((e) => {
  console.error('スクリプト実行中にエラーが発生しました:', e)
  process.exit(1)
})
