// シェア用カード画像（app/api/og/creator/[id]）のバージョン管理。
//
// X等はカード画像を「画像のURL」単位で、カードの情報（タイトル・画像）を「シェアされたページのURL」単位で、
// それぞれ長期間（Xは約1週間）キャッシュする。同じURLのままだと、カードのデザインやプロフィールを
// 変えても古いカードが出続けるため、次のどちらかが変わったらURLも変わるようにしている。
//   ・プロフィールの更新日時（料金・受付状況などの変更）
//   ・OG_CARD_DESIGN_VERSION（カードのデザインを変えたら数字を1つ上げる）

export const OG_CARD_DESIGN_VERSION = 3

export const getOgCardVersion = (updatedAt?: string | null) =>
  `${updatedAt ? new Date(updatedAt).getTime() : 0}-${OG_CARD_DESIGN_VERSION}`

// SNSでシェアするときのクリエイターページのURL。?s= が変わるとXは別のURLとして扱い、カードを取り直す
// （検索エンジン向けの正規URLは ?s= なしの /creator/{id} のまま）
export const getCreatorShareUrl = (origin: string, id: string, updatedAt?: string | null) =>
  `${origin}/creator/${id}?s=${getOgCardVersion(updatedAt)}`
