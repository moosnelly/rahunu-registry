import { notFound } from 'next/navigation';
import EntryForm from '@/components/EntryForm';
import { prisma } from '@/lib/db';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditEntry(props: PageProps) {
  const params = await props.params;
  
  // Prefetch entry data on the server for faster page loads
  const entry = await prisma.registryEntry.findUnique({
    where: { id: params.id },
    include: {
      borrowers: {
        orderBy: { fullName: 'asc' },
      },
    },
  });

  if (!entry) {
    notFound();
  }

  // Transform data for the form
  const initialData = {
    id: entry.id,
    no: entry.no ?? 0,
    address: entry.address ?? '',
    island: entry.island ?? '',
    formNumber: entry.formNumber ?? '',
    date: entry.date ? entry.date.toISOString().slice(0, 10) : '',
    branch: entry.branch ?? '',
    agreementNumber: entry.agreementNumber ?? '',
    status: entry.status ?? 'ONGOING',
    loanAmount: entry.loanAmount ? Number(entry.loanAmount) : 0,
    dateOfCancelled: entry.dateOfCancelled ? entry.dateOfCancelled.toISOString().slice(0, 10) : null,
    dateOfCompleted: entry.dateOfCompleted ? entry.dateOfCompleted.toISOString().slice(0, 10) : null,
    borrowers: entry.borrowers.length > 0
      ? entry.borrowers.map((borrower) => ({
          fullName: borrower.fullName ?? '',
          nationalId: borrower.nationalId ?? '',
        }))
      : [{ fullName: '', nationalId: '' }],
    attachments: entry.attachments || null,
  };

  return <EntryForm mode="edit" id={params.id} initialData={initialData} />;
}
