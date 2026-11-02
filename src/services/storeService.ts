import {
  collection,
  doc,
  getDoc,
  runTransaction,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  increment,
  serverTimestamp,
  query,
  where,
  getDocs,
  limit,
} from 'firebase/firestore';
import Papa from 'papaparse';
import { db, handleFirestoreError, OperationType } from '../firebase/config';
import {
  StoreProduct,
  StoreCustomer,
  StoreOrder,
  FinanceTransaction,
  OrderItem,
  PaymentMethod,
  StoreShift,
  StoreCashFlow,
  StoreInventoryDoc,
  InventoryDocItem,
  StoreSupplier,
  StorePurchaseOrder,
  AppUser,
} from '../types';

export const PRODUCTS_COLLECTION = 'store_products';
export const CUSTOMERS_COLLECTION = 'store_customers';
export const ORDERS_COLLECTION = 'store_orders';
export const SHIFTS_COLLECTION = 'store_shifts';
export const CASH_FLOWS_COLLECTION = 'store_cash_flows';
export const TRANSACTIONS_COLLECTION = 'transactions';
export const INVENTORY_DOCS_COLLECTION = 'store_inventory_docs';
export const SUPPLIERS_COLLECTION = 'store_suppliers';
export const PURCHASE_ORDERS_COLLECTION = 'store_purchase_orders';
export const USERS_COLLECTION = 'users';
export const METADATA_COLLECTION = 'metadata';

/**
 * Sanitizes data for Firestore operations:
 * Recursively removes keys with `undefined` values (which Firestore throws errors on)
 * while safely preserving FieldValues (serverTimestamp, increment) and Timestamps.
 */
export function sanitizeFirestoreData<T extends Record<string, any>>(data: T): Record<string, any> {
  if (data === null || typeof data !== 'object') {
    return data;
  }
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) {
      continue;
    }
    if (Array.isArray(value)) {
      result[key] = value
        .filter((item) => item !== undefined)
        .map((item) =>
          item !== null &&
          typeof item === 'object' &&
          typeof (item as any).toMillis !== 'function' &&
          (item as any)._methodName === undefined &&
          item.constructor?.name === 'Object'
            ? sanitizeFirestoreData(item)
            : item
        );
    } else if (
      value !== null &&
      typeof value === 'object' &&
      typeof (value as any).toMillis !== 'function' &&
      (value as any)._methodName === undefined &&
      typeof (value as any).isEqual !== 'function' &&
      value.constructor?.name === 'Object'
    ) {
      result[key] = sanitizeFirestoreData(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Realtime subscription to products catalog
 */
export function subscribeProducts(
  onUpdate: (products: StoreProduct[]) => void,
  onError?: (err: Error) => void
) {
  const colRef = collection(db, PRODUCTS_COLLECTION);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const list: StoreProduct[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const retailVal = Number(data.price ?? data.retailPrice) || 0;
        const rawIsArchived = data.isArchived !== undefined ? !!data.isArchived : (data.isActive === false);
        const isActive = data.isActive !== undefined ? !!data.isActive : !rawIsArchived;

        list.push({
          id: docSnap.id,
          name: data.name || '',
          price: retailVal,
          retailPrice: data.retailPrice !== undefined ? Number(data.retailPrice) : retailVal,
          purchasePrice: data.purchasePrice !== undefined ? Number(data.purchasePrice) : undefined,
          stockQuantity: Number(data.stockQuantity) || 0,
          barcode: data.barcode || (Array.isArray(data.barcodes) && data.barcodes[0]) || '',
          category: data.category || 'Общее',
          unit: data.unit || 'шт',
          isHot: !!data.isHot,
          hotColor: data.hotColor || '',
          isActive,
          isArchived: !isActive,
          mergedIntoProductId: data.mergedIntoProductId || undefined,
          barcodes: Array.isArray(data.barcodes) ? data.barcodes : [],
          minStock: data.minStock !== undefined ? Number(data.minStock) : 0,
          primarySupplierId: data.primarySupplierId || undefined,
          primarySupplierName: data.primarySupplierName || undefined,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        });
      });
      // Sort in-memory to prevent complex composite index dependencies in offline mode
      list.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
      onUpdate(list);
    },
    (error) => {
      onError?.(error);
      handleFirestoreError(error, OperationType.GET, PRODUCTS_COLLECTION);
    }
  );
}

/**
 * Realtime subscription to customers database
 */
export function subscribeCustomers(
  onUpdate: (customers: StoreCustomer[]) => void,
  onError?: (err: Error) => void
) {
  const colRef = collection(db, CUSTOMERS_COLLECTION);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const list: StoreCustomer[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          name: data.name || '',
          phone: data.phone || '',
          totalDebt: Number(data.totalDebt) || 0,
          note: data.note || '',
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        });
      });
      list.sort((a, b) => b.totalDebt - a.totalDebt || a.name.localeCompare(b.name, 'ru'));
      onUpdate(list);
    },
    (error) => {
      onError?.(error);
      handleFirestoreError(error, OperationType.GET, CUSTOMERS_COLLECTION);
    }
  );
}

/**
 * Realtime subscription to receipts / orders
 */
export function subscribeOrders(
  onUpdate: (orders: StoreOrder[]) => void,
  onError?: (err: Error) => void
) {
  const colRef = collection(db, ORDERS_COLLECTION);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const list: StoreOrder[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          receiptNumber: data.receiptNumber || `№${docSnap.id.slice(0, 6)}`,
          orderNumber: data.orderNumber !== undefined ? Number(data.orderNumber) : undefined,
          totalAmount: Number(data.totalAmount) || 0,
          paymentMethod: data.paymentMethod as PaymentMethod,
          date: data.date,
          createdAt: data.createdAt,
          items: data.items || [],
          customerId: data.customerId || null,
          customerName: data.customerName || null,
          receivedAmount: data.receivedAmount,
          changeAmount: data.changeAmount,
          shiftId: data.shiftId || null,
          status: data.status || 'completed',
          cancelledAt: data.cancelledAt,
          cancelledBy: data.cancelledBy,
        });
      });
      // Sort orders from NEWEST to OLDEST (ORDER BY timestamp DESC, visual numbers descending)
      list.sort((a, b) => {
        const timeA = a.date?.toDate
          ? a.date.toDate().getTime()
          : typeof a.date === 'string'
          ? new Date(a.date).getTime()
          : typeof a.date?.seconds === 'number'
          ? a.date.seconds * 1000
          : a.createdAt?.toDate
          ? a.createdAt.toDate().getTime()
          : 0;
        const timeB = b.date?.toDate
          ? b.date.toDate().getTime()
          : typeof b.date === 'string'
          ? new Date(b.date).getTime()
          : typeof b.date?.seconds === 'number'
          ? b.date.seconds * 1000
          : b.createdAt?.toDate
          ? b.createdAt.toDate().getTime()
          : 0;
        if (timeB !== timeA) return timeB - timeA;
        const numA = a.orderNumber ?? (parseInt((a.receiptNumber || '').replace(/\D+/g, ''), 10) || 0);
        const numB = b.orderNumber ?? (parseInt((b.receiptNumber || '').replace(/\D+/g, ''), 10) || 0);
        return numB - numA;
      });
      onUpdate(list);
    },
    (error) => {
      onError?.(error);
      handleFirestoreError(error, OperationType.GET, ORDERS_COLLECTION);
    }
  );
}

/**
 * Realtime subscription to register shifts
 */
export function subscribeShifts(
  onUpdate: (shifts: StoreShift[]) => void,
  onError?: (err: Error) => void
) {
  const colRef = collection(db, SHIFTS_COLLECTION);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const list: StoreShift[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          startCash: Number(data.startCash) || 0,
          endExpectedCash: data.endExpectedCash !== undefined ? Number(data.endExpectedCash) : undefined,
          endActualCash: data.endActualCash !== undefined ? Number(data.endActualCash) : undefined,
          totalCash: Number(data.totalCash) || 0,
          totalCard: Number(data.totalCard) || 0,
          totalDebt: Number(data.totalDebt) || 0,
          totalCashIn: Number(data.totalCashIn) || 0,
          totalCashOut: Number(data.totalCashOut) || 0,
          status: data.status || 'open',
          openTime: data.openTime,
          closeTime: data.closeTime,
          cashierId: data.cashierId,
          cashierName: data.cashierName,
        });
      });
      list.sort((a, b) => {
        const dateA = a.openTime?.toDate ? a.openTime.toDate().getTime() : 0;
        const dateB = b.openTime?.toDate ? b.openTime.toDate().getTime() : 0;
        return dateB - dateA;
      });
      onUpdate(list);
    },
    (error) => {
      onError?.(error);
      handleFirestoreError(error, OperationType.GET, SHIFTS_COLLECTION);
    }
  );
}

/**
 * Realtime subscription to cash flow movements (изъятия / внесения)
 */
export function subscribeCashFlows(
  shiftId: string,
  onUpdate: (flows: StoreCashFlow[]) => void,
  onError?: (err: Error) => void
) {
  const colRef = collection(db, CASH_FLOWS_COLLECTION);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const list: StoreCashFlow[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (!shiftId || data.shiftId === shiftId) {
          list.push({
            id: docSnap.id,
            shiftId: data.shiftId,
            type: data.type as 'in' | 'out',
            amount: Number(data.amount) || 0,
            category: data.category || '',
            note: data.note || '',
            date: data.date,
          });
        }
      });
      list.sort((a, b) => {
        const dateA = a.date?.toDate ? a.date.toDate().getTime() : 0;
        const dateB = b.date?.toDate ? b.date.toDate().getTime() : 0;
        return dateB - dateA;
      });
      onUpdate(list);
    },
    (error) => {
      onError?.(error);
      handleFirestoreError(error, OperationType.GET, CASH_FLOWS_COLLECTION);
    }
  );
}

