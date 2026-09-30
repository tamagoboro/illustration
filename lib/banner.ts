// トップページの画像バナー（「イラストレーター・クリエイターの方へ」の上に表示）
// 画像は 1500×500（3:1）推奨。public/ に置いた画像は '/ファイル名'、外部画像はURLをそのまま指定する。
// enabled を false にするとバナーごと非表示になる。
export const TOP_BANNER = {
  enabled: true,
  imageUrl: '/banner.png',
  alt: 'テスト画像',
  // クリック時の遷移先。サイト内のページなら '/guide' のようなパスも指定できる
  href: 'https://example.com',
}
