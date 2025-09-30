import { z } from "zod";
export const BorrowerSchema = z.object({ fullName: z.string().min(1), nationalId: z.string().min(1).regex(/^[A-Z0-9\-]+$/i) });
const AttachmentValueSchema = z.object({
  name: z.string().optional().nullable(),
  dataUrl: z.string().url().optional().nullable(),
  size: z.number().int().nonnegative().optional().nullable(),
});

export const EntrySchema = z.object({
  no: z.number().int().positive(),
  address: z.string().min(1),
  island: z.string().min(1),
  formNumber: z.string().min(1).regex(/^\d{1,5}\/\d{4}$/),
  date: z.string().refine(v=>!Number.isNaN(Date.parse(v))),
  branch: z.string().min(1),
  agreementNumber: z.string().min(1).max(50),
  status: z.enum(["ONGOING","CANCELLED","COMPLETED"]),
  loanAmount: z.number().positive(),
  dateOfCancelled: z.string().optional().nullable(),
  dateOfCompleted: z.string().optional().nullable(),
  borrowers: z.array(BorrowerSchema).min(1),
  attachments: z.record(AttachmentValueSchema).optional().default({})
}).superRefine((d, ctx)=>{
  if(d.status==='CANCELLED'){ 
    if(!d.dateOfCancelled) ctx.addIssue({ code:'custom', message:'dateOfCancelled required', path:['dateOfCancelled']}); 
    // Require cancellation bank document when status is CANCELLED
    const cancellationDoc = d.attachments?.cancellationBankDocument;
    if(!cancellationDoc || !cancellationDoc.dataUrl) {
      ctx.addIssue({ code:'custom', message:'Bank document is required when status is Cancelled', path:['attachments', 'cancellationBankDocument']});
    }
  }
  else if(d.dateOfCancelled){ ctx.addIssue({ code:'custom', message:'dateOfCancelled must be empty unless CANCELLED', path:['dateOfCancelled']}); }
  
  // Require completion date and bank document when status is COMPLETED
  if(d.status==='COMPLETED'){ 
    if(!d.dateOfCompleted) ctx.addIssue({ code:'custom', message:'dateOfCompleted required', path:['dateOfCompleted']}); 
    const completionDoc = d.attachments?.completionBankDocument;
    if(!completionDoc || !completionDoc.dataUrl) {
      ctx.addIssue({ code:'custom', message:'Bank letter of completion is required when status is Completed', path:['attachments', 'completionBankDocument']});
    }
  }
  else if(d.dateOfCompleted){ ctx.addIssue({ code:'custom', message:'dateOfCompleted must be empty unless COMPLETED', path:['dateOfCompleted']}); }
});
export const AdminUserCreateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional().transform((v) => v?.trim() || undefined),
  email: z.string().trim().min(1).email(),
  password: z.string().min(6),
  role: z.enum(["ADMIN","DATA_ENTRY","VIEWER"]).optional(),
  isActive: z.boolean().optional(),
});

export const AdminUserUpdateSchema = z
  .object({
    role: z.enum(["ADMIN","DATA_ENTRY","VIEWER"]).optional(),
    isActive: z.boolean().optional(),
    resetPassword: z.string().min(6).optional(),
  })
  .refine((d) => !!d.role || d.isActive !== undefined || !!d.resetPassword, { message: "No changes provided" });
