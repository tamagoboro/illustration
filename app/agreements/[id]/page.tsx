import AgreementView from './AgreementView'

export default async function AgreementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <AgreementView id={id} />
}
