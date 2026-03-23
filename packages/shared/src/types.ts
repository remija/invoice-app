export type InvoiceType = 'INVOICE' | 'CREDIT_NOTE';
export type Direction = 'OUTGOING' | 'INCOMING';
export type OperationCategory = 'GOODS' | 'SERVICES' | 'MIXED';
export type InvoiceFormat = 'FACTURX' | 'UBL' | 'CII';
export type InvoiceStatus =
  | 'DRAFT'
  | 'SENT'
  | 'DEPOSITED'
  | 'RECEIVED'
  | 'ACCEPTED'
  | 'REFUSED'
  | 'PAID';
