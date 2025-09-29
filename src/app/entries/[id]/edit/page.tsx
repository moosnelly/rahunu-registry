import EntryForm from '@/components/EntryForm';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditEntry(props: PageProps) {
  const params = await props.params;
  return <EntryForm mode="edit" id={params.id} />;
}
