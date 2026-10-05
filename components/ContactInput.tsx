'use client'

import { CONTACT_SERVICES, joinContact, splitContact } from '@/lib/agreements'

// 連絡先の入力（サービスを選んでIDを書く）。値は「サービス名: ID」の1つの文字列
export default function ContactInput({ value, onChange, required = false }: { value: string; onChange: (value: string) => void; required?: boolean }) {
  const { service, id } = splitContact(value)
  return (
    <div className="flex gap-2">
      <select
        value={service}
        onChange={(e) => onChange(joinContact(e.target.value, id))}
        className="w-32 shrink-0 px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-400"
      >
        {CONTACT_SERVICES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <input
        value={id}
        required={required}
        maxLength={180}
        onChange={(e) => onChange(joinContact(service, e.target.value))}
        placeholder={service === 'メール' ? 'example@mail.com' : service === 'Discord' ? 'ユーザー名' : '@id'}
        className="flex-1 min-w-0 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400"
      />
    </div>
  )
}