/**
 * Realtime subscription to financial cashflow transactions
 */
export function subscribeTransactions(
  onUpdate: (txs: FinanceTransaction[]) => void,
  onError?: (err: Error) => void
) {
  const colRef = collection(db, TRANSACTIONS_COLLECTION);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const list: FinanceTransaction[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          accountId: data.accountId || 'Магазин',
          type: data.type || 'income',
          amount: Number(data.amount) || 0,
          category: data.category || 'Продажи',
          date: data.date,
          description: data.description || '',
          orderId: data.orderId,
          customerId: data.customerId,
        });
      });
      list.sort((a, b) => {
        const dateA = a.date?.toDate ? a.date.toDate().getTime() : 0;
        const dateB = b.date?.toDate ? b.date.toDate().getTime() : 0;
        return dateB - dateA;
      });
      onUpdate(list);
    },
    (error) => {
      onError?.(error);
      handleFirestoreError(error, OperationType.GET, TRANSACTIONS_COLLECTION);
    }
  );
}

/**
 * Shift Management Operations
 */

/**
 * Open new shift
 */
export async function openShift(startCash: number, cashierName: string = 'Кассир'): Promise<string> {
  const docRef = doc(collection(db, SHIFTS_COLLECTION));
  try {
    await setDoc(docRef, {
      startCash: Number(startCash) || 0,
      totalCash: 0,
      totalCard: 0,
      totalDebt: 0,
      totalCashIn: 0,
      totalCashOut: 0,
      status: 'open',
      openTime: serverTimestamp(),
      cashierName,
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, SHIFTS_COLLECTION);
  }
}

/**
 * Close shift with Z-Report reconciliation
 */
export async function closeShift(params: {
  shiftId: string;
  expectedCash: number;
  actualCash: number;
}): Promise<void> {
  const { shiftId, expectedCash, actualCash } = params;
  const docRef = doc(db, SHIFTS_COLLECTION, shiftId);
  try {
    await updateDoc(docRef, {
      status: 'closed',
      closeTime: serverTimestamp(),
      endExpectedCash: expectedCash,
      endActualCash: actualCash,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${SHIFTS_COLLECTION}/${shiftId}`);
  }
}

/**
 * Cash in / cash out operation (Изъятие / Внесение наличных)
 */
export async function addCashFlow(params: {
  shiftId: string;
  type: 'in' | 'out';
  amount: number;
  category: string;
  note?: string;
  supplierId?: string;
  supplierName?: string;
}): Promise<void> {
  const { shiftId, type, amount, category, note, supplierId, supplierName } = params;
  const batch = writeBatch(db);

  // 1. Flow record
  const flowRef = doc(collection(db, CASH_FLOWS_COLLECTION));
  const flowPayload: Record<string, any> = {
    shiftId,
    type,
    amount,
    category,
    date: serverTimestamp(),
  };
  if (note) flowPayload.note = note.trim();
  if (supplierId) flowPayload.supplierId = supplierId;
  if (supplierName) flowPayload.supplierName = supplierName;
  batch.set(flowRef, flowPayload);

  // 2. Update shift totals
  const shiftRef = doc(db, SHIFTS_COLLECTION, shiftId);
  if (type === 'in') {
    batch.update(shiftRef, {
      totalCashIn: increment(amount),
    });
  } else {
    batch.update(shiftRef, {
      totalCashOut: increment(amount),
    });

    // 3. CRITICAL: Cash withdrawal records as expense in shared transactions
    const txRef = doc(collection(db, TRANSACTIONS_COLLECTION));
    let desc = note ? `Изъятие из кассы: ${note}` : `Изъятие из кассы: ${category}`;
    if (supplierName) {
      desc = `Оплата поставщику ${supplierName}${note ? ` (${note})` : ''}`;
    }

    const txPayload: Record<string, any> = {
      accountId: 'Магазин (Касса)',
      type: 'expense',
      amount,
      category,
      source: 'cash_drawer',
      date: serverTimestamp(),
      description: desc,
    };
    if (supplierId) txPayload.supplierId = supplierId;
    batch.set(txRef, txPayload);

    // 4. Atomically offset supplier debt if supplier is specified
    if (supplierId) {
      const supplierRef = doc(db, SUPPLIERS_COLLECTION, supplierId);
      batch.update(supplierRef, {
        currentDebt: increment(-amount),
        updatedAt: serverTimestamp(),
      });
    }
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'cash_flow_batch');
  }
}

/**
 * Process POS Checkout Receipt
 */
export async function processCheckout(params: {
  items: OrderItem[];
  totalAmount: number;
  paymentMethod: PaymentMethod;
  customerId?: string | null;
  customerName?: string | null;
  receivedAmount?: number;
  changeAmount?: number;
  shiftId?: string | null;
}): Promise<string> {
  const {
    items,
    totalAmount,
    paymentMethod,
    customerId,
    customerName,
    receivedAmount,
    changeAmount,
    shiftId,
  } = params;

  if (items.length === 0) {
    throw new Error('Корзина пуста');
  }

  if (paymentMethod === 'debt' && !customerId) {
    throw new Error('Для оформления в долг необходимо выбрать клиента');
  }

  const countersRef = doc(db, METADATA_COLLECTION, 'counters');
  const orderRef = doc(collection(db, ORDERS_COLLECTION));
  const orderId = orderRef.id;

  try {
    const finalReceiptNumber = await runTransaction(db, async (transaction) => {
      // 1. Read counters document to get strict sequential number
      const counterSnap = await transaction.get(countersRef);
      let currentCount = 0;
      if (counterSnap.exists() && counterSnap.data().orderCount !== undefined) {
        currentCount = Number(counterSnap.data().orderCount) || 0;
      }
      const nextCount = currentCount + 1;
      const receiptNumber = `№${nextCount}`;

      // Increment counter atomically
      transaction.set(countersRef, { orderCount: nextCount }, { merge: true });

      // 2. Order record
      const orderData: Record<string, any> = {
        receiptNumber,
        orderNumber: nextCount,
        totalAmount,
        paymentMethod,
        date: serverTimestamp(),
        createdAt: serverTimestamp(),
        items,
      };
      if (customerId) orderData.customerId = customerId;
      if (customerName) orderData.customerName = customerName;
      if (typeof receivedAmount === 'number') orderData.receivedAmount = receivedAmount;
      if (typeof changeAmount === 'number') orderData.changeAmount = changeAmount;
      if (shiftId) orderData.shiftId = shiftId;

      transaction.set(orderRef, orderData);

      // 3. Decrement stock for products using increment(-quantity)
      for (const item of items) {
        if (item.productId) {
          const prodRef = doc(db, PRODUCTS_COLLECTION, item.productId);
          transaction.update(prodRef, {
            stockQuantity: increment(-item.quantity),
            updatedAt: serverTimestamp(),
          });
        }
      }

      // 4. Shift statistics update (reactive counters)
      if (shiftId) {
        const shiftRef = doc(db, SHIFTS_COLLECTION, shiftId);
        if (paymentMethod === 'cash') {
          transaction.update(shiftRef, { totalCash: increment(totalAmount) });
        } else if (paymentMethod === 'card') {
          transaction.update(shiftRef, { totalCard: increment(totalAmount) });
        } else if (paymentMethod === 'debt') {
          transaction.update(shiftRef, { totalDebt: increment(totalAmount) });
        }
      }

      // 5. Handle customer debt vs financial income
      if (paymentMethod === 'debt' && customerId) {
        const custRef = doc(db, CUSTOMERS_COLLECTION, customerId);
        transaction.update(custRef, {
          totalDebt: increment(totalAmount),
          updatedAt: serverTimestamp(),
        });
      } else {
        const txRef = doc(collection(db, TRANSACTIONS_COLLECTION));
        const txData: Record<string, any> = {
          accountId: 'Магазин (Касса)',
          type: 'income',
          amount: totalAmount,
          category: paymentMethod === 'cash' ? 'Продажи Наличные' : 'Продажи Карта/Перевод',
          source: paymentMethod === 'cash' ? 'cash_drawer' : 'bank_account',
          date: serverTimestamp(),
          description: `Чек ${receiptNumber}${customerName ? ` (${customerName})` : ''}`,
          orderId: orderId,
        };
        if (customerId) txData.customerId = customerId;

        transaction.set(txRef, txData);
      }

      return receiptNumber;
    });

    return finalReceiptNumber;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'store_checkout_transaction');
    throw error;
  }
}

/**
 * Mass import products using batch writes (chunked into batches of 500 items)
 */
export async function importProductsBatch(
  productsToImport: {
    name: string;
    price: number;
    retailPrice?: number;
    purchasePrice?: number;
    stockQuantity: number;
    barcode?: string;
    barcodes?: string[];
    category?: string;
    isArchived?: boolean;
    unit?: string;
  }[]
): Promise<number> {
  if (productsToImport.length === 0) return 0;

  const CHUNK_SIZE = 500;
  let totalImported = 0;

  for (let i = 0; i < productsToImport.length; i += CHUNK_SIZE) {
    const chunk = productsToImport.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);

    for (const item of chunk) {
      const docRef = doc(collection(db, PRODUCTS_COLLECTION));
      const retailPriceVal = Number(item.retailPrice ?? item.price) || 0;
      const payload: Record<string, any> = {
        name: item.name.trim(),
        price: retailPriceVal,
        retailPrice: retailPriceVal,
        stockQuantity: Number(item.stockQuantity) || 0,
        isArchived: !!item.isArchived,
        unit: item.unit || 'шт',
      };
      if (item.barcode) payload.barcode = item.barcode.trim();
      if (Array.isArray(item.barcodes)) payload.barcodes = item.barcodes;
      if (item.category) payload.category = item.category.trim();
      if (typeof item.purchasePrice === 'number') payload.purchasePrice = item.purchasePrice;

      batch.set(docRef, payload);
    }

    try {
      await batch.commit();
      totalImported += chunk.length;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, PRODUCTS_COLLECTION);
    }
  }

  return totalImported;
}

/**
 * Mass import products from CSV file (supports MoySklad exports with ';' delimiter and standard formats)
 */
export async function importProductsFromCsv(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      encoding: 'utf-8',
      complete: async (results) => {
        try {
          const rows = results.data as Record<string, any>[];
          if (!rows || rows.length === 0) {
            resolve(0);
            return;
          }

          const parsedProducts: {
            name: string;
            price: number;
            retailPrice: number;
            purchasePrice?: number;
            stockQuantity: number;
            barcode?: string;
            barcodes?: string[];
            category?: string;
            isArchived?: boolean;
            unit?: string;
          }[] = [];

          for (const row of rows) {
            const findCol = (...keywords: string[]): string => {
              const keys = Object.keys(row);
              for (const kw of keywords) {
                const found = keys.find((k) => k.toLowerCase().trim() === kw.toLowerCase().trim());
                if (found && row[found] !== undefined && row[found] !== null) {
                  return String(row[found]).trim();
                }
              }
              for (const kw of keywords) {
                const found = keys.find((k) => k.toLowerCase().includes(kw.toLowerCase()));
                if (found && row[found] !== undefined && row[found] !== null) {
                  return String(row[found]).trim();
                }
              }
              return '';
            };

            // 1. "Наименование" -> name (skip if empty)
            const name = findCol('наименование', 'название', 'товар', 'name', 'title');
            if (!name) continue;

            const cleanNumber = (val: string): number => {
              if (!val) return 0;
              const cleaned = val.replace(/,/g, '.').replace(/[^\d.-]/g, '');
              const num = parseFloat(cleaned);
              return isNaN(num) ? 0 : num;
            };

            // 2. "Единица измерения" -> unit (default 'шт')
            const unit = findCol('единица измерения', 'единица', 'ед', 'unit') || 'шт';

            // 3. "Цена: Цена продажи" -> retailPrice & price
            const rawPrice = findCol('цена: цена продажи', 'цена продажи', 'цена', 'стоимость', 'price', 'sale price');
            const retailPrice = cleanNumber(rawPrice);

            // 4. "Закупочная цена" -> purchasePrice
            const rawPurchasePrice = findCol('закупочная цена', 'закупка', 'себестоимость', 'purchase price', 'cost');
            const purchasePrice = cleanNumber(rawPurchasePrice);

            // 5. "Архивный" -> isArchived ('да' -> true, else false)
            const rawArchive = findCol('архивный', 'архив', 'archived', 'isarchived');
            const isArchived = rawArchive.toLowerCase() === 'да';

            // 6. Barcodes: "Штрихкод EAN13", "Штрихкод EAN8", "Штрихкод Code128", "Штрихкод UPC", "Штрихкод GTIN"
            const bcEan13 = findCol('штрихкод ean13', 'штрихкод', 'barcode');
            const bcEan8 = findCol('штрихкод ean8', 'штрихкод 2', 'barcode 2');
            const bcCode128 = findCol('штрихкод code128', 'штрихкод 3', 'barcode 3');
            const bcUpc = findCol('штрихкод upc', 'штрихкод 4', 'barcode 4');
            const bcGtin = findCol('штрихкод gtin', 'штрихкод 5', 'barcode 5');

            const allBarcodeString = [bcEan13, bcEan8, bcCode128, bcUpc, bcGtin]
              .filter(Boolean)
              .join(' ');

            const uniqueBarcodes = Array.from(
              new Set(
                allBarcodeString
                  .replace(/[,;]/g, ' ')
                  .split(/\s+/)
                  .map((b) => b.trim())
                  .filter(Boolean)
              )
            );

            const primaryBarcode = uniqueBarcodes[0] || '';

            const rawStock = findCol('остаток', 'количество', 'кол-во', 'stock', 'quantity', 'qty');
            const stockQuantity = rawStock ? cleanNumber(rawStock) : 0;

            const category = findCol('группы', 'категория', 'группа', 'раздел', 'category') || 'Общее';

            parsedProducts.push({
              name,
              price: retailPrice,
              retailPrice,
              purchasePrice,
              barcode: primaryBarcode,
              barcodes: uniqueBarcodes,
              stockQuantity,
              category,
              isArchived,
              unit,
            });
          }

          if (parsedProducts.length === 0) {
            resolve(0);
            return;
          }

          const count = await importProductsBatch(parsedProducts);
          resolve(count);
        } catch (err) {
          reject(err);
        }
      },
      error: (error) => {
        reject(error);
      },
    });
  });
}

/**
 * Repay Customer Debt (Возврат долга)
 */
export async function repayCustomerDebt(params: {
  customerId: string;
  customerName: string;
  amount: number;
  paymentMethod: 'cash' | 'card';
  note?: string;
  shiftId?: string | null;
}): Promise<void> {
  const { customerId, customerName, amount, paymentMethod, note, shiftId } = params;

  if (amount <= 0) {
    throw new Error('Сумма возврата долга должна быть больше 0');
  }

  const batch = writeBatch(db);

  // 1. Decrease customer's totalDebt
  const custRef = doc(db, CUSTOMERS_COLLECTION, customerId);
  batch.update(custRef, {
    totalDebt: increment(-amount),
  });

  // 2. If shift is active, add to cash or card sales in shift
  if (shiftId) {
    const shiftRef = doc(db, SHIFTS_COLLECTION, shiftId);
    if (paymentMethod === 'cash') {
      batch.update(shiftRef, { totalCash: increment(amount) });
    } else {
      batch.update(shiftRef, { totalCard: increment(amount) });
    }
  }

  // 3. NOW create income transaction in shared transactions collection
  const txRef = doc(collection(db, TRANSACTIONS_COLLECTION));
  batch.set(txRef, {
    accountId: 'Магазин',
    type: 'income',
    amount: amount,
    category: paymentMethod === 'cash' ? 'Продажи Наличные' : 'Продажи Карта/Перевод',
    date: serverTimestamp(),
    description: `Возврат долга: ${customerName}${note ? ` (${note})` : ''}`,
    customerId: customerId,
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'repay_debt_batch');
  }
}

/**
 * Customer CRUD
 */
export async function createCustomer(data: {
  name: string;
  phone?: string;
  totalDebt?: number;
  note?: string;
}): Promise<string> {
  const docRef = doc(collection(db, CUSTOMERS_COLLECTION));
  try {
    await setDoc(docRef, {
      name: data.name.trim(),
      phone: (data.phone || '').trim(),
      totalDebt: Number(data.totalDebt) || 0,
      note: (data.note || '').trim(),
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, CUSTOMERS_COLLECTION);
  }
}

export async function updateCustomer(
  id: string,
  data: Partial<Omit<StoreCustomer, 'id'>>
): Promise<void> {
  const docRef = doc(db, CUSTOMERS_COLLECTION, id);
  try {
    const cleanPayload = sanitizeFirestoreData({
      ...data,
      updatedAt: serverTimestamp(),
    });
    await updateDoc(docRef, cleanPayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${CUSTOMERS_COLLECTION}/${id}`);
  }
}

export async function deleteCustomer(id: string): Promise<void> {
  const docRef = doc(db, CUSTOMERS_COLLECTION, id);
  try {
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${CUSTOMERS_COLLECTION}/${id}`);
  }
}

/**
 * Checks if a barcode is unique in store_products.
 * Inspects both 'barcode' field and 'barcodes' array.
 */
export async function checkBarcodeUnique(
  barcode: string,
  excludeProductId?: string
): Promise<{ isUnique: boolean; existingProduct?: { id: string; name: string } }> {
  const clean = barcode.trim();
  if (!clean) return { isUnique: true };

  try {
    const colRef = collection(db, PRODUCTS_COLLECTION);
    
    // 1. Check primary barcode field
    const qPrimary = query(colRef, where('barcode', '==', clean));
    const snap1 = await getDocs(qPrimary);
    for (const docSnap of snap1.docs) {
      if (docSnap.id !== excludeProductId) {
        const d = docSnap.data();
        return {
          isUnique: false,
          existingProduct: { id: docSnap.id, name: d.name || 'Товар' },
        };
      }
    }

    // 2. Check barcodes array
    const qArray = query(colRef, where('barcodes', 'array-contains', clean));
    const snap2 = await getDocs(qArray);
    for (const docSnap of snap2.docs) {
      if (docSnap.id !== excludeProductId) {
        const d = docSnap.data();
        return {
          isUnique: false,
          existingProduct: { id: docSnap.id, name: d.name || 'Товар' },
        };
      }
    }

    return { isUnique: true };
  } catch (err) {
    console.warn('Failed to query barcode uniqueness in Firestore:', err);
    return { isUnique: true };
  }
}

/**
 * Product CRUD
 */
export async function createProduct(data: {
  name: string;
  price: number;
  purchasePrice?: number;
  stockQuantity: number;
  barcode?: string;
  barcodes?: string[];
  category?: string;
  unit?: string;
  isHot?: boolean;
  hotColor?: string;
  isActive?: boolean;
  isArchived?: boolean;
  minStock?: number;
  primarySupplierId?: string;
  primarySupplierName?: string;
}): Promise<string> {
  const cleanBarcode = (data.barcode || '').trim();

  // Enforce barcode uniqueness check before saving
  if (cleanBarcode) {
    const check = await checkBarcodeUnique(cleanBarcode);
    if (!check.isUnique) {
      throw new Error(`Штрихкод "${cleanBarcode}" уже принадлежит товару «${check.existingProduct?.name}»`);
    }
  }

  const docRef = doc(collection(db, PRODUCTS_COLLECTION));
  try {
    const rawActive = data.isActive !== undefined ? !!data.isActive : !data.isArchived;

    const payload: Record<string, any> = {
      name: data.name.trim(),
      price: Number(data.price) || 0,
      stockQuantity: Number(data.stockQuantity) || 0,
      barcode: cleanBarcode,
      category: (data.category || 'Общее').trim(),
      unit: (data.unit || 'шт').trim(),
      isHot: !!data.isHot,
      hotColor: data.hotColor || '',
      isActive: rawActive,
      isArchived: !rawActive,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (Array.isArray(data.barcodes)) payload.barcodes = data.barcodes;
    if (typeof data.purchasePrice === 'number') payload.purchasePrice = data.purchasePrice;
    if (typeof data.minStock === 'number') payload.minStock = data.minStock;
    if (data.primarySupplierId) payload.primarySupplierId = data.primarySupplierId;
    if (data.primarySupplierName) payload.primarySupplierName = data.primarySupplierName;

    const cleanPayload = sanitizeFirestoreData(payload);
    await setDoc(docRef, cleanPayload);
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, PRODUCTS_COLLECTION);
  }
}

export async function updateProduct(
  id: string,
  data: Partial<Omit<StoreProduct, 'id'>>
): Promise<void> {
  const barcodeValue = data.barcode !== undefined ? (data.barcode || '').trim() : undefined;

  // If barcode is being updated to a non-empty value, verify uniqueness
  if (barcodeValue) {
    const check = await checkBarcodeUnique(barcodeValue, id);
    if (!check.isUnique) {
      throw new Error(`Штрихкод "${barcodeValue}" уже принадлежит товару «${check.existingProduct?.name}»`);
    }
  }

  const docRef = doc(db, PRODUCTS_COLLECTION, id);
  try {
    const updatePayload: Record<string, any> = {
      ...data,
      updatedAt: serverTimestamp(),
    };

    // Explicitly guarantee barcode is clean string, never undefined
    if (data.barcode !== undefined) {
      updatePayload.barcode = barcodeValue || '';
    }

    // Synchronize isActive and isArchived
    if (data.isActive !== undefined) {
      updatePayload.isActive = !!data.isActive;
      updatePayload.isArchived = !data.isActive;
    } else if (data.isArchived !== undefined) {
      updatePayload.isArchived = !!data.isArchived;
      updatePayload.isActive = !data.isArchived;
    }

    const cleanPayload = sanitizeFirestoreData(updatePayload);
    await updateDoc(docRef, cleanPayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${PRODUCTS_COLLECTION}/${id}`);
  }
}

/**
 * Soft-delete: Move product to archive
 */
export async function archiveProduct(id: string): Promise<void> {
  const docRef = doc(db, PRODUCTS_COLLECTION, id);
  try {
    await updateDoc(docRef, {
      isActive: false,
      isArchived: true,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${PRODUCTS_COLLECTION}/${id}`);
  }
}

/**
 * Restore product from archive back to active catalog
 */
export async function restoreProduct(id: string): Promise<void> {
  const docRef = doc(db, PRODUCTS_COLLECTION, id);
  try {
    await updateDoc(docRef, {
      isActive: true,
      isArchived: false,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${PRODUCTS_COLLECTION}/${id}`);
  }
}

/**
 * Merge duplicate products:
 * Combines stock of target (Product A) and source (Product B),
 * combines unique barcodes, and soft-deletes (archives) or deletes Product B.
 */
export async function mergeProducts(params: {
  targetProductId: string;
  sourceProductId: string;
  combinedStock?: number;
  targetBarcode?: string;
  additionalBarcodes?: string[];
  sourceAction?: 'archive' | 'delete';
  note?: string;
}): Promise<{ success: boolean; newStock: number }> {
  const {
    targetProductId,
    sourceProductId,
    sourceAction = 'archive',
  } = params;

  if (targetProductId === sourceProductId) {
    throw new Error('Нельзя объединить товар с самим собой');
  }

  const targetRef = doc(db, PRODUCTS_COLLECTION, targetProductId);
  const sourceRef = doc(db, PRODUCTS_COLLECTION, sourceProductId);

  try {
    return await runTransaction(db, async (tx) => {
      const targetSnap = await tx.get(targetRef);
      const sourceSnap = await tx.get(sourceRef);

      if (!targetSnap.exists()) throw new Error('Основной товар не найден в базе данных');
      if (!sourceSnap.exists()) throw new Error('Поглощаемый дубликат не найден в базе данных');

      const targetData = targetSnap.data();
      const sourceData = sourceSnap.data();

      const targetStock = Number(targetData.stockQuantity) || 0;
      const sourceStock = Number(sourceData.stockQuantity) || 0;
      const newStock = params.combinedStock !== undefined ? params.combinedStock : (targetStock + sourceStock);

      // Collect all unique barcodes from both products
      const barcodeSet = new Set<string>();
      if (targetData.barcode) barcodeSet.add(targetData.barcode.trim());
      if (Array.isArray(targetData.barcodes)) {
        targetData.barcodes.forEach((b: string) => b && barcodeSet.add(b.trim()));
      }
      if (sourceData.barcode) barcodeSet.add(sourceData.barcode.trim());
      if (Array.isArray(sourceData.barcodes)) {
        sourceData.barcodes.forEach((b: string) => b && barcodeSet.add(b.trim()));
      }
      if (params.additionalBarcodes) {
        params.additionalBarcodes.forEach((b) => b && barcodeSet.add(b.trim()));
      }

      const primaryBarcode = (params.targetBarcode || targetData.barcode || sourceData.barcode || '').trim();
      const finalBarcodes = Array.from(barcodeSet).filter(Boolean);

      // Update target (Product A)
      tx.update(targetRef, {
        stockQuantity: newStock,
        barcode: primaryBarcode,
        barcodes: finalBarcodes,
        isActive: true,
        isArchived: false,
        updatedAt: serverTimestamp(),
      });

      // Handle duplicate (Product B)
      if (sourceAction === 'delete') {
        tx.delete(sourceRef);
      } else {
        tx.update(sourceRef, {
          isActive: false,
          isArchived: true,
          stockQuantity: 0,
          mergedIntoProductId: targetProductId,
          updatedAt: serverTimestamp(),
        });
      }

      return { success: true, newStock };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${PRODUCTS_COLLECTION}/merge`);
    throw error;
  }
}

export async function deleteProduct(id: string): Promise<void> {
  const docRef = doc(db, PRODUCTS_COLLECTION, id);
  try {
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${PRODUCTS_COLLECTION}/${id}`);
  }
}

/**
 * Initial Demo Seed Data
 */
export async function seedDemoData(): Promise<void> {
  const demoProducts = [
    { name: 'Кофе зерновой Espresso Crema 1кг', price: 1450, purchasePrice: 900, stockQuantity: 24, barcode: '4607001001', category: 'Напитки', isHot: true, hotColor: '#3b82f6' },
    { name: 'Чай зелёный Tess Lime 20 пак', price: 185, purchasePrice: 110, stockQuantity: 4, barcode: '4607001002', category: 'Напитки', isHot: true, hotColor: '#10b981' },
    { name: 'Вода минеральная Боржоми 0.5л', price: 120, purchasePrice: 75, stockQuantity: 60, barcode: '4607001003', category: 'Напитки', isHot: true, hotColor: '#06b6d4' },
    { name: 'Шоколад Ritter Sport Марципан 100г', price: 175, purchasePrice: 105, stockQuantity: 3, barcode: '4607001004', category: 'Снеки', isHot: true, hotColor: '#f59e0b' },
    { name: 'Печенье Oreo с какао 176г', price: 140, purchasePrice: 85, stockQuantity: 0, barcode: '4607001005', category: 'Снеки', isHot: false, hotColor: '#8b5cf6' },
    { name: 'Круассан 7 Days с ванилью 65г', price: 65, purchasePrice: 38, stockQuantity: 55, barcode: '4607001006', category: 'Снеки', isHot: true, hotColor: '#ec4899' },
    { name: 'Макароны Barilla Спагетти n.5 450г', price: 130, purchasePrice: 80, stockQuantity: 40, barcode: '4607001007', category: 'Бакалея', isHot: false },
    { name: 'Масло подсолнечное Олейна 1л', price: 145, purchasePrice: 95, stockQuantity: 2, barcode: '4607001008', category: 'Бакалея', isHot: false },
    { name: 'Сахар рафинад Русский сахар 1кг', price: 85, purchasePrice: 55, stockQuantity: 50, barcode: '4607001009', category: 'Бакалея', isHot: false },
    { name: 'Салфетки влажные антибактериальные 60шт', price: 95, purchasePrice: 50, stockQuantity: 70, barcode: '4607001010', category: 'Хозтовары', isHot: false },
    { name: 'Батарейки Duracell AA 4 шт', price: 390, purchasePrice: 240, stockQuantity: 0, barcode: '4607001011', category: 'Хозтовары', isHot: false },
    { name: 'Жевательная резинка Orbit Мята', price: 45, purchasePrice: 25, stockQuantity: 120, barcode: '4607001012', category: 'Снеки', isHot: true, hotColor: '#14b8a6' },
  ];

  const demoCustomers = [
    { name: 'Алексей Смирнов (Сосед)', phone: '+7 (916) 123-45-67', totalDebt: 1240, note: 'Постоянный клиент, живет в 4 доме' },
    { name: 'Елена Васильева (Кафе)', phone: '+7 (926) 987-65-43', totalDebt: 3500, note: 'Берет кофе и сахар под расчет в конце недели' },
    { name: 'Дмитрий Ковалев', phone: '+7 (903) 555-11-22', totalDebt: 450, note: 'Остаток за прошлый чек' },
    { name: 'Марина Соколова', phone: '+7 (985) 333-88-99', totalDebt: 0, note: 'Всегда платит картой' },
  ];

  const batch = writeBatch(db);

  for (const prod of demoProducts) {
    const pRef = doc(collection(db, PRODUCTS_COLLECTION));
    batch.set(pRef, prod);
  }

  for (const cust of demoCustomers) {
    const cRef = doc(collection(db, CUSTOMERS_COLLECTION));
    batch.set(cRef, cust);
  }

  // Also seed initial shift if none exists
  const shiftRef = doc(collection(db, SHIFTS_COLLECTION));
  batch.set(shiftRef, {
    startCash: 5000,
    totalCash: 0,
    totalCard: 0,
    totalDebt: 0,
    totalCashIn: 0,
    totalCashOut: 0,
    status: 'open',
    openTime: serverTimestamp(),
    cashierName: 'Кассир (Смена 1)',
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'seed_batch');
  }
}

/**
 * Realtime subscription to inventory movement documents (receipts, write-offs, audits)
 */
export function subscribeInventoryDocs(
  onUpdate: (docs: StoreInventoryDoc[]) => void,
  onError?: (err: Error) => void
) {
  const colRef = collection(db, INVENTORY_DOCS_COLLECTION);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const list: StoreInventoryDoc[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          docNumber: data.docNumber || docSnap.id.slice(0, 8),
          type: data.type || 'receipt',
          status: data.status || 'posted',
          date: data.date,
          authorId: data.authorId || '',
          authorName: data.authorName || 'Сотрудник',
          items: Array.isArray(data.items) ? data.items : [],
          totalAmount: Number(data.totalAmount) || 0,
          comment: data.comment || '',
          reason: data.reason || '',
          createdAt: data.createdAt,
          postedAt: data.postedAt,
        });
      });
      // Sort newest first
      list.sort((a, b) => {
        const timeA = a.date?.toDate?.()?.getTime() || (typeof a.date === 'string' ? new Date(a.date).getTime() : 0);
        const timeB = b.date?.toDate?.()?.getTime() || (typeof b.date === 'string' ? new Date(b.date).getTime() : 0);
        return timeB - timeA;
      });
      onUpdate(list);
    },
    (error) => {
      onError?.(error);
      handleFirestoreError(error, OperationType.GET, INVENTORY_DOCS_COLLECTION);
    }
  );
}

