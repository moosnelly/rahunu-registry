export type Role = "ADMIN" | "DATA_ENTRY" | "VIEWER";
export const canRead = (r?:Role)=>!!r; export const canWrite=(r?:Role)=>r==='ADMIN'||r==='DATA_ENTRY'; export const canDelete=canWrite; export const isAdmin=(r?:Role)=>r==='ADMIN';
