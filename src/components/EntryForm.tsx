'use client';
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import type { FlattenedError } from 'zod';
import { EntrySchema } from '@/lib/validation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Download, PlusCircle, Trash2, X } from 'lucide-react';
import type { AttachmentRecord as GenericAttachmentRecord, AttachmentValue as GenericAttachmentValue } from '@/lib/attachments';
import { sanitizeAttachmentRecord, sanitizeAttachmentValue } from '@/lib/attachments';

type Borrower = { fullName: string; nationalId: string };
type FormData = {
  no: number;
  address: string;
  extra: string;
  island: string;
  formNumber: string;
  date: string;
  branch: string;
  agreementNumber: string;
  status: 'ONGOING' | 'CANCELLED' | 'COMPLETED';
  loanAmount: number;
  dateOfCancelled?: string | null;
  borrowers: Borrower[];
};

const emptyBorrower: Borrower = { fullName: '', nationalId: '' };

const statusOptions: { value: FormData['status']; label: string }[] = [
  { value: 'ONGOING', label: 'Active' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'COMPLETED', label: 'Completed' },
];

const ATTACHMENT_FIELDS = [
  { key: 'bankLetter', label: 'Bank Letter' },
  { key: 'agreementDocument', label: 'Agreement Document' },
  { key: 'landRegistry', label: 'Land Registry' },
] as const;

type AttachmentKey = (typeof ATTACHMENT_FIELDS)[number]['key'];

type AttachmentValue = GenericAttachmentValue;

type AttachmentRecord = Pick<GenericAttachmentRecord, AttachmentKey>;

type AttachmentErrors = Record<AttachmentKey, string | null>;

const ATTACHMENT_KEYS: AttachmentKey[] = ATTACHMENT_FIELDS.map(({ key }) => key);

const createEmptyAttachmentValue = (): AttachmentValue => sanitizeAttachmentValue(null);

const createEmptyAttachmentRecord = (): AttachmentRecord =>
  ATTACHMENT_KEYS.reduce((acc, key) => {
    acc[key] = createEmptyAttachmentValue();
    return acc;
  }, {} as AttachmentRecord);

const createEmptyAttachmentErrors = (): AttachmentErrors =>
  ATTACHMENT_KEYS.reduce((acc, key) => {
    acc[key] = null;
    return acc;
  }, {} as AttachmentErrors);

const readFileAsDataURL = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const sanitizeAttachmentRecordWithKeys = (
  value: Partial<Record<AttachmentKey, Partial<AttachmentValue>>> | null | undefined,
): AttachmentRecord => {
  return sanitizeAttachmentRecord(value ?? undefined, ATTACHMENT_KEYS) as AttachmentRecord;
};

const isPdf = (file: File | null | undefined) =>
  !!file && file.type === 'application/pdf' && file.name.toLowerCase().endsWith('.pdf');