/**
 * Peek next sequential document number based on metadata/counters
 */
export async function peekNextDocNumber(
  type: 'receipt' | 'write_off' | 'inventory'
): Promise<string> {
  const prefix = type === 'receipt' ? 'ПР-' : type === 'write_off' ? 'СП-' : 'ИНВ-';
  const field =
    type === 'receipt'
      ? 'receiptCount'
      : type === 'write_off'
      ? 'writeOffCount'
      : 'inventoryCount';
  try {
    const snap = await getDoc(doc(db, METADATA_COLLECTION, 'counters'));
    const count = snap.exists() ? Number(snap.data()[field]) || 0 : 0;
    const next = count + 1;
    return `${prefix}${String(next).padStart(5, '0')}`;
  } catch (err) {
    console.error('Failed to peek next doc number:', err);
    return `${prefix}00001`;
  }
}

/**
 * Create and post an inventory document atomically with sequential counter & stock adjustments
 */
export async function createAndPostInventoryDoc(
  docData: Omit<StoreInventoryDoc, 'id' | 'createdAt' | 'postedAt' | 'docNumber'> & {
    docNumber?: string;
  }
): Promise<string> {
  const prefix = docData.type === 'receipt' ? 'ПР-' : docData.type === 'write_off' ? 'СП-' : 'ИНВ-';
  const counterField =
    docData.type === 'receipt'
      ? 'receiptCount'
      : docData.type === 'write_off'
      ? 'writeOffCount'
      : 'inventoryCount';

  let targetShiftId = docData.shiftId;
  if (docData.type === 'receipt' && docData.isPaidImmediately && !targetShiftId) {
    try {
      const openShiftQuery = query(collection(db, SHIFTS_COLLECTION), where('status', '==', 'open'), limit(1));
      const openShiftSnap = await getDocs(openShiftQuery);
      if (!openShiftSnap.empty) {
        targetShiftId = openShiftSnap.docs[0].id;
      }
    } catch (e) {
      console.warn('Could not query open shift for immediate cash payment:', e);
    }
  }

  const countersRef = doc(db, METADATA_COLLECTION, 'counters');
  const docRef = doc(collection(db, INVENTORY_DOCS_COLLECTION));

  try {
    const generatedDocNumber = await runTransaction(db, async (transaction) => {
      // 1. Read metadata counters document
      const counterSnap = await transaction.get(countersRef);
      const currentCount = counterSnap.exists()
        ? Number(counterSnap.data()[counterField]) || 0
        : 0;
      const nextCount = currentCount + 1;
      const nextDocNumber = `${prefix}${String(nextCount).padStart(5, '0')}`;

      // 2. Increment counter atomically
      transaction.set(countersRef, { [counterField]: nextCount }, { merge: true });

      // 3. Update each product stock ATOMICALLY using increment (No read-then-write)
      for (const item of docData.items) {
        const prodRef = doc(db, PRODUCTS_COLLECTION, item.productId);

        if (docData.type === 'receipt') {
          // Приемка: атомарное увеличение остатка на складе
          const updates: Record<string, any> = {
            stockQuantity: increment(item.qty),
            updatedAt: serverTimestamp(),
          };
          if (item.price > 0) {
            updates.purchasePrice = item.price;
          }
          transaction.update(prodRef, updates);
        } else if (docData.type === 'write_off') {
          // Списание: атомарное уменьшение остатка на складе
          transaction.update(prodRef, {
            stockQuantity: increment(-item.qty),
            updatedAt: serverTimestamp(),
          });
        } else if (docData.type === 'inventory') {
          // Инвентаризация: фиксация фактического остатка
          const actual = item.actualQty !== undefined ? item.actualQty : item.qty;
          transaction.update(prodRef, {
            stockQuantity: actual,
            updatedAt: serverTimestamp(),
          });
        }
      }

      // 4. Supplier settlements and cash drawer handling:
      if (docData.type === 'receipt') {
        if (docData.isPaidImmediately) {
          // Оплачено из кассы: долг поставщика НЕ увеличивается.
          // Создаем расходную операцию в кассовой смене (Изъятие: Оплата поставщику)
          if (targetShiftId) {
            const shiftRef = doc(db, SHIFTS_COLLECTION, targetShiftId);
            transaction.update(shiftRef, {
              totalCashOut: increment(docData.totalAmount),
            });
          }

          // Фиксируем движение денег в кассе
          const flowRef = doc(collection(db, CASH_FLOWS_COLLECTION));
          transaction.set(flowRef, {
            type: 'out',
            amount: docData.totalAmount,
            category: 'Оплата поставщику',
            source: 'cash_drawer',
            note: `Оплата по накладной ${nextDocNumber}${docData.supplier ? ` (${docData.supplier})` : ''}`,
            supplierId: docData.supplierId || null,
            supplierName: docData.supplier || null,
            shiftId: targetShiftId || null,
            date: serverTimestamp(),
          });

          // Фиксируем в общих финансовых транзакциях
          const transRef = doc(collection(db, TRANSACTIONS_COLLECTION));
          transaction.set(transRef, {
            accountId: 'Касса магазина (Наличные)',
            type: 'expense',
            amount: docData.totalAmount,
            category: 'Оплата поставщику',
            source: 'cash_drawer',
            description: `Оплата по накладной ${nextDocNumber}${docData.supplier ? ` (${docData.supplier})` : ''}`,
            supplierId: docData.supplierId || null,
            shiftId: targetShiftId || null,
            date: serverTimestamp(),
          });
        } else if (docData.supplierId) {
          // В долг: сумма приемки увеличивает долг перед поставщиком
          const supplierRef = doc(db, SUPPLIERS_COLLECTION, docData.supplierId);
          transaction.update(supplierRef, {
            currentDebt: increment(docData.totalAmount),
            updatedAt: serverTimestamp(),
          });
        }
      }

      // 5. Write the inventory movement document
      transaction.set(docRef, {
        ...docData,
        supplierId: docData.supplierId || null,
        shiftId: targetShiftId || null,
        isPaidImmediately: !!docData.isPaidImmediately,
        docNumber: nextDocNumber,
        status: 'posted',
        createdAt: serverTimestamp(),
        postedAt: serverTimestamp(),
      });

      return nextDocNumber;
    });

    return generatedDocNumber;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, INVENTORY_DOCS_COLLECTION);
    throw error;
  }
}

