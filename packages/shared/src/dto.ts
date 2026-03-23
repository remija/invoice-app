import type {
  InvoiceType,
  Direction,
  OperationCategory,
  InvoiceFormat,
  InvoiceStatus,
} from './types';

export interface Address {
  street: string;
  city: string;
  zip: string;
  country: string;
}

export interface OrganizationDto {
  id: string;
  name: string;
  siren: string;
  siret: string;
  vatNumber?: string;
  address: Address;
  legalForm: string;
  capital?: string;
  rcsCity?: string;
  subscriptionTier: string;
}

export interface ClientDto {
  id: string;
  name: string;
  email?: string;
  siren?: string;
  siret?: string;
  vatNumber?: string;
  billingAddress: Address;
  deliveryAddress?: Address;
}

export interface LineItemDto {
  id: string;
  description: string;
  quantity: number;
  unitPriceHt: number;
  vatRate: number;
  vatAmount: number;
  totalHt: number;
  sortOrder: number;
}

export interface InvoiceDto {
  id: string;
  number: string;
  type: InvoiceType;
  direction: Direction;
  issueDate: string;
  dueDate: string;
  paymentTerms?: string;
  operationCategory: OperationCategory;
  vatOnDebits: boolean;
  lineItems: LineItemDto[];
  totalHt: number;
  totalVat: number;
  totalTtc: number;
  status: InvoiceStatus;
  format?: InvoiceFormat;
  pdfUrl?: string;
  client: ClientDto;
}
