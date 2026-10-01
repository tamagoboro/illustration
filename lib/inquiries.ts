// お問い合わせの種類（supabase/add_inquiries_and_google_signup.sql の inquiries.category と合わせる）
export const INQUIRY_CATEGORIES = [
  { value: 'general', label: '使い方・サービスについて' },
  { value: 'account', label: 'アカウント（ログイン・削除など）' },
  { value: 'trouble', label: '不具合のご報告' },
  { value: 'report', label: '規約違反・トラブルのご報告' },
  { value: 'business', label: '取材・提携のご相談' },
  { value: 'other', label: 'その他・ご要望' },
] as const

export type InquiryCategory = (typeof INQUIRY_CATEGORIES)[number]['value']

export const inquiryCategoryLabel = (value: string) =>
  INQUIRY_CATEGORIES.find((c) => c.value === value)?.label ?? value

export const INQUIRY_LIMITS = { name: 50, email: 254, message: 3000 }