/**
 * Record a store expense (from Cash Drawer or from Bank Account)
 */
export async function addStoreExpense(data: {
  amount: number;
  category: string;
  source: 'cash_drawer' | 'bank_account';
  note?: string;
  shiftId?: string | null;
}): Promise<void> {
  const batch = writeBatch(db);

  // 1. Cash flow record
  const flowRef = doc(collection(db, CASH_FLOWS_COLLECTION));
  batch.set(flowRef, {
    type: 'out',
    amount: data.amount,
    category: data.category,
    source: data.source,
    note: data.note || '',
    shiftId: data.shiftId || null,
    date: serverTimestamp(),
  });

  // 2. If paid from cash drawer and shift is open, update shift cash
  if (data.source === 'cash_drawer' && data.shiftId) {
    const shiftRef = doc(db, SHIFTS_COLLECTION, data.shiftId);
    batch.update(shiftRef, {
      totalCashOut: increment(data.amount),
    });
  }

  // 3. Financial transaction record
  const transRef = doc(collection(db, TRANSACTIONS_COLLECTION));
  batch.set(transRef, {
    accountId: data.source === 'cash_drawer' ? 'Касса магазина (Наличные)' : 'Банковский расчетный счет',
    type: 'expense',
    amount: data.amount,
    category: data.category,
    source: data.source,
    description: data.note ? `${data.category}: ${data.note}` : data.category,
    date: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'store_expense');
  }
}

