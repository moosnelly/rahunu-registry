export type AttachmentValue = {
  name: string;
  dataUrl: string | null;
  size: number | null;
};

export type AttachmentRecord = Record<string, AttachmentValue>;

export const createEmptyAttachmentValue = (): AttachmentValue => ({
  name: '',
  dataUrl: null,
  size: null,
});

export const sanitizeAttachmentValue = (value: unknown): AttachmentValue => {
  const next = createEmptyAttachmentValue();
  if (value && typeof value === 'object') {
    const candidate = value as Record<string, unknown>;
    if (typeof candidate.name === 'string') next.name = candidate.name;
    if (typeof candidate.dataUrl === 'string') next.dataUrl = candidate.dataUrl;
    if (typeof candidate.size === 'number' && Number.isFinite(candidate.size) && candidate.size >= 0) {
      next.size = candidate.size;
    }
  }
  return next;
};

export const sanitizeAttachmentRecord = (value: unknown, keys?: readonly string[]): AttachmentRecord => {
  const result: AttachmentRecord = {};

  if (Array.isArray(keys)) {
    keys.forEach((key) => {
      result[key] = sanitizeAttachmentValue((value as any)?.[key]);
    });
    return result;
  }

  if (value && typeof value === 'object') {
    Object.entries(value as Record<string, unknown>).forEach(([key, raw]) => {
      result[key] = sanitizeAttachmentValue(raw);
    });
  }

  return result;
};

export const createEmptyAttachmentRecord = (keys: readonly string[]): AttachmentRecord => {
  return keys.reduce<AttachmentRecord>((acc, key) => {
    acc[key] = createEmptyAttachmentValue();
    return acc;
  }, {});
};

