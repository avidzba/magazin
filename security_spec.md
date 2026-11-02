# Security Specification for POS & Debt Cash Register

## 1. Data Invariants
- `store_products`: Product records must have non-empty `name` (<= 200 chars), valid non-negative `price`, and `stockQuantity` (number).
- `store_customers`: Customer must have `name` (1..150 chars), valid `phone` if present, and `totalDebt` (number).
- `store_orders`: Receipts must specify valid `totalAmount` (number >= 0), valid `paymentMethod` ('cash' | 'card' | 'debt'), and `items` list.
- `transactions`: Financial entries must specify `accountId` (<= 64 chars), `type` ('income' | 'expense'), `amount` (number > 0), and valid `category`.

## 2. The "Dirty Dozen" Payloads (Must be blocked)
1. StoreProduct with empty name.
2. StoreProduct with negative price (-50).
3. StoreProduct with 10,000 char name (buffer overflow / wallet denial).
4. StoreCustomer with missing name.
5. StoreCustomer with non-number totalDebt ("one hundred").
6. StoreCustomer with malicious 50,000 char note.
7. StoreOrder with negative totalAmount.
8. StoreOrder with illegal paymentMethod ("bitcoin").
9. StoreOrder without items array.
10. Transaction with type "hack_money".
11. Transaction with negative amount.
12. Arbitrary write to unknown top-level collection.