/**
 * Realtime subscription to staff users
 */
export function subscribeUsers(
  onUpdate: (users: AppUser[]) => void,
  onError?: (err: Error) => void
) {
  const colRef = collection(db, USERS_COLLECTION);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const list: AppUser[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          uid: docSnap.id,
          email: data.email || '',
          displayName: data.displayName || data.email?.split('@')[0] || 'Сотрудник',
          role: data.role === 'admin' ? 'admin' : 'cashier',
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        });
      });
      list.sort((a, b) => (a.role === 'admin' ? -1 : 1) || a.email.localeCompare(b.email));
      onUpdate(list);
    },
    (error) => {
      onError?.(error);
      handleFirestoreError(error, OperationType.GET, USERS_COLLECTION);
    }
  );
}

/**
 * Update user role (admin only)
 */
export async function updateUserRole(uid: string, role: 'admin' | 'cashier'): Promise<void> {
  const userRef = doc(db, USERS_COLLECTION, uid);
  try {
    await updateDoc(userRef, {
      role,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${USERS_COLLECTION}/${uid}`);
  }
}

/**
 * Delete staff record
 */
export async function deleteStaffUser(uid: string): Promise<void> {
  const userRef = doc(db, USERS_COLLECTION, uid);
  try {
    await deleteDoc(userRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${USERS_COLLECTION}/${uid}`);
  }
}

/**
 * Realtime subscription to suppliers
 */
export function subscribeSuppliers(
  onUpdate: (suppliers: StoreSupplier[]) => void,
  onError?: (err: Error) => void
) {
  const colRef = collection(db, SUPPLIERS_COLLECTION);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const list: StoreSupplier[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          name: data.name || '',
          phone: data.phone || '',
          email: data.email || '',
          inn: data.inn || '',
          comment: data.comment || '',
          currentDebt: Number(data.currentDebt) || 0,
          address: data.address || '',
          bankDetails: data.bankDetails || '',
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        });
      });
      list.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
      onUpdate(list);
    },
    (error) => {
      onError?.(error);
      handleFirestoreError(error, OperationType.GET, SUPPLIERS_COLLECTION);
    }
  );
}

