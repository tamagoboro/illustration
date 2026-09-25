/** @type {import('next').NextConfig} */
const nextConfig = {
  // セキュリティ関連のレスポンスヘッダ。
  // Content-Security-Policy は、Supabase・X・QRコード生成など外部との通信先が多く、
  // 入れ方を誤るとサイトが動かなくなるため、ここでは設定していない（入れる場合は Report-Only から始める）。
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // ブラウザによるContent-Typeの推測（MIMEスニッフィング）を禁止
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // 他サイトの <iframe> に埋め込まれてクリックを盗まれる（クリックジャッキング）のを防ぐ
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          // 他サイトへ遷移するときにURLの全文（パスやクエリ）を送らない
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // 使っていないブラウザ機能を無効化
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