const formatFileSize = (bytes: number) => {
  if (Number.isNaN(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
};

const MAX_TOTAL_SIZE = 8 * 1024 * 1024; // 8 MB

const createFileFromDataUrl = (dataUrl: string, fileName: string): File => {
  const [meta, content] = dataUrl.split(',');
  const mimeMatch = meta.match(/data:(.*);base64/);
  const mimeType = mimeMatch?.[1] ?? 'application/pdf';
  const binary = atob(content);
  const length = binary.length;
  const array = new Uint8Array(length);
  for (let i = 0; i < length; i += 1) {
    array[i] = binary.charCodeAt(i);
  }
  return new File([array], fileName, { type: mimeType });
};

export default function EntryForm({ mode, id }: { mode: 'create' | 'edit'; id?: string }) {
  const router = useRouter();
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;
  const canWrite = role === 'ADMIN' || role === 'DATA_ENTRY';
  const [data, setData] = useState<FormData>({
    no: 0,
    address: '',
    extra: '',
    island: '',
    formNumber: '',
    date: '',
    branch: '',
    agreementNumber: '',
    status: 'ONGOING',
    loanAmount: 0,
    dateOfCancelled: null,
    borrowers: [emptyBorrower],
  });
  const [errors, setErrors] = useState<FlattenedError<FormData> | null>(null);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const storageKey = useMemo(() => (mode === 'edit' && id ? `entry-attachments-${id}` : 'entry-attachments-new'), [mode, id]);
  const [attachments, setAttachments] = useState<AttachmentRecord>(createEmptyAttachmentRecord);
  const [attachmentErrors, setAttachmentErrors] = useState<AttachmentErrors>(createEmptyAttachmentErrors);
  const [totalSize, setTotalSize] = useState(0);
  const [persistenceError, setPersistenceError] = useState<string | null>(null);
  const disableSubmit = useMemo(() => loading || totalSize > MAX_TOTAL_SIZE, [loading, totalSize]);
  const fileInputRefs = useRef<Record<AttachmentKey, HTMLInputElement | null>>({
    bankLetter: null,
    agreementDocument: null,
    landRegistry: null,
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.sessionStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<AttachmentRecord> | null;
      const next = sanitizeAttachmentRecordWithKeys(parsed ?? undefined);
      setAttachments(next);
      const size = Object.values(next).reduce((acc, item) => acc + (item.size ?? 0), 0);
      setTotalSize(size);
    } catch (error) {
      console.error('Failed to hydrate attachments', error);
      setPersistenceError('Unable to load draft attachments. Your files will persist for this session only.');
    }
  }, [storageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const size = Object.values(attachments).reduce((acc, item) => acc + (item.size ?? 0), 0);
    setTotalSize(size);
    try {
      window.sessionStorage.setItem(storageKey, JSON.stringify(attachments));
      setPersistenceError(null);
    } catch (error) {
      console.warn('Failed to persist attachments in sessionStorage', error);
      setPersistenceError('Storage quota reached. Files will remain available while this page stays open.');
    }
  }, [attachments, storageKey]);

  useEffect(()=>{ if(mode==='edit' && id){ fetch(`/api/entries/${id}`).then(r=>r.json()).then(e=>{ setData({ no:e.no,address:e.address,extra:e.extra,island:e.island,formNumber:e.formNumber,date:e.date.slice(0,10),branch:e.branch,agreementNumber:e.agreementNumber,status:e.status,loanAmount:Number(e.loanAmount),dateOfCancelled:e.dateOfCancelled?e.dateOfCancelled.slice(0,10):null,borrowers:e.borrowers.map((b:any)=>({fullName:b.fullName,nationalId:b.nationalId})) }); if(e.attachments){ setAttachments(sanitizeAttachmentRecordWithKeys(e.attachments)); } }); } },[mode,id]);
  const handleAttachmentChange = async (key: AttachmentKey, event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) {
      setAttachments((prev) => ({ ...prev, [key]: createEmptyAttachmentValue() }));
      setAttachmentErrors((prev) => ({ ...prev, [key]: null }));
      input.value = '';
      return;
    }
    if (!isPdf(file)) {
      setAttachmentErrors((prev) => ({ ...prev, [key]: 'Only PDF files are allowed.' }));
      setAttachments((prev) => ({ ...prev, [key]: createEmptyAttachmentValue() }));
      input.value = '';
      return;
    }
    const existingSize = Object.entries(attachments)
      .filter(([attachmentKey]) => attachmentKey !== key)
      .reduce((acc, [, item]) => acc + (item.size ?? 0), 0);
    const nextSize = existingSize + file.size;
    if (nextSize > MAX_TOTAL_SIZE) {
      setAttachmentErrors((prev) => ({ ...prev, [key]: `Combined file size exceeds ${formatFileSize(MAX_TOTAL_SIZE)}.` }));
      input.value = '';
      return;
    }
    try {
      const dataUrl = await readFileAsDataURL(file);
      setAttachments((prev) => ({
        ...prev,
        [key]: {
          name: file.name,
          dataUrl,
          size: file.size,
        },
      }));
      setAttachmentErrors((prev) => ({ ...prev, [key]: null }));
    } catch (error) {
      console.error('Failed to read file', error);
      setAttachmentErrors((prev) => ({ ...prev, [key]: 'Unable to read file.' }));
    } finally {
      input.value = '';
    }
  };

  const downloadAttachment = (value: AttachmentValue | null) => {
    if (!value || !value.dataUrl) return;
    const link = document.createElement('a');
    link.href = value.dataUrl;
    link.download = value.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const removeAttachment = (key: AttachmentKey) => {
    setAttachments((prev) => ({
      ...prev,
      [key]: createEmptyAttachmentValue(),
    }));
    setAttachmentErrors((prev) => ({ ...prev, [key]: null }));
    const input = fileInputRefs.current[key];
    if (input) input.value = '';
  };

  const openFilePicker = (key: AttachmentKey) => {
    const input = fileInputRefs.current[key];
    input?.click();
  };

  const validateAttachments = () => {
    let valid = true;
    const nextErrors = createEmptyAttachmentErrors();
    const size = Object.values(attachments).reduce((acc, item) => acc + (item.size ?? 0), 0);
    if (size > MAX_TOTAL_SIZE) {
      valid = false;
      ATTACHMENT_FIELDS.forEach(({ key }) => {
        nextErrors[key] = nextErrors[key] ?? `Combined file size exceeds ${formatFileSize(MAX_TOTAL_SIZE)}.`;
      });
    }
    ATTACHMENT_FIELDS.forEach(({ key }) => {
      const item = attachments[key];
      if (!item.dataUrl) {
        nextErrors[key] = 'Please upload a PDF file.';
        valid = false;
      }
    });
    setAttachmentErrors(nextErrors);
    return valid;
  };

  const validate = () => {
    const result = EntrySchema.safeParse(data);
    if (!result.success) {
      setErrors(result.error.flatten());
      return false;
    }
    setErrors(null);
    return validateAttachments();
  };
const submit = async () => {
    if (!canWrite) {
      // eslint-disable-next-line no-alert
      alert('Forbidden');
      return;
    }
    if (!validate()) return;

    setLoading(true);
    const payload = { ...data, attachments };
    const method = mode === 'create' ? 'POST' : 'PUT';
    const url = mode === 'create' ? '/api/entries' : `/api/entries/${id}`;

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        try {
          const result = await res.json();
          setServerError(result.error || JSON.stringify(result.errors));
        } catch (error) {
          setServerError('Failed to save entry');
        }
        return;
      }

      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem(storageKey);
        router.push('/entries');
      }
    } catch (error) {
      console.error('Submission failed', error);
      setServerError('Failed to save entry');
    } finally {
      setLoading(false);
    }
  };
  if(!canWrite) return <p>You have read-only access (Viewer).</p>;
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <Badge variant="outline" className="w-fit uppercase tracking-widest text-xs text-muted-foreground">
          {mode === 'create' ? 'New Entry' : 'Edit Entry'}
        </Badge>
        <h1 className="text-3xl font-semibold text-foreground">Registry Entry</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Manage borrower agreements, island assignments, and loan metadata in one place.
        </p>
      </div>

      {serverError ? (
        <Alert variant="destructive">
          <AlertTitle>Submission failed</AlertTitle>
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="backdrop-blur dark:border-slate-800/60 dark:bg-slate-900/40">
        <CardHeader className="space-y-2 border-b border-border/60">
          <CardTitle className="text-xl text-foreground">Agreement Details</CardTitle>
          <CardDescription>
            Enter primary registry information and core agreement identifiers.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="no">Registry Number</Label>
              <Input
                id="no"
                type="number"
                value={data.no}
                onChange={(e) => setData({ ...data, no: Number(e.target.value) })}
                placeholder="1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="formNumber">Form Number</Label>
              <Input
                id="formNumber"
                value={data.formNumber}
                onChange={(e) => setData({ ...data, formNumber: e.target.value })}
                placeholder="123/2024"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={data.date}
                onChange={(e) => setData({ ...data, date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="branch">Branch</Label>
              <Input
                id="branch"
                value={data.branch}
                onChange={(e) => setData({ ...data, branch: e.target.value })}
                placeholder="Select branch"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="agreementNumber">Agreement Number</Label>
              <Input
                id="agreementNumber"
                value={data.agreementNumber}
                onChange={(e) => setData({ ...data, agreementNumber: e.target.value })}
                placeholder="AGR2023001"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="island">Island</Label>
              <Input
                id="island"
                value={data.island}
                onChange={(e) => setData({ ...data, island: e.target.value })}
                placeholder="Malé"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={data.address}
                onChange={(e) => setData({ ...data, address: e.target.value })}
                placeholder="H. Vinares"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="extra">Dhivehi Address / Notes</Label>
              <Input
                id="extra"
                value={data.extra}
                onChange={(e) => setData({ ...data, extra: e.target.value })}
                placeholder="ދިވެހި ތަފާތު"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={data.status}
                onValueChange={(value) =>
                  setData({
                    ...data,
                    status: value as FormData['status'],
                    dateOfCancelled: value === 'CANCELLED' ? data.dateOfCancelled ?? '' : null,
                  })
                }
              >
                <SelectTrigger id="status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="loanAmount">Loan Amount (MVR)</Label>
              <Input
                id="loanAmount"
                type="number"
                step="0.01"
                value={data.loanAmount}
                onChange={(e) => setData({ ...data, loanAmount: Number(e.target.value) })}
                placeholder="50000"
              />
            </div>
            {data.status === 'CANCELLED' ? (
              <div className="space-y-2">
                <Label htmlFor="dateOfCancelled">Date Cancelled</Label>
                <Input
                  id="dateOfCancelled"
                  type="date"
                  value={data.dateOfCancelled ?? ''}
                  onChange={(e) => setData({ ...data, dateOfCancelled: e.target.value })}
                />
              </div>
            ) : null}
          </div>

          {errors?.fieldErrors ? (
            <Alert variant="destructive">
              <AlertTitle>Validation issues</AlertTitle>
              <AlertDescription className="space-y-1 text-xs">
                {(Object.entries(errors.fieldErrors) as Array<[string, string[] | undefined]>).map(([key, value]) => {
                  const message = Array.isArray(value) ? value.join(', ') : value ?? '';
                  return (
                    <div key={key} className="capitalize text-foreground">
                      {key}: {message}
                    </div>
                  );
                })}
              </AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      <Card className="backdrop-blur dark:border-slate-800/60 dark:bg-slate-900/40">
        <CardHeader className="space-y-2 border-b border-border/60">
          <CardTitle className="text-xl text-foreground">Supporting Documents</CardTitle>
          <CardDescription>Upload required documents (PDF only).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          {persistenceError ? (
            <Alert variant="destructive">
              <AlertTitle>Storage issue</AlertTitle>
              <AlertDescription>{persistenceError}</AlertDescription>
            </Alert>
          ) : null}
          <div className="grid gap-6 md:grid-cols-3">
            {ATTACHMENT_FIELDS.map(({ key, label }) => {
              const file = attachments[key];
              const errorMessage = attachmentErrors[key];
              return (
                <div key={key} className="space-y-2">
                  <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-card p-3 shadow-sm">
                    <div className="flex items-center justify-between">
                      <Label htmlFor={`attachment-${key}`