/**
 * Add a new supplier
 */
export async function createSupplier(
  supplierData: Partial<Omit<StoreSupplier, 'id' | 'createdAt' | 'updatedAt'>> & { name: string }
): Promise<string> {
  const docRef = doc(collection(db, SUPPLIERS_COLLECTION));
  try {
    await setDoc(docRef, {
      ...supplierData,
      currentDebt: Number(supplierData.currentDebt) || 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, SUPPLIERS_COLLECTION);
    throw error;
  }
}

/**
 * Update an existing inventory document and adjust stock ATOMICALLY using deltas (increment)
 */
export async function updateInventoryDocWithStockDelta(
  docId: string,
  oldDoc: StoreInventoryDoc,
  newDocData: {
    items: StoreInventoryDoc['items'];
    supplier?: string;
    comment?: string;
    reason?: string;
    date?: any;
  }
): Promise<void> {
  const batch = writeBatch(db);
  const docRef = doc(db, INVENTORY_DOCS_COLLECTION, docId);

  // Recalculate totalAmount
  const totalAmount = newDocData.items.reduce(
    (sum, item) => sum + (item.total || (item.qty * item.price) || 0),
    0
  );

  // If the document was already posted, apply atomic increments based on item deltas
  if (oldDoc.status === 'posted') {
    const oldItemsMap = new Map<string, StoreInventoryDoc['items'][0]>();
    for (const item of oldDoc.items) {
      oldItemsMap.set(item.productId, item);
    }

    const newItemsMap = new Map<string, StoreInventoryDoc['items'][0]>();
    for (const item of newDocData.items) {
      newItemsMap.set(item.productId, item);
    }

    const allProductIds = new Set<string>([
      ...Array.from(oldItemsMap.keys()),
      ...Array.from(newItemsMap.keys()),
    ]);

    for (const productId of allProductIds) {
      const oldItem = oldItemsMap.get(productId);
      const newItem = newItemsMap.get(productId);
      const prodRef = doc(db, PRODUCTS_COLLECTION, productId);

      if (oldDoc.type === 'receipt') {
        const oldQty = oldItem ? Number(oldItem.qty) || 0 : 0;
        const newQty = newItem ? Number(newItem.qty) || 0 : 0;
        const delta = newQty - oldQty;

        if (delta !== 0) {
          const updates: Record<string, any> = {
            stockQuantity: increment(delta),
            updatedAt: serverTimestamp(),
          };
          if (newItem && newItem.price > 0) {
            updates.purchasePrice = newItem.price;
          }
          batch.update(prodRef, updates);
        } else if (newItem && newItem.price > 0) {
          batch.update(prodRef, {
            purchasePrice: newItem.price,
            updatedAt: serverTimestamp(),
          });
        }
      } else if (oldDoc.type === 'write_off') {
        // More qty written off = less stock. Change in stock is -(newQty - oldQty)
        const oldQty = oldItem ? Number(oldItem.qty) || 0 : 0;
        const newQty = newItem ? Number(newItem.qty) || 0 : 0;
        const delta = newQty - oldQty;

        if (delta !== 0) {
          batch.update(prodRef, {
            stockQuantity: increment(-delta),
            updatedAt: serverTimestamp(),
          });
        }
      } else if (oldDoc.type === 'inventory') {
        const oldActual = oldItem ? (oldItem.actualQty !== undefined ? Number(oldItem.actualQty) : Number(oldItem.qty) || 0) : 0;
        const newActual = newItem ? (newItem.actualQty !== undefined ? Number(newItem.actualQty) : Number(newItem.qty) || 0) : 0;
        const delta = newActual - oldActual;

        if (delta !== 0) {
          batch.update(prodRef, {
            stockQuantity: increment(delta),
            updatedAt: serverTimestamp(),
          });
        }
      }
    }
  }

  // Update doc record
  batch.update(docRef, {
    items: newDocData.items,
    totalAmount,
    ...(newDocData.supplier !== undefined ? { supplier: newDocData.supplier } : {}),
    ...(newDocData.comment !== undefined ? { comment: newDocData.comment } : {}),
    ...(newDocData.reason !== undefined ? { reason: newDocData.reason } : {}),
    ...(newDocData.date ? { date: newDocData.date } : {}),
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${INVENTORY_DOCS_COLLECTION}/${docId}`);
    throw error;
  }
}

/**
 * Delete inventory document and roll back its stock effects atomically
 */
export async function deleteInventoryDoc(invDoc: StoreInventoryDoc): Promise<void> {
  const batch = writeBatch(db);
  const docRef = doc(db, INVENTORY_DOCS_COLLECTION, invDoc.id);

  if (invDoc.status === 'posted') {
    for (const item of invDoc.items) {
      const prodRef = doc(db, PRODUCTS_COLLECTION, item.productId);
      if (invDoc.type === 'receipt') {
        // Rollback receipt: reduce stock
        batch.update(prodRef, {
          stockQuantity: increment(-item.qty),
          updatedAt: serverTimestamp(),
        });
      } else if (invDoc.type === 'write_off') {
        // Rollback write-off: return stock
        batch.update(prodRef, {
          stockQuantity: increment(item.qty),
          updatedAt: serverTimestamp(),
        });
      } else if (invDoc.type === 'inventory') {
        const diff = item.diff !== undefined ? item.diff : ((item.actualQty ?? item.qty) - (item.bookQty ?? 0));
        batch.update(prodRef, {
          stockQuantity: increment(-diff),
          updatedAt: serverTimestamp(),
        });
      }
    }
  }

  batch.delete(docRef);

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${INVENTORY_DOCS_COLLECTION}/${invDoc.id}`);
    throw error;
  }
}

/**
 * Save inventory audit document (as Draft or Posted)
 */
export async function saveInventoryAuditDoc(data: {
  id?: string;
  docNumber?: string;
  status: 'draft' | 'posted';
  date: string;
  authorName: string;
  authorId: string;
  comment?: string;
  items: InventoryDocItem[];
  shortageCount: number;
  surplusCount: number;
  exactCount: number;
  shortageCostSum: number;
  shortageRetailSum: number;
  surplusCostSum: number;
  surplusRetailSum: number;
  netCostSum: number;
  netRetailSum: number;
  totalAmount: number;
}): Promise<{ id: string; docNumber: string }> {
  try {
    if (data.id) {
      // Update existing document
      const docRef = doc(db, INVENTORY_DOCS_COLLECTION, data.id);
      const payload: Record<string, any> = {
        status: data.status,
        date: data.date,
        authorName: data.authorName,
        authorId: data.authorId,
        comment: data.comment || '',
        items: data.items,
        shortageCount: data.shortageCount,
        surplusCount: data.surplusCount,
        exactCount: data.exactCount,
        shortageCostSum: data.shortageCostSum,
        shortageRetailSum: data.shortageRetailSum,
        surplusCostSum: data.surplusCostSum,
        surplusRetailSum: data.surplusRetailSum,
        netCostSum: data.netCostSum,
        netRetailSum: data.netRetailSum,
        totalAmount: data.totalAmount,
        updatedAt: serverTimestamp(),
      };
      if (data.status === 'posted') {
        payload.postedAt = serverTimestamp();
      }
      await updateDoc(docRef, payload);
      return { id: data.id, docNumber: data.docNumber || '' };
    } else {
      // Create new inventory audit document
      const docNumber = await peekNextDocNumber('inventory');
      const countersRef = doc(db, METADATA_COLLECTION, 'counters');
      const docRef = doc(collection(db, INVENTORY_DOCS_COLLECTION));

      await runTransaction(db, async (transaction) => {
        const counterSnap = await transaction.get(countersRef);
        const currentCount = counterSnap.exists()
          ? Number(counterSnap.data().inventoryCount) || 0
          : 0;
        const nextCount = currentCount + 1;
        const generatedDocNumber = `ИНВ-${String(nextCount).padStart(5, '0')}`;

        transaction.set(countersRef, { inventoryCount: nextCount }, { merge: true });

        const payload: Record<string, any> = {
          docNumber: generatedDocNumber,
          type: 'inventory',
          status: data.status,
          date: data.date,
          authorName: data.authorName,
          authorId: data.authorId,
          comment: data.comment || '',
          items: data.items,
          shortageCount: data.shortageCount,
          surplusCount: data.surplusCount,
          exactCount: data.exactCount,
          shortageCostSum: data.shortageCostSum,
          shortageRetailSum: data.shortageRetailSum,
          surplusCostSum: data.surplusCostSum,
          surplusRetailSum: data.surplusRetailSum,
          netCostSum: data.netCostSum,
          netRetailSum: data.netRetailSum,
          totalAmount: data.totalAmount,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        if (data.status === 'posted') {
          payload.postedAt = serverTimestamp();
        }

        transaction.set(docRef, payload);
      });

      return { id: docRef.id, docNumber };
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, INVENTORY_DOCS_COLLECTION);
    throw error;
  }
}

/**
 * Automate stock deduction: Creates and posts a Write-Off document for all shortages in an audit
 */
export async function createWriteOffFromAudit(params: {
  auditDoc: StoreInventoryDoc;
  authorName: string;
  authorId: string;
}): Promise<{ writeOffDocNumber: string; writeOffDocId?: string }> {
  const { auditDoc, authorName, authorId } = params;

  // Filter items with shortage (actualQty < bookQty, i.e. diff < 0)
  const shortageItems = auditDoc.items.filter(
    (it) => it.actualQty !== null && it.actualQty !== undefined && it.diff !== undefined && it.diff < 0
  );

  if (shortageItems.length === 0) {
    throw new Error('В данной инвентаризации нет позиций с недостачей.');
  }

  const writeOffItems = shortageItems.map((it) => {
    const qty = Math.abs(it.diff!);
    const price = it.price || 0;
    return {
      productId: it.productId,
      name: it.name,
      barcode: it.barcode,
      qty,
      price,
      total: qty * price,
    };
  });

  const totalAmount = writeOffItems.reduce((acc, it) => acc + it.total, 0);

  // 1. Create and post the write-off document
  const postedDocNumber = await createAndPostInventoryDoc({
    type: 'write_off',
    status: 'posted',
    date: new Date().toISOString(),
    authorName,
    authorId,
    reason: `Инвентаризация: недостача ${auditDoc.docNumber}`,
    comment: `Списание выявленной недостачи по инвентаризации ${auditDoc.docNumber}`,
    items: writeOffItems,
    totalAmount,
  });

  // 2. Link write-off document number back to the audit document
  const auditRef = doc(db, INVENTORY_DOCS_COLLECTION, auditDoc.id);
  await updateDoc(auditRef, {
    writeOffDocNumber: postedDocNumber,
    updatedAt: serverTimestamp(),
  });

  return { writeOffDocNumber: postedDocNumber };
}

/**
 * Automate stock increase: Creates and posts a Receipt document for all surpluses in an audit
 */
export async function createReceiptFromAudit(params: {
  auditDoc: StoreInventoryDoc;
  authorName: string;
  authorId: string;
}): Promise<{ receiptDocNumber: string; receiptDocId?: string }> {
  const { auditDoc, authorName, authorId } = params;

  // Filter items with surplus (actualQty > bookQty, i.e. diff > 0)
  const surplusItems = auditDoc.items.filter(
    (it) => it.actualQty !== null && it.actualQty !== undefined && it.diff !== undefined && it.diff > 0
  );

  if (surplusItems.length === 0) {
    throw new Error('В данной инвентаризации нет позиций с излишками.');
  }

  const receiptItems = surplusItems.map((it) => {
    const qty = it.diff!;
    const price = it.price || 0;
    return {
      productId: it.productId,
      name: it.name,
      barcode: it.barcode,
      qty,
      price,
      total: qty * price,
    };
  });

  const totalAmount = receiptItems.reduce((acc, it) => acc + it.total, 0);

  // 1. Create and post the receipt document
  const postedDocNumber = await createAndPostInventoryDoc({
    type: 'receipt',
    status: 'posted',
    date: new Date().toISOString(),
    authorName,
    authorId,
    supplier: 'Оприходование излишков',
    isPaidImmediately: true,
    comment: `Оприходование выявленных излишков по инвентаризации ${auditDoc.docNumber}`,
    items: receiptItems,
    totalAmount,
  });

  // 2. Link receipt document number back to the audit document
  const auditRef = doc(db, INVENTORY_DOCS_COLLECTION, auditDoc.id);
  await updateDoc(auditRef, {
    receiptDocNumber: postedDocNumber,
    updatedAt: serverTimestamp(),
  });

  return { receiptDocNumber: postedDocNumber };
}

/**
 * Update supplier profile
 */
export async function updateSupplier(
  supplierId: string,
  data: Partial<Omit<StoreSupplier, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<void> {
  const docRef = doc(db, SUPPLIERS_COLLECTION, supplierId);
  try {
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${SUPPLIERS_COLLECTION}/${supplierId}`);
    throw error;
  }
}

/**
 * Delete a supplier
 */
export async function deleteSupplier(supplierId: string): Promise<void> {
  const docRef = doc(db, SUPPLIERS_COLLECTION, supplierId);
  try {
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${SUPPLIERS_COLLECTION}/${supplierId}`);
    throw error;
  }
}

/**
 * Pay supplier debt and record financial expense transaction
 */
export async function paySupplierDebt(data: {
  supplierId: string;
  supplierName: string;
  amount: number;
  source: 'cash_drawer' | 'bank_account';
  note?: string;
  shiftId?: string | null;
}): Promise<void> {
  const batch = writeBatch(db);
  const supplierRef = doc(db, SUPPLIERS_COLLECTION, data.supplierId);

  // 1. Reduce supplier debt atomically
  batch.update(supplierRef, {
    currentDebt: increment(-data.amount),
    updatedAt: serverTimestamp(),
  });

  // 2. Add transaction record to general transactions collection
  const transRef = doc(collection(db, TRANSACTIONS_COLLECTION));
  batch.set(transRef, {
    accountId: data.source === 'cash_drawer' ? 'Касса магазина (Наличные)' : 'Банковский расчетный счет',
    type: 'expense',
    amount: data.amount,
    category: 'Оплата поставщикам',
    source: data.source,
    description: `Оплата поставщику ${data.supplierName}${data.note ? ` (${data.note})` : ''}`,
    supplierId: data.supplierId,
    date: serverTimestamp(),
  });

  // 3. If paid from cash drawer and shift is open, update shift
  if (data.source === 'cash_drawer' && data.shiftId) {
    const shiftRef = doc(db, SHIFTS_COLLECTION, data.shiftId);
    batch.update(shiftRef, {
      totalCashOut: increment(data.amount),
    });
  }

  // 4. Record cash flow if paid from cash drawer
  if (data.source === 'cash_drawer') {
    const flowRef = doc(collection(db, CASH_FLOWS_COLLECTION));
    batch.set(flowRef, {
      type: 'out',
      amount: data.amount,
      category: 'Оплата поставщику',
      source: 'cash_drawer',
      note: `Погашение долга: ${data.supplierName}`,
      shiftId: data.shiftId || null,
      date: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'pay_supplier_debt');
    throw error;
  }
}

/**
 * Realtime subscription to purchase orders (Заказы поставщикам)
 */
export function subscribePurchaseOrders(
  onUpdate: (orders: StorePurchaseOrder[]) => void,
  onError?: (err: Error) => void
) {
  const colRef = collection(db, PURCHASE_ORDERS_COLLECTION);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const list: StorePurchaseOrder[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          orderNumber: data.orderNumber || '',
          supplierId: data.supplierId || '',
          supplierName: data.supplierName || 'Поставщик',
          status: data.status || 'draft',
          date: data.date,
          items: data.items || [],
          totalAmount: Number(data.totalAmount) || 0,
          comment: data.comment || '',
          authorName: data.authorName || 'Администратор',
          authorId: data.authorId || '',
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        });
      });
      list.sort((a, b) => {
        const timeA = a.date?.toDate?.()?.getTime() || (typeof a.date === 'string' ? new Date(a.date).getTime() : 0);
        const timeB = b.date?.toDate?.()?.getTime() || (typeof b.date === 'string' ? new Date(b.date).getTime() : 0);
        return timeB - timeA;
      });
      onUpdate(list);
    },
    (error) => {
      onError?.(error);
      handleFirestoreError(error, OperationType.GET, PURCHASE_ORDERS_COLLECTION);
    }
  );
}

