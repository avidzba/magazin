export type UserRole = 'admin' | 'cashier';

export interface AppUser {
  uid: string;
  email: string;
  displayName?: string;
  role: UserRole;
  createdAt?: any;
  updatedAt?: any;
}

export interface StoreProduct {
  id: string;
  name: string;
  price: number;
  retailPrice?: number;
  purchasePrice?: number;
  stockQuantity: number;
  barcode?: string;
  barcodes?: string[];
  category?: string;
  unit?: string; // 'шт' | 'кг' | 'л' | 'упак'
  isHot?: boolean;
  hotColor?: string;
  isActive?: boolean; // true = active, false = archived (soft delete)
  isArchived?: boolean; // legacy compatibility
  mergedIntoProductId?: string;
  minStock?: number;
  primarySupplierId?: string;
  primarySupplierName?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface StoreCustomer {
  id: string;
  name: string;
  phone?: string;
  totalDebt: number;
  note?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  barcode?: string;
  stockQuantity: number;
}

export type PaymentMethod = 'cash' | 'card' | 'debt';

export interface OrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  sum: number;
}

export interface StoreOrder {
  id: string;
  receiptNumber: string;
  orderNumber?: number;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  date: any;
  items: OrderItem[];
  customerId?: string | null;
  customerName?: string | null;
  receivedAmount?: number;
  changeAmount?: number;
  shiftId?: string | null;
  status?: 'completed' | 'cancelled';
  cancelledAt?: any;
  cancelledBy?: string;
  createdAt?: any;
}

export interface FinanceTransaction {
  id: string;
  accountId: string; // e.g. 'Магазин'
  type: 'income' | 'expense';
  amount: number;
  category: string;
  source?: string; // 'cash_drawer' | 'bank_account'
  date: any;
  description?: string;
  orderId?: string;
  customerId?: string;
  supplierId?: string;
}

export interface StoreShift {
  id: string;
  startCash: number;
  endExpectedCash?: number;
  endActualCash?: number;
  totalCash: number;
  totalCard: number;
  totalDebt: number;
  totalCashIn: number;
  totalCashOut: number;
  status: 'open' | 'closed';
  openTime: any;
  closeTime?: any;
  cashierId?: string;
  cashierName?: string;
}

export interface StoreCashFlow {
  id: string;
  shiftId?: string;
  type: 'in' | 'out'; // 'in' = Внесение, 'out' = Изъятие
  amount: number;
  category: string; // 'Оплата поставщику' | 'Зарплата' | 'Аренда' | 'Инкассация' | 'Хозрасходы' | 'Внесение'
  source?: 'cash_drawer' | 'bank_account';
  note?: string;
  supplierId?: string | null;
  supplierName?: string | null;
  date: any;
}

// Inventory Movement Types
export type InventoryDocType = 'receipt' | 'write_off' | 'inventory'; // Приемка | Списание | Инвентаризация
export type InventoryDocStatus = 'draft' | 'posted';

export interface InventoryDocItem {
  productId: string;
  name: string;
  barcode?: string;
  category?: string;
  qty: number; // for receipt and write_off
  price: number; // purchase price or estimated cost
  retailPrice?: number; // selling price
  total: number;
  bookQty?: number; // for inventory (расчетный/книжный остаток systemQuantity)
  actualQty?: number | null; // for inventory (фактический остаток)
  diff?: number; // actual - book
  diffCost?: number; // diff * purchasePrice
  diffRetail?: number; // diff * retailPrice
}

export interface StoreInventoryDoc {
  id: string;
  docNumber: string;
  type: InventoryDocType;
  status: InventoryDocStatus;
  date: any;
  authorId?: string;
  authorName?: string;
  items: InventoryDocItem[];
  totalAmount: number;
  supplier?: string;
  supplierId?: string;
  isPaidImmediately?: boolean;
  shiftId?: string | null;
  comment?: string;
  reason?: string; // e.g. 'Порча', 'Брак', 'Хознужды', 'Пересортица'
  // Extended fields for inventory audit:
  shortageCount?: number;
  surplusCount?: number;
  exactCount?: number;
  shortageCostSum?: number;
  shortageRetailSum?: number;
  surplusCostSum?: number;
  surplusRetailSum?: number;
  netCostSum?: number;
  netRetailSum?: number;
  writeOffDocNumber?: string;
  writeOffDocId?: string;
  receiptDocNumber?: string;
  receiptDocId?: string;
  createdAt?: any;
  postedAt?: any;
  updatedAt?: any;
}

export interface StoreSupplier {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  inn?: string;
  comment?: string;
  currentDebt: number; // текущая задолженность перед поставщиком
  address?: string;
  bankDetails?: string;
  createdAt?: any;
  updatedAt?: any;
}

export type PurchaseOrderStatus = 'draft' | 'confirmed' | 'delivered' | 'cancelled';

export interface PurchaseOrderItem {
  productId: string;
  name: string;
  barcode?: string;
  currentStock: number;
  minStock: number;
  orderQty: number;
  purchasePrice: number;
  total: number;
}

export interface StorePurchaseOrder {
  id: string;
  orderNumber: string; // e.g. ЗК-00001
  supplierId: string;
  supplierName: string;
  status: PurchaseOrderStatus;
  date: any;
  items: PurchaseOrderItem[];
  totalAmount: number;
  comment?: string;
  authorName?: string;
  authorId?: string;
  createdAt?: any;
  updatedAt?: any;
}
