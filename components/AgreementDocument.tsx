import { DocumentSource, agreementTotal, buildAgreementDocument, yen } from '@/lib/agreementDocument'

// できあがる合意書（条文の形）。控えの画面と、作成画面のプレビューで共通。印刷するとそのまま書類になる。
export default function AgreementDocument({
  source,
  names,
  footer,
}: {
  source: DocumentSource
  names: { creator: string; client: string }
  footer?: React.ReactNode
}) {
  const doc = buildAgreementDocument(source, names)
  const total = agreementTotal(source)
  return (
    <div className="font-serif text-slate-800 leading-[1.9] text-[13.5px] sm:text-sm">
      <div className="text-center space-y-1 pb-4 border-b-2 border-slate-800">
        <h2 className="text-lg sm:text-xl font-bold tracking-[0.2em]">{doc.heading}</h2>
        <p className="text-sm font-bold">「{source.title || '（タイトル未入力）'}」</p>
      </div>

      {total !== null && (
        <div className="my-4 grid grid-cols-2 gap-2 text-center font-sans">
          <div className="rounded-xl bg-slate-50 py-2">
            <p className="text-[10px] font-black text-slate-400">合計金額</p>
            <p className="text-base font-black text-slate-900 tabular-nums">{yen(total)}</p>
          </div>
          <div className="rounded-xl bg-slate-50 py-2">
            <p className="text-[10px] font-black text-slate-400">納期</p>
            <p className="text-base font-black text-slate-900">
              {source.deadline ? new Date(`${source.deadline}T00:00:00+09:00`).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'long', day: 'numeric' }) : '未定'}
            </p>
          </div>
        </div>
      )}

      <p className="my-4 indent-[1em]">{doc.preamble}</p>

      <div className="space-y-5">
        {doc.articles.map((article, i) => (
          <section key={article.title} className="break-inside-avoid">
            <h3 className="font-bold">
              第{i + 1}条（{article.title}）
            </h3>
            <ol className="mt-1 space-y-1">
              {article.items.map((item, j) => (
                <li key={j} className="flex gap-2">
                  {article.items.length > 1 && <span className="shrink-0 tabular-nums">{j + 1}.</span>}
                  <div className="min-w-0">
                    <p className="break-words">{item.text}</p>
                    {item.lines && item.lines.length > 0 && (
                      <ul className="mt-1 mb-1 pl-3 border-l-2 border-slate-200 space-y-0.5">
                        {item.lines.map((line, k) => (
                          <li key={k} className="break-words whitespace-pre-wrap">
                            ・{line}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>

      {footer && <div className="mt-6 pt-4 border-t border-slate-300">{footer}</div>}
    </div>
  )
}