/**
 * Peek next purchase order sequential number (ЗК-00001)
 */
export async function peekNextPurchaseOrderNumber(): Promise<string> {
  try {
    const snap = await getDoc(doc(db, METADATA_COLLECTION, 'counters'));
    const count = snap.exists() ? Number(snap.data().purchaseOrderCount) || 0 : 0;
    const next = count + 1;
    return `ЗК-${String(next).padStart(5, '0')}`;
  } catch (err) {
    console.error('Failed to peek next purchase order number:', err);
    return 'ЗК-00001';
  }
}

/**
 * Create a new purchase order document with sequential counter
 */
export async function createPurchaseOrder(
  orderData: Omit<StorePurchaseOrder, 'id' | 'createdAt' | 'updatedAt' | 'orderNumber'> & {
    orderNumber?: string;
  }
): Promise<string> {
  const countersRef = doc(db, METADATA_COLLECTION, 'counters');
  const docRef = doc(collection(db, PURCHASE_ORDERS_COLLECTION));

  try {
    const generatedOrderNumber = await runTransaction(db, async (transaction) => {
      const counterSnap = await transaction.get(countersRef);
      const currentCount = counterSnap.exists()
        ? Number(counterSnap.data().purchaseOrderCount) || 0
        : 0;
      const nextCount = currentCount + 1;
      const nextOrderNumber = `ЗК-${String(nextCount).padStart(5, '0')}`;

      transaction.set(countersRef, { purchaseOrderCount: nextCount }, { merge: true });

      transaction.set(docRef, {
        ...orderData,
        orderNumber: nextOrderNumber,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      return nextOrderNumber;
    });

    return generatedOrderNumber;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, PURCHASE_ORDERS_COLLECTION);
    throw error;
  }
}

/**
 * Update purchase order status
 */
export async function updatePurchaseOrderStatus(
  orderId: string,
  status: StorePurchaseOrder['status']
): Promise<void> {
  const docRef = doc(db, PURCHASE_ORDERS_COLLECTION, orderId);
  try {
    await updateDoc(docRef, {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${PURCHASE_ORDERS_COLLECTION}/${orderId}`);
    throw error;
  }
}

/**
 * Cancel an entire order atomically:
 * 1. Mark order status as 'cancelled'
 * 2. Return sold quantities back to store_products using FieldValue.increment(quantity)
 * 3. Deduct from shift totals (totalCash, totalCard, or totalDebt)
 * 4. If order was on debt, reduce customer's totalDebt by order.totalAmount
 * 5. Record reversal transaction in transactions collection
 */
export async function cancelOrder(params: {
  order: StoreOrder;
  adminName: string;
}): Promise<void> {
  const { order, adminName } = params;
  if (order.status === 'cancelled') {
    throw new Error('Чек уже отменен');
  }

  const batch = writeBatch(db);

  // 1. Mark order as cancelled
  const orderRef = doc(db, ORDERS_COLLECTION, order.id);
  batch.update(orderRef, {
    status: 'cancelled',
    cancelledAt: serverTimestamp(),
    cancelledBy: adminName,
  });

  // 2. Return products back to store_products
  for (const item of order.items) {
    if (item.productId && item.quantity > 0) {
      const prodRef = doc(db, PRODUCTS_COLLECTION, item.productId);
      batch.update(prodRef, {
        stockQuantity: increment(item.quantity),
        updatedAt: serverTimestamp(),
      });
    }
  }

  // 3. Shift revenue adjustment
  if (order.shiftId) {
    const shiftRef = doc(db, SHIFTS_COLLECTION, order.shiftId);
    if (order.paymentMethod === 'cash') {
      batch.update(shiftRef, { totalCash: increment(-order.totalAmount) });
    } else if (order.paymentMethod === 'card') {
      batch.update(shiftRef, { totalCard: increment(-order.totalAmount) });
    } else if (order.paymentMethod === 'debt') {
      batch.update(shiftRef, { totalDebt: increment(-order.totalAmount) });
    }
  }

  // 4. Customer debt adjustment if debt sale
  if (order.paymentMethod === 'debt' && order.customerId) {
    const custRef = doc(db, CUSTOMERS_COLLECTION, order.customerId);
    batch.update(custRef, {
      totalDebt: increment(-order.totalAmount),
      updatedAt: serverTimestamp(),
    });
  } else {
    // 5. If it was real money, create an adjustment expense in transactions
    const txRef = doc(collection(db, TRANSACTIONS_COLLECTION));
    batch.set(txRef, {
      accountId: 'Магазин',
      type: 'expense',
      amount: order.totalAmount,
      category: 'Возврат / Отмена чека',
      source: order.paymentMethod === 'cash' ? 'cash_drawer' : 'bank_account',
      date: serverTimestamp(),
      description: `Отмена чека ${order.receiptNumber} (${adminName})`,
      orderId: order.id,
    });
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `cancel_order/${order.id}`);
    throw error;
  }
}

/**
 * Edit order items safely (e.g. remove a line item or change quantity):
 * Uses atomic batch writes to:
 * 1. Adjust product stock deltas (return returned quantities to stock)
 * 2. Calculate difference in totalAmount (diffAmount)
 * 3. Adjust shift totals by diffAmount
 * 4. Adjust customer totalDebt if debt sale
 * 5. Update order document with new items and new total
 */
export async function updateOrderItems(params: {
  order: StoreOrder;
  newItems: OrderItem[];
  adminName: string;
}): Promise<void> {
  const { order, newItems, adminName } = params;
  if (order.status === 'cancelled') {
    throw new Error('Нельзя редактировать отмененный чек');
  }

  const newTotal = newItems.reduce((acc, it) => acc + (it.sum || it.quantity * it.price), 0);
  const diffAmount = order.totalAmount - newTotal; // positive if total reduced

  const batch = writeBatch(db);

  // 1. Map old item quantities vs new item quantities
  const oldMap = new Map<string, number>();
  order.items.forEach((it) => {
    oldMap.set(it.productId, (oldMap.get(it.productId) || 0) + it.quantity);
  });

  const newMap = new Map<string, number>();
  newItems.forEach((it) => {
    newMap.set(it.productId, (newMap.get(it.productId) || 0) + it.quantity);
  });

  // Calculate stock returns/deductions
  const allProductIds = new Set([...oldMap.keys(), ...newMap.keys()]);
  allProductIds.forEach((productId) => {
    const oldQty = oldMap.get(productId) || 0;
    const newQty = newMap.get(productId) || 0;
    const diffQty = oldQty - newQty; // positive means products returned to stock

    if (diffQty !== 0) {
      const prodRef = doc(db, PRODUCTS_COLLECTION, productId);
      batch.update(prodRef, {
        stockQuantity: increment(diffQty),
        updatedAt: serverTimestamp(),
      });
    }
  });

  // 2. Adjust shift revenue by diffAmount
  if (order.shiftId && diffAmount !== 0) {
    const shiftRef = doc(db, SHIFTS_COLLECTION, order.shiftId);
    if (order.paymentMethod === 'cash') {
      batch.update(shiftRef, { totalCash: increment(-diffAmount) });
    } else if (order.paymentMethod === 'card') {
      batch.update(shiftRef, { totalCard: increment(-diffAmount) });
    } else if (order.paymentMethod === 'debt') {
      batch.update(shiftRef, { totalDebt: increment(-diffAmount) });
    }
  }

  // 3. Adjust customer debt if debt sale
  if (order.paymentMethod === 'debt' && order.customerId && diffAmount !== 0) {
    const custRef = doc(db, CUSTOMERS_COLLECTION, order.customerId);
    batch.update(custRef, {
      totalDebt: increment(-diffAmount),
      updatedAt: serverTimestamp(),
    });
  } else if (diffAmount > 0) {
    // If real money was returned, log expense
    const txRef = doc(collection(db, TRANSACTIONS_COLLECTION));
    batch.set(txRef, {
      accountId: 'Магазин',
      type: 'expense',
      amount: diffAmount,
      category: 'Возврат / Корректировка чека',
      source: order.paymentMethod === 'cash' ? 'cash_drawer' : 'bank_account',
      date: serverTimestamp(),
      description: `Корректировка чека ${order.receiptNumber} (${adminName})`,
      orderId: order.id,
    });
  }

  // 4. Update the order document
  const orderRef = doc(db, ORDERS_COLLECTION, order.id);
  batch.update(orderRef, {
    items: newItems,
    totalAmount: newTotal,
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `update_order/${order.id}`);
    throw error;
  }
}


export async function batchUpdateStockQuantity(items: { productId: string; stockQuantity: number }[]): Promise<void> {
  const BATCH_SIZE = 500;
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const chunk = items.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);
    for (const item of chunk) {
      const prodRef = doc(db, PRODUCTS_COLLECTION, item.productId);
      batch.update(prodRef, { stockQuantity: item.stockQuantity });
    }
    await batch.commit();
  }
}
