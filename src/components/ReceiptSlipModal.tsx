import React from 'react';
import { X, Printer, Check, Receipt } from 'lucide-react';
import { OrderItem, PaymentMethod } from '../types';

interface ReceiptSlipModalProps {
  isOpen: boolean;
  onClose: () => void;
  receiptNumber: string;
  items: OrderItem[];
  totalAmount: number;
  paymentMethod: PaymentMethod;
  customerName?: string | null;
  receivedAmount?: number;
  changeAmount?: number;
}

export const ReceiptSlipModal: React.FC<ReceiptSlipModalProps> = ({
  isOpen,
  onClose,
  receiptNumber,
  items,
  totalAmount,
  paymentMethod,
  customerName,
  receivedAmount,
  changeAmount,
}) => {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const getMethodLabel = (method: PaymentMethod) => {
    switch (method) {
      case 'cash':
        return 'НАЛИЧНЫЕ';
      case 'card':
        return 'БЕЗНАЛИЧНЫЙ (КАРТА/ПЕРЕВОД)';
      case 'debt':
        return 'В ДОЛГ (КЛИЕНТСКИЙ ДОЛГ)';
      default:
        return method;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-sm rounded-xl bg-white shadow-2xl overflow-hidden border border-slate-200">
        {/* Top Status */}
        <div className="bg-emerald-600 text-white px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Check className="w-5 h-5 bg-white text-emerald-600 rounded-full p-0.5" />
            <span className="font-semibold text-sm">Чек успешно проведен!</span>
          </div>
          <button onClick={onClose} className="text-emerald-200 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Paper Thermal Receipt Slip */}
        <div className="p-5 font-mono text-xs bg-slate-50 text-slate-800 border-b border-dashed border-slate-300">
          <div className="text-center space-y-1 pb-3 border-b border-dashed border-slate-300">
            <div className="font-bold text-sm tracking-wider">МОЙСКЛАД КАССА</div>
            <div className="text-[11px] text-slate-500">Магазин «Розничный»</div>
            <div className="text-[10px] text-slate-400">
              {new Date().toLocaleString('ru-RU')}
            </div>
            <div className="font-bold text-slate-900 pt-1">{receiptNumber}</div>
          </div>

          {customerName && (
            <div className="py-2 border-b border-dashed border-slate-300 text-slate-700">
              <span className="text-[11px] text-slate-500">Покупатель:</span>{' '}
              <span className="font-bold">{customerName}</span>
            </div>
          )}

          {/* Items */}
          <div className="py-2.5 space-y-2 border-b border-dashed border-slate-300">
            {items.map((it, idx) => (
              <div key={idx} className="flex justify-between items-start">
                <div className="pr-2">
                  <div className="font-semibold leading-tight">{it.name}</div>
                  <div className="text-[10px] text-slate-500">
                    {it.quantity} x {it.price.toLocaleString('ru-RU')} ₽
                  </div>
                </div>
                <div className="font-bold shrink-0">
                  {it.sum.toLocaleString('ru-RU')} ₽
                </div>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="py-3 space-y-1.5 border-b border-dashed border-slate-300">
            <div className="flex justify-between items-baseline text-base font-bold text-slate-900">
              <span>ИТОГО К ОПЛАТЕ:</span>
              <span className="text-lg">{totalAmount.toLocaleString('ru-RU')} ₽</span>
            </div>

            <div className="flex justify-between text-[11px] text-slate-600">
              <span>ТИП ОПЛАТЫ:</span>
              <span className="font-bold">{getMethodLabel(paymentMethod)}</span>
            </div>

            {paymentMethod === 'cash' && receivedAmount !== undefined && (
              <>
                <div className="flex justify-between text-[11px] text-slate-600">
                  <span>ПОЛУЧЕНО:</span>
                  <span>{receivedAmount.toLocaleString('ru-RU')} ₽</span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-900 font-bold">
                  <span>СДАЧА:</span>
                  <span>{(changeAmount || 0).toLocaleString('ru-RU')} ₽</span>
                </div>
              </>
            )}

            {paymentMethod === 'debt' && (
              <div className="mt-1 p-1.5 bg-amber-100/70 border border-amber-300 text-[10px] text-amber-900 rounded">
                Сумма записана в задолженность клиента.
              </div>
            )}
          </div>

          <div className="pt-3 text-center text-[10px] text-slate-400">
            <div>СПАСИБО ЗА ПОКУПКУ!</div>
            <div className="font-sans text-[9px] mt-1 text-slate-400">
              Электронный фискальный документ
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-4 bg-white flex gap-2">
          <button
            onClick={handlePrint}
            className="flex-1 py-2 px-3 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition flex items-center justify-center gap-1.5 border border-slate-300"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600" />
            <span>Печать</span>
          </button>
          <button
            onClick={onClose}
            className="flex-2 py-2 px-4 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition shadow-xs flex items-center justify-center gap-1.5"
            autoFocus
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>Новый чек (Enter)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
