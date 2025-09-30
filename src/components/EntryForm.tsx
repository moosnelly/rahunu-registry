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
import { Download, PlusCircle, X } from 'lucide-react';
import type { AttachmentRecord as GenericAttachmentRecord, AttachmentValue as GenericAttachmentValue } from '@/lib/attachments';
import { sanitizeAttachmentRecord, sanitizeAttachmentValue } from '@/lib/attachments';

type Borrower = { fullName: string; nationalId: string };
type FormData = {
  no: number;
  address: string;
  island: string;
  formNumber: string;
  date: string;
  branch: string;
  agreementNumber: string;
  status: 'ONGOING' | 'CANCELLED' | 'COMPLETED';
  loanAmount: number;
  dateOfCancelled?: string | null;
  dateOfCompleted?: string | null;
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

const CANCELLATION_ATTACHMENT_KEY = 'cancellationBankDocument' as const;
const COMPLETION_ATTACHMENT_KEY = 'completionBankDocument' as const;

type AttachmentKey = (typeof ATTACHMENT_FIELDS)[number]['key'];
type CancellationAttachmentKey = typeof CANCELLATION_ATTACHMENT_KEY;
type CompletionAttachmentKey = typeof COMPLETION_ATTACHMENT_KEY;
type AllAttachmentKeys = AttachmentKey | CancellationAttachmentKey | CompletionAttachmentKey;

type AttachmentValue = GenericAttachmentValue;

type AttachmentRecord = Pick<GenericAttachmentRecord, AttachmentKey | CancellationAttachmentKey | CompletionAttachmentKey>;

type AttachmentErrors = Record<AllAttachmentKeys, string | null>;

const ATTACHMENT_KEYS: AttachmentKey[] = ATTACHMENT_FIELDS.map(({ key }) => key);

const createEmptyAttachmentValue = (): AttachmentValue => sanitizeAttachmentValue(null);

const createEmptyAttachmentRecord = (): AttachmentRecord => {
  const record = ATTACHMENT_KEYS.reduce((acc, key) => {
    acc[key] = createEmptyAttachmentValue();
    return acc;
  }, {} as AttachmentRecord);
  record[CANCELLATION_ATTACHMENT_KEY] = createEmptyAttachmentValue();
  record[COMPLETION_ATTACHMENT_KEY] = createEmptyAttachmentValue();
  return record;
};

const createEmptyAttachmentErrors = (): AttachmentErrors => {
  const errors = ATTACHMENT_KEYS.reduce((acc, key) => {
    acc[key] = null;
    return acc;
  }, {} as any);
  errors[CANCELLATION_ATTACHMENT_KEY] = null;
  errors[COMPLETION_ATTACHMENT_KEY] = null;
  return errors;
};

const readFileAsDataURL = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const sanitizeAttachmentRecordWithKeys = (
  value: Partial<Record<AllAttachmentKeys, Partial<AttachmentValue>>> | null | undefined,
): AttachmentRecord => {
  const allKeys = [...ATTACHMENT_KEYS, CANCELLATION_ATTACHMENT_KEY, COMPLETION_ATTACHMENT_KEY];
  return sanitizeAttachmentRecord(value ?? undefined, allKeys) as AttachmentRecord;
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
  const { data: session, status } = useSession();
  const role = (session?.user as any)?.role;
  const canWrite = role === 'ADMIN' || role === 'DATA_ENTRY';
  const [data, setData] = useState<FormData>({
    no: 0,
    address: '',
    island: '',
    formNumber: '',
    date: '',
    branch: '',
    agreementNumber: '',
    status: 'ONGOING',
    loanAmount: 0,
    dateOfCancelled: null,
    dateOfCompleted: null,
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
  const fileInputRefs = useRef<Record<AllAttachmentKeys, HTMLInputElement | null>>({
    bankLetter: null,
    agreementDocument: null,
    landRegistry: null,
    cancellationBankDocument: null,
    completionBankDocument: null,
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

  useEffect(() => {
    if (mode !== 'edit' || !id) return;

    const controller = new AbortController();

    const loadEntry = async () => {
      try {
        const response = await fetch(`/api/entries/${id}`, { signal: controller.signal });
        if (!response.ok) throw new Error('Failed to fetch entry');
        const entry = await response.json();

        setData({
          no: entry.no ?? 0,
          address: entry.address ?? '',
          island: entry.island ?? '',
          formNumber: entry.formNumber ?? '',
          date: entry.date ? entry.date.slice(0, 10) : '',
          branch: entry.branch ?? '',
          agreementNumber: entry.agreementNumber ?? '',
          status: entry.status ?? 'ONGOING',
          loanAmount: Number(entry.loanAmount) || 0,
          dateOfCancelled: entry.dateOfCancelled ? entry.dateOfCancelled.slice(0, 10) : null,
          dateOfCompleted: entry.dateOfCompleted ? entry.dateOfCompleted.slice(0, 10) : null,
          borrowers: Array.isArray(entry.borrowers) && entry.borrowers.length
            ? entry.borrowers.map((borrower: any) => ({
                fullName: borrower.fullName ?? '',
                nationalId: borrower.nationalId ?? '',
              }))
            : [emptyBorrower],
        });

        if (entry.attachments) {
          setAttachments(sanitizeAttachmentRecordWithKeys(entry.attachments));
        }
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('Failed to load entry', error);
          setServerError('Unable to load entry details. Please refresh and try again.');
        }
      }
    };

    void loadEntry();

    return () => {
      controller.abort();
    };
  }, [id, mode]);
  const handleAttachmentChange = async (key: AllAttachmentKeys, event: ChangeEvent<HTMLInputElement>) => {
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

  const removeAttachment = (key: AllAttachmentKeys) => {
    setAttachments((prev) => ({
      ...prev,
      [key]: createEmptyAttachmentValue(),
    }));
    setAttachmentErrors((prev) => ({ ...prev, [key]: null }));
    const input = fileInputRefs.current[key];
    if (input) input.value = '';
  };

  const openFilePicker = (key: AllAttachmentKeys) => {
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
    
    // Conditionally require cancellation bank document if status is CANCELLED
    if (data.status === 'CANCELLED') {
      const cancellationDoc = attachments.cancellationBankDocument;
      if (!cancellationDoc.dataUrl) {
        nextErrors.cancellationBankDocument = 'Bank document is required when status is Cancelled.';
        valid = false;
      }
    }
    
    // Conditionally require completion bank document if status is COMPLETED
    if (data.status === 'COMPLETED') {
      const completionDoc = attachments.completionBankDocument;
      if (!completionDoc.dataUrl) {
        nextErrors.completionBankDocument = 'Bank letter of completion is required when status is Completed.';
        valid = false;
      }
    }
    
    // All other attachments are always required
    ATTACHMENT_FIELDS.forEach(({ key }) => {
      const item = attachments[key];
      if (!item.dataUrl) {
        // Only set error if not already set
        if (!nextErrors[key]) {
          nextErrors[key] = 'Please upload a PDF file.';
          valid = false;
        }
      }
    });
    setAttachmentErrors(nextErrors);
    return valid;
  };

  const validate = () => {
    const payload = { ...data, attachments };
    const result = EntrySchema.safeParse(payload);
    if (!result.success) {
      setErrors(result.error.flatten());
      
      // Extract attachment-specific errors from the validation result
      const flatErrors = result.error.flatten();
      const nextAttachmentErrors = createEmptyAttachmentErrors();
      
      // Check if there are nested attachment errors
      if (flatErrors.fieldErrors && 'attachments.cancellationBankDocument' in flatErrors.fieldErrors) {
        const cancellationErrors = (flatErrors.fieldErrors as any)['attachments.cancellationBankDocument'];
        if (Array.isArray(cancellationErrors) && cancellationErrors.length > 0) {
          nextAttachmentErrors.cancellationBankDocument = cancellationErrors[0];
        }
      }
      
      if (flatErrors.fieldErrors && 'attachments.completionBankDocument' in flatErrors.fieldErrors) {
        const completionErrors = (flatErrors.fieldErrors as any)['attachments.completionBankDocument'];
        if (Array.isArray(completionErrors) && completionErrors.length > 0) {
          nextAttachmentErrors.completionBankDocument = completionErrors[0];
        }
      }
      
      setAttachmentErrors(nextAttachmentErrors);
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
  
  // Show loading state while session is being fetched
  if (status === 'loading') {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <Badge variant="outline" className="w-fit uppercase tracking-widest text-xs text-muted-foreground">
            {mode === 'create' ? 'New Entry' : 'Edit Entry'}
          </Badge>
          <h1 className="text-3xl font-semibold text-foreground">Registry Entry</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }
  
  // Only show read-only message after session has loaded
  if (!canWrite) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <Badge variant="outline" className="w-fit uppercase tracking-widest text-xs text-muted-foreground">
            {mode === 'create' ? 'New Entry' : 'Edit Entry'}
          </Badge>
          <h1 className="text-3xl font-semibold text-foreground">Registry Entry</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            You have read-only access (Viewer).
          </p>
        </div>
      </div>
    );
  }
  
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
              <Label htmlFor="status">Status</Label>
              <Select
                value={data.status}
                onValueChange={(value) =>
                  setData({
                    ...data,
                    status: value as FormData['status'],
                    dateOfCancelled: value === 'CANCELLED' ? data.dateOfCancelled ?? '' : null,
                    dateOfCompleted: value === 'COMPLETED' ? data.dateOfCompleted ?? '' : null,
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
              <>
                <div className="space-y-2">
                  <Label htmlFor="dateOfCancelled">Date Cancelled</Label>
                  <Input
                    id="dateOfCancelled"
                    type="date"
                    value={data.dateOfCancelled ?? ''}
                    onChange={(e) => setData({ ...data, dateOfCancelled: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cancellationBankDocumentInline" className="text-sm font-medium text-foreground">
                    Bank Document (Cancellation)<span className="ml-1 text-destructive">*</span>
                  </Label>
                  <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-muted/30 p-4">
                    <div className="space-y-1 text-xs text-muted-foreground">
                      {attachments.cancellationBankDocument?.name ? (
                        <div className="truncate font-medium text-foreground">{attachments.cancellationBankDocument.name}</div>
                      ) : (
                        <div>No file selected</div>
                      )}
                      {attachments.cancellationBankDocument?.size ? <div>{formatFileSize(attachments.cancellationBankDocument.size)}</div> : null}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1"
                        onClick={() => openFilePicker('cancellationBankDocument')}
                      >
                        <PlusCircle className="mr-2 h-4 w-4" />
                        {attachments.cancellationBankDocument?.dataUrl ? 'Change File' : 'Upload PDF'}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1"
                        onClick={() => downloadAttachment(attachments.cancellationBankDocument)}
                        disabled={!attachments.cancellationBankDocument?.dataUrl}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Download
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => removeAttachment('cancellationBankDocument')}
                        disabled={!attachments.cancellationBankDocument?.dataUrl}
                      >
                        Clear
                      </Button>
                    </div>
                    <input
                      ref={(element) => {
                        fileInputRefs.current.cancellationBankDocument = element;
                      }}
                      id="cancellationBankDocumentInline"
                      type="file"
                      accept="application/pdf"
                      className="hidden"
                      onChange={(event) => handleAttachmentChange('cancellationBankDocument', event)}
                    />
                  </div>
                  {attachmentErrors.cancellationBankDocument ? (
                    <p className="text-xs text-destructive">{attachmentErrors.cancellationBankDocument}</p>
                  ) : null}
                </div>
              </>
            ) : null}
            {data.status === 'COMPLETED' ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="dateOfCompleted">Date Completed</Label>
                  <Input
                    id="dateOfCompleted"
                    type="date"
                    value={data.dateOfCompleted ?? ''}
                    onChange={(e) => setData({ ...data, dateOfCompleted: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="completionBankDocumentInline" className="text-sm font-medium text-foreground">
                    Bank Letter (Completion)<span className="ml-1 text-destructive">*</span>
                  </Label>
                  <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-muted/30 p-4">
                    <div className="space-y-1 text-xs text-muted-foreground">
                      {attachments.completionBankDocument?.name ? (
                        <div className="truncate font-medium text-foreground">{attachments.completionBankDocument.name}</div>
                      ) : (
                        <div>No file selected</div>
                      )}
                      {attachments.completionBankDocument?.size ? <div>{formatFileSize(attachments.completionBankDocument.size)}</div> : null}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1"
                        onClick={() => openFilePicker('completionBankDocument')}
                      >
                        <PlusCircle className="mr-2 h-4 w-4" />
                        {attachments.completionBankDocument?.dataUrl ? 'Change File' : 'Upload PDF'}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1"
                        onClick={() => downloadAttachment(attachments.completionBankDocument)}
                        disabled={!attachments.completionBankDocument?.dataUrl}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Download
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => removeAttachment('completionBankDocument')}
                        disabled={!attachments.completionBankDocument?.dataUrl}
                      >
                        Clear
                      </Button>
                    </div>
                    <input
                      ref={(element) => {
                        fileInputRefs.current.completionBankDocument = element;
                      }}
                      id="completionBankDocumentInline"
                      type="file"
                      accept="application/pdf"
                      className="hidden"
                      onChange={(event) => handleAttachmentChange('completionBankDocument', event)}
                    />
                  </div>
                  {attachmentErrors.completionBankDocument ? (
                    <p className="text-xs text-destructive">{attachmentErrors.completionBankDocument}</p>
                  ) : null}
                </div>
              </>
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
                  <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-card p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <Label htmlFor={`attachment-${key}`} className="text-sm font-medium text-foreground">
                        {label}
                      </Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => openFilePicker(key)}
                      >
                        <PlusCircle className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      {file?.name ? <div className="truncate font-medium text-foreground">{file.name}</div> : <div>No file selected</div>}
                      {file?.size ? <div>{formatFileSize(file.size)}</div> : null}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1"
                        onClick={() => downloadAttachment(file)}
                        disabled={!file?.dataUrl}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Download
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="flex-1"
                        onClick={() => removeAttachment(key)}
                        disabled={!file?.dataUrl}
                      >
                        Clear
                      </Button>
                    </div>
                    <input
                      ref={(element) => {
                        fileInputRefs.current[key] = element;
                      }}
                      id={`attachment-${key}`}
                      type="file"
                      accept="application/pdf"
                      className="hidden"
                      onChange={(event) => handleAttachmentChange(key, event)}
                    />
                  </div>
                  {errorMessage ? <p className="text-xs text-destructive">{errorMessage}</p> : null}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="backdrop-blur dark:border-slate-800/60 dark:bg-slate-900/40">
        <CardHeader className="space-y-2 border-b border-border/60">
          <CardTitle className="text-xl text-foreground">Borrowers</CardTitle>
          <CardDescription>Capture borrower identities with national ID numbers.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div className="flex flex-col gap-4">
            {data.borrowers.map((borrower, index) => {
              return (
                <div
                  key={`borrower-${index}`}
                  className="rounded-lg border border-border/60 bg-card p-4 shadow-sm"
                >
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor={`borrower-name-${index}`}>Full Name</Label>
                      <Input
                        id={`borrower-name-${index}`}
                        value={borrower.fullName}
                        onChange={(event) => {
                          const value = event.target.value;
                          setData((prev) => {
                            const next = [...prev.borrowers];
                            next[index] = { ...next[index], fullName: value };
                            return { ...prev, borrowers: next };
                          });
                        }}
                        placeholder="Aishath Ahmed"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`borrower-nid-${index}`}>National ID</Label>
                      <Input
                        id={`borrower-nid-${index}`}
                        value={borrower.nationalId}
                        onChange={(event) => {
                          const value = event.target.value;
                          setData((prev) => {
                            const next = [...prev.borrowers];
                            next[index] = { ...next[index], nationalId: value };
                            return { ...prev, borrowers: next };
                          });
                        }}
                        placeholder="A123456"
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setData((prev) => {
                          if (prev.borrowers.length === 1) return prev;
                          return {
                            ...prev,
                            borrowers: prev.borrowers.filter((_, borrowerIndex) => borrowerIndex !== index),
                          };
                        });
                      }}
                      disabled={data.borrowers.length === 1}
                    >
                      <X className="mr-2 h-4 w-4" />
                      Remove borrower
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setData((prev) => ({ ...prev, borrowers: [...prev.borrowers, emptyBorrower] }));
            }}
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            Add borrower
          </Button>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            if (typeof window === 'undefined') return;
            window.sessionStorage.removeItem(storageKey);
            router.push('/entries');
          }}
        >
          Cancel
        </Button>
        <Button type="button" onClick={submit} disabled={disableSubmit}>
          {loading ? 'Saving…' : mode === 'create' ? 'Create entry' : 'Save changes'}
        </Button>
      </div>
    </div>
  );
}