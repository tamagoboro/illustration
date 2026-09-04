import { NextRequest, NextResponse } from 'next/server'
import PDFDocument from 'pdfkit'

type RequestBody = {
  creatorName: string
  formTitle: string
  answers: { label: string; value: string }[]
  totalPrice: number
  thanksMessage?: string
}

export async function POST(req: NextRequest) {
  try {
    const body: RequestBody = await req.json()
    const { creatorName, formTitle, answers, totalPrice, thanksMessage } = body

    // 日本語フォント（Google Fonts等）をオンラインから取得
    // ※ サーバー環境にローカルフォントを置かない場合でも動作するように読み込みます
    const fontUrl =
      'https://github.com/google/fonts/raw/main/ofl/notosansjp/NotoSansJP-Regular.ttf'
    const fontBoldUrl =
      'https://github.com/google/fonts/raw/main/ofl/notosansjp/NotoSansJP-Bold.ttf'

    const [fontRes, fontBoldRes] = await Promise.all([
      fetch(fontUrl),
      fetch(fontBoldUrl),
    ])

    if (!fontRes.ok || !fontBoldRes.ok) {
      throw new Error('フォントデータの取得に失敗しました')
    }

    const fontBuffer = Buffer.from(await fontRes.arrayBuffer())
    const fontBoldBuffer = Buffer.from(await fontBoldRes.arrayBuffer())

    // PDFドキュメントの作成
    const doc = new PDFDocument({
      size: 'A4',
      margin: 40,
    })

    // フォントを登録
    doc.registerFont('NotoSans', fontBuffer)
    doc.registerFont('NotoSans-Bold', fontBoldBuffer)

    // PDFをメモリバッファへ書き出すストリーム設定
    const chunks: Uint8Array[] = []
    doc.on('data', (chunk) => chunks.push(chunk))

    const pdfPromise = new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', (err) => reject(err))
    })

    // ----------------------------------------------------
    // PDFレイアウトのデザイン構築
    // ----------------------------------------------------

    // ヘッダー背景アクセント
    doc.rect(0, 0, 595.28, 12).fill('#4f46e5')

    // タイトル
    doc
      .fillColor('#1e293b')
      .font('NotoSans-Bold')
      .fontSize(20)
      .text(formTitle || '見積仕様書', 40, 45)

    doc
      .fillColor('#64748b')
      .font('NotoSans')
      .fontSize(10)
      .text(`作成日: ${new Date().toLocaleDateString('ja-JP')}`, 40, 72)

    // 宛先情報
    doc
      .fillColor('#0f172a')
      .font('NotoSans-Bold')
      .fontSize(12)
      .text(`提出先 (クリエイター名): ${creatorName} 様`, 40, 100)

    doc
      .moveTo(40, 120)
      .lineTo(555, 120)
      .strokeColor('#e2e8f0')
      .lineWidth(1)
      .stroke()

    // 概算合計金額ボックス
    doc
      .roundedRect(40, 135, 515, 60, 8)
      .fillAndStroke('#f8fafc', '#e2e8f0')

    doc
      .fillColor('#475569')
      .font('NotoSans-Bold')
      .fontSize(10)
      .text('概算見積もり合計金額 (税込)', 60, 148)

    doc
      .fillColor('#4f46e5')
      .font('NotoSans-Bold')
      .fontSize(22)
      .text(`¥${totalPrice.toLocaleString()} -`, 60, 163)

    // 選択項目テーブル
    doc
      .fillColor('#0f172a')
      .font('NotoSans-Bold')
      .fontSize(12)
      .text('【ご依頼・見積もり内容】', 40, 215)

    let currentY = 235

    answers.forEach((ans) => {
      if (currentY > 720) {
        doc.addPage()
        currentY = 40
      }

      // 項目名
      doc
        .fillColor('#334155')
        .font('NotoSans-Bold')
        .fontSize(10)
        .text(ans.label, 40, currentY, { width: 140 })

      // 選択内容・入力内容
      doc
        .fillColor('#0f172a')
        .font('NotoSans')
        .fontSize(10)
        .text(ans.value, 190, currentY, { width: 365 })

      const textHeight = doc.heightOfString(ans.value, { width: 365 })
      currentY += Math.max(textHeight, 16) + 10

      // 区切り線
      doc
        .moveTo(40, currentY - 5)
        .lineTo(555, currentY - 5)
        .strokeColor('#f1f5f9')
        .lineWidth(0.5)
        .stroke()
    })

    // メッセージ / 補足注意事項
    if (currentY > 680) {
      doc.addPage()
      currentY = 40
    } else {
      currentY += 15
    }

    doc
      .roundedRect(40, currentY, 515, 65, 6)
      .fillAndStroke('#fafafa', '#f1f5f9')

    doc
      .fillColor('#64748b')
      .font('NotoSans-Bold')
      .fontSize(9)
      .text('【メッセージ・備考】', 50, currentY + 10)

    doc
      .fillColor('#334155')
      .font('NotoSans')
      .fontSize(9)
      .text(thanksMessage || 'ご検討ありがとうございます。', 50, currentY + 25, {
        width: 495,
      })

    // フッター注記
    doc
      .fillColor('#94a3b8')
      .font('NotoSans')
      .fontSize(8)
      .text(
        '※本PDFはシミュレーションによる概算仕様書です。正式な金額・納期はクリエイターとの打ち合わせ後に確定します。',
        40,
        780,
        { align: 'center', width: 515 }
      )

    // ドキュメント終了
    doc.end()

    const pdfBuffer = await pdfPromise

    // レスポンス返却 (PDFバイナリ)
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="estimate_${Date.now()}.pdf"`,
      },
    })
  } catch (error) {
    console.error('PDF Generation Error:', error)
    return NextResponse.json(
      { error: 'PDFの生成に失敗しました' },
      { status: 500 }
    )
  }
}