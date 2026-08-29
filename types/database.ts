export type Profile = {
  id: string
  name: string
  avatar_url?: string
  bio?: string
  website?: string
  twitter_username?: string
  created_at?: string
  [key: string]: any // 他のプロパティがあってもエラーにならないよう補完
}