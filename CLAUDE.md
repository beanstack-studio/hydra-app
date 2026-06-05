# Hydra — Water Station Management SaaS
## Claude Instructions (read this before every task)

---

## What this app is
A multi-tenant SaaS PWA for water refilling and ice tube businesses in the Philippines.
- App name: **Hydra**
- Each business is a "station" — fully isolated data via Supabase RLS
- Your sister's business is Station #1. Other paying customers = Station #2, #3, etc.
- No App Store — installable as a PWA via browser
- Target devices: iPad landscape (primary), mobile phone portrait
- Owner/users are non-technical

---

## Tech stack
- React 18 + Vite + TypeScript (strict mode)
- Tailwind CSS — utility classes only, zero inline styles ever
- shadcn/ui — all UI primitives (Button, Input, Select, Dialog, etc.)
- Supabase — Postgres + Auth + RLS + Realtime
- Zustand — global state (auth, station context)
- React Hook Form + Zod — all forms
- Recharts — all charts
- React Router v6 — routing
- date-fns + date-fns-tz — all date/time logic
- Vite PWA plugin — PWA/offline support

---

## Absolute code rules — never break these

1. **Zero inline styles.** Tailwind classes only. No `style={{}}` ever.
2. **One component per file.** Never export two components from one file.
3. **No `any`.** Every prop, variable, return type must be explicitly typed.
4. **Named exports** everywhere except page-level route components (default export).
5. **No logic in JSX.** Compute everything above the return statement.
6. **Supabase only in hooks.** Never call Supabase directly inside a component.
7. **All forms: React Hook Form + Zod.** No uncontrolled inputs.
8. **Conditional classes: `cn()` only.** Never string-concatenate Tailwind classes.
9. **Mobile-first.** Base = phone portrait. `md:` = tablet. `lg:` = iPad landscape.
10. **Every hook returns `{ data, isLoading, error }`.** Always handle all three in UI.
11. **Always include `station_id`** in every insert and query. RLS enforces isolation
    at the DB level but the app must still pass `station_id` explicitly.

---

## Multi-tenancy — how it works

Every data table has a `station_id uuid` column.
Supabase RLS policies ensure users can only read/write their own station's data.
The `station_id` is embedded in the user's JWT via a Supabase custom claim.

```typescript
// src/stores/authStore.ts
interface AuthState {
  user: User | null
  stationId: string | null      // from JWT custom claim
  role: 'owner' | 'staff' | 'super_admin' | null
  station: Station | null       // station metadata (name, plan, etc.)
}
```

Always get `stationId` from the auth store — never hardcode it:
```typescript
const { stationId } = useAuthStore()

// Every query:
.eq('station_id', stationId)

// Every insert:
{ station_id: stationId, ...formData }
```

---

## Folder structure

```
hydra-app/
├── public/
│   └── icons/                 ← PWA icons
├── src/
│   ├── components/
│   │   ├── ui/                ← shadcn/ui (never edit)
│   │   ├── layout/
│   │   │   ├── AppShell.tsx   ← sidebar on lg:, bottom nav on mobile
│   │   │   ├── Sidebar.tsx    ← lg: navigation
│   │   │   ├── BottomNav.tsx  ← mobile navigation
│   │   │   └── PageHeader.tsx ← page title + current date (PST)
│   │   └── shared/
│   │       ├── StatCard.tsx
│   │       ├── DataTable.tsx  ← table + 25/page pagination
│   │       ├── SearchInput.tsx← 3-char trigger search
│   │       ├── Modal.tsx      ← backdrop=close, esc=close, 90dvh max
│   │       ├── PhoneInput.tsx ← auto-formats PH phone while typing
│   │       ├── EmptyState.tsx
│   │       └── LoadingSkeleton.tsx
│   ├── features/
│   │   ├── sales/
│   │   │   ├── components/
│   │   │   │   ├── SaleModal.tsx
│   │   │   │   ├── SaleTable.tsx
│   │   │   │   ├── UnpaidSalesList.tsx
│   │   │   │   └── RecordPaymentModal.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useSales.ts
│   │   │   │   └── useUnpaidSales.ts
│   │   │   └── types.ts
│   │   ├── expenses/
│   │   │   ├── components/
│   │   │   │   ├── ExpenseModal.tsx
│   │   │   │   └── ExpenseTable.tsx
│   │   │   ├── hooks/useExpenses.ts
│   │   │   └── types.ts
│   │   ├── customers/
│   │   │   ├── components/
│   │   │   │   ├── CustomerList.tsx
│   │   │   │   ├── CustomerModal.tsx
│   │   │   │   └── CustomerProfile.tsx
│   │   │   ├── hooks/useCustomers.ts
│   │   │   └── types.ts
│   │   ├── inventory/
│   │   │   ├── components/
│   │   │   │   ├── StockTable.tsx
│   │   │   │   └── StockAdjustModal.tsx
│   │   │   ├── hooks/useInventory.ts
│   │   │   └── types.ts
│   │   ├── maintenance/
│   │   │   ├── components/
│   │   │   │   ├── MaintenanceModal.tsx
│   │   │   │   └── MaintenanceTable.tsx
│   │   │   ├── hooks/useMaintenance.ts
│   │   │   └── types.ts
│   │   ├── bills/
│   │   │   ├── components/
│   │   │   │   ├── BillModal.tsx
│   │   │   │   └── BillTable.tsx
│   │   │   ├── hooks/useBills.ts
│   │   │   └── types.ts
│   │   ├── reports/
│   │   │   ├── components/
│   │   │   │   ├── SalesChart.tsx
│   │   │   │   └── ExpenseSummary.tsx
│   │   │   ├── hooks/useReports.ts
│   │   │   └── types.ts
│   │   └── settings/
│   │       ├── components/
│   │       │   ├── ProductSettings.tsx
│   │       │   ├── AddonSettings.tsx
│   │       │   ├── BillTypeSettings.tsx
│   │       │   └── BusinessSettings.tsx
│   │       ├── hooks/useSettings.ts
│   │       └── types.ts
│   ├── hooks/
│   │   └── useAuth.ts
│   ├── lib/
│   │   ├── supabase.ts        ← Supabase client (env vars only)
│   │   ├── utils.ts           ← cn(), all formatters, generateTimeSlots
│   │   └── reminders.ts       ← reminder polling + notification logic
│   ├── stores/
│   │   └── authStore.ts       ← Zustand: user, stationId, role, station
│   ├── types/
│   │   └── database.types.ts  ← Supabase generated types
│   ├── pages/
│   │   ├── LoginPage.tsx
│   │   ├── SalesPage.tsx
│   │   ├── ExpensesPage.tsx
│   │   ├── CustomersPage.tsx
│   │   ├── InventoryPage.tsx
│   │   ├── ReportsPage.tsx
│   │   └── SettingsPage.tsx
│   └── App.tsx
├── CLAUDE.md                  ← this file
├── .env.local                 ← Supabase keys (never commit)
├── .gitignore
├── index.html
├── vite.config.ts
├── tailwind.config.ts
└── package.json
```

---

## Timezone — Philippine Standard Time (PST, UTC+8)

All display dates and times must be in PST. Non-negotiable.

```typescript
// npm install date-fns-tz
import { formatInTimeZone, toZonedTime } from 'date-fns-tz'

export const PH_TZ = 'Asia/Manila'
export const nowPH = () => toZonedTime(new Date(), PH_TZ)
```

- Never use `new Date()` directly for display
- Always: `toZonedTime(new Date(), PH_TZ)` before formatting
- Store in DB as UTC — Supabase handles this automatically

---

## Formatting — all helpers in src/lib/utils.ts

### Currency — ₱1,650.00
```typescript
export const formatCurrency = (amount: number): string =>
  `₱${amount.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`
```

### Date — 01-Jun-2026
```typescript
export const formatDate = (date: Date | string): string =>
  formatInTimeZone(new Date(date), PH_TZ, 'dd-MMM-yyyy')
```

### Time — 4:30 PM
```typescript
export const formatTime = (date: Date | string): string =>
  formatInTimeZone(new Date(date), PH_TZ, 'h:mm a')
```

### Time dropdown — 15-min intervals: 12:00 AM … 11:45 PM
```typescript
export const generateTimeSlots = (): string[] => {
  const slots: string[] = []
  for (let h = 0; h < 24; h++)
    for (let m = 0; m < 60; m += 15) {
      const d = new Date(2000, 0, 1, h, m)
      slots.push(format(d, 'h:mm a'))
    }
  return slots
}
```

### Phone — auto-format while typing
```typescript
export const formatPhone = (raw: string): string => {
  const digits = raw.replace(/\D/g, '')
  // Mobile 11 digits (09xx xxx xxxx)
  if (digits.startsWith('09') && digits.length <= 11)
    return [digits.slice(0,4), digits.slice(4,7), digits.slice(7,11)]
      .filter(Boolean).join(' ')
  // Landline with area code (0xx xxx xxxx)
  if (digits.startsWith('0') && !digits.startsWith('09') && digits.length <= 10)
    return [digits.slice(0,3), digits.slice(3,6), digits.slice(6,10)]
      .filter(Boolean).join(' ')
  // Local landline 7 digits (xxx xxxx)
  if (!digits.startsWith('0') && digits.length <= 7)
    return [digits.slice(0,3), digits.slice(3,7)]
      .filter(Boolean).join(' ')
  return raw
}
// Store in DB — digits only:
export const cleanPhone = (v: string): string => v.replace(/\D/g, '')
```

`PhoneInput.tsx` calls `formatPhone` on every `onChange`.
Always call `cleanPhone()` before saving to DB.

---

## Navigation — 6 items

1. Sales — icon: shopping-cart
2. Expenses — icon: receipt
3. Customers — icon: users
4. Inventory — icon: package
5. Reports — icon: chart-bar
6. Settings — icon: settings

Maintenance Log + Monthly Bills = sub-sections inside Settings. Not top-level nav.

Layout rules:
- `< md` (phone) → fixed bottom nav bar
- `md:` (tablet portrait) → collapsible sidebar, hamburger toggle
- `lg:` (iPad landscape) → fixed sidebar, 240px wide, always visible

---

## Modal rules — every modal follows these

- All forms open in modals. No inline page forms ever.
- `Modal.tsx` handles: backdrop click = close, Escape = close,
  max-height 90dvh, internal scroll, content never overflows
- Phone → bottom sheet (slides up from bottom), full width
- iPad landscape → centered dialog, max-width 680px, 2-column grid layout inside
- One modal open at a time
- Open/close state owned by the parent page, not the modal component
- Destructive confirm → small centered modal separate from form modal

---

## Sale form — complete field spec

### Customer section
Two tabs: **Existing customer** | **+ New customer**

**Existing tab:**
- Search input — 3-char trigger, live dropdown
- Each result: name + type badge + last order date
- Tap to select, closes dropdown

**New tab — inline expand, same modal, no sub-modal:**
- Name * (required)
- Type pill toggle: Walk-in / Regular / Retailer (default: Walk-in)
- Phone (PhoneInput — formats while typing, stores digits)
- Messenger (optional)
- Address (optional, map-pin icon, used for delivery pre-fill)
- Customer saved to DB only when the sale is submitted

### Product + quantity
- Product dropdown — water + ice only (add-ons are separate)
- Price/pc auto-fills from Settings, editable
- Qty stepper: − / number / + (min 1)
- Subtotal = qty × price (read-only computed)

### Add-ons (shown only if add-ons exist in Settings)
- Delivery zone — radio chips, only one selectable per sale
- Container fee — checkbox chip + qty stepper when active

### Order type + scheduling
Pill toggle: **Walk-in** | **Delivery** | **Pickup**

- Walk-in → no extra fields
- Delivery → delivery date + time dropdown (15-min) + delivery address
  (pre-fills from customer address, always editable)
- Pickup → pickup date + time dropdown (15-min)

### Payment
Segmented control: **Cash** | **GCash** | **Maya** | **Utang**
- Utang → amount received field hidden, balance = grand total,
  note shown: "Will appear in Unpaid Sales"
- Amount received → auto-fills to grand total if not Utang, editable for partial

### Remaining fields
- Sale date — auto = today PST, editable
- Remarks — optional
- Grand total — prominent read-only display
- Clear + Record Sale buttons

### Grand total formula
```
grandTotal = (qty × pricePerPc)
           + (containerOn ? containerQty × containerPrice : 0)
           + (selectedDeliveryZone?.price ?? 0)
```

---

## Reminder system

Auto-created when a sale with order_type = 'delivery' or 'pickup' is saved.
Walk-in → never a reminder, regardless of customer type.
Reminder is tied to the ORDER TYPE of the transaction, not the customer type.

```typescript
interface Reminder {
  id: string
  station_id: string
  sale_id: string
  customer_name: string
  order_type: 'delivery' | 'pickup'
  scheduled_at: string    // UTC in DB → display as PST
  message: string         // e.g. "Delivery — Arman — Gallon Flat ×2"
  is_dismissed: boolean
}
```

Polling in `src/lib/reminders.ts`:
- Run on app load + every 60 seconds
- Query: `scheduled_at <= now()` AND `is_dismissed = false`
- If any found → show ReminderModal queue
- Modal: type icon, customer name, item, zone/address, time + date (PST)
- Buttons: Dismiss (marks dismissed) | View Sale (navigates)

---

## User roles

| Role | Access |
|---|---|
| `owner` | Full access — all modules, settings, reports, manage staff |
| `staff` | Record sales, expenses, view inventory. No settings, no reports |
| `super_admin` | Hydra admin — all stations (your account only) |

Role stored in `users` table + embedded in JWT custom claim.
Check role from authStore. Gate owner-only UI with role check.

---

## Subscription plans

| Plan | Users | Features | Price |
|---|---|---|---|
| Free | 1 owner | Sales + Expenses only | ₱0 |
| Basic | 3 | All modules + reminders | ₱299/mo |
| Pro | Unlimited | All + priority support | ₱599/mo |

Feature gate example:
```typescript
const { station } = useAuthStore()
const canAccessReports = station?.plan !== 'free'
```

---

## Expenses

Categories: `labor` | `gasoline` | `supplies` | `maintenance` | `other`
- Labor = Pasahod. Employee name goes in Remarks.
- Daily manual entry. No payroll computation.

---

## Monthly Bills

Types: `electricity` | `water` | `internet` | `rent` | `other`
Filtered by month + year. Shows monthly total.
Lives inside Settings page.

---

## Inventory

- Mirrors active water + ice products from Settings
- Fields: available_qty, threshold, status (in_stock / low_stock / out_of_stock)
- Quick ± adjust buttons per row
- Low stock alert banner when any item ≤ threshold
- Auto-deducts qty when a sale is recorded

---

## Unpaid / Utang

- Unpaid if: payment_mode = 'utang' OR amount_received < total_amount
- balance_due = total_amount − amount_received (DB computed column)
- Status: paid | partial | unpaid
- Visible in: Sales page Unpaid section + Customer Profile page
- RecordPaymentModal: amount, mode (Cash/GCash/Maya), date, remarks
- After payment → call `sync_sale_status(sale_id)` Supabase function

---

## Naming conventions

| Thing | Pattern | Example |
|---|---|---|
| Components | PascalCase | `SaleModal.tsx` |
| Hooks | camelCase + use prefix | `useSales.ts` |
| Types/Interfaces | PascalCase | `SaleRow`, `CustomerProfile` |
| Zustand stores | camelCase + Store | `authStore.ts` |
| Non-component files | kebab-case | `supabase-client.ts` |
| DB tables | snake_case plural | `sales`, `customers` |
| DB columns | snake_case | `total_amount`, `station_id` |

---

## UI/UX standards

- Empty list → `EmptyState` (icon + message + CTA)
- Async fetch → `LoadingSkeleton`, not a spinner
- Error → inline error message, not console.log
- Delete → confirm dialog before executing
- Success → shadcn/ui Toast notification
- No page reloads — Supabase realtime subscriptions
- Transitions: `transition-all duration-150` — subtle only

---

## Benched — do not build yet

- Receipt / Resibo printing
- Order predictions / follow-up list
- Customer inactivity alerts
- Delivery routing / rider tracking
- Super admin dashboard
- Subscription billing integration

## Payroll system — build this

Full scheduling + pay computation for staff members.
- Staff schedules: per-staff weekly schedule (day, shift start/end, role)
- Time log: clock-in/clock-out per shift (manual entry by owner/admin)
- Pay computation: hourly rate × hours worked, or fixed daily rate
- Payroll run: owner marks a period as "paid", generates a labor expense entry automatically
- Payroll lives under Settings → Team tab (owner-only)
- A "run payroll" action creates one `labor` expense per staff member for the pay period
- No automatic bank transfer — manual cash/GCash payment, just records it

---

## ⚠️ PRE-IMPLEMENTATION SCAN — MANDATORY BEFORE EVERY SINGLE TASK ⚠️

**BEFORE WRITING A SINGLE LINE OF CODE, SCAN THE ENTIRE CODEBASE FOR:**

1. **EXISTING SHARED COMPONENTS** — IS THERE ALREADY A `DatePickerInput`? A `CurrencyInput`? A `Modal`? A file-attach button pattern? **USE THE EXISTING ONE. DO NOT CREATE A NEW ONE. DO NOT INLINE IT. IMPORT IT.**
   - Date fields → ALWAYS `<DatePickerInput>` from `@/components/shared/DatePickerInput`
   - Money fields → ALWAYS `<CurrencyInput>` from `@/components/shared/CurrencyInput` via `Controller`
   - File uploads → ALWAYS the same dashed-border `<button>` + hidden `<input type="file">` pattern already used in `ExpenseModal`/`BillModal`
   - Never invent a new UI pattern for something that already exists.

2. **DATABASE COLUMN NAMES** — GREP THE EXISTING HOOKS BEFORE NAMING ANY COLUMN IN AN INSERT OR SELECT. Column names must exactly match what is already used elsewhere in the codebase. If uncertain, grep `useExpenses.ts`, `useBills.ts`, `useMaintenance.ts`, etc. for the column name. **NEVER GUESS OR INVENT A COLUMN NAME.**

3. **EXISTING HOOKS** — Use the hook that already exists. Do not create a parallel hook for the same table.

4. **EXISTING TYPES** — Extend existing interfaces. Do not redeclare.

5. **UTILITY FUNCTIONS** — Check `src/lib/utils.ts` first. Do not reimplement `formatCurrency`, `formatDate`, `cn`, etc.

**VIOLATION OF THIS RULE IS THE #1 SOURCE OF BUGS IN THIS CODEBASE.** Column name mismatches and duplicate UI patterns break the app silently and cause hours of debugging. This rule exists because it has been violated repeatedly.

---

## Pre-flight checklist — before every code generation

1. Inline styles? → Never. Tailwind only.
2. `station_id` included in every query and insert?
3. Loading + error + empty states handled?
4. No `any` types?
5. Works on phone portrait AND iPad landscape?
6. Modal closes on backdrop tap AND Escape?
7. All dates/times in PST (Asia/Manila)?
8. Currency: ₱1,234.00?
9. Date: 01-Jun-2026?
10. Phone: formats while typing, stored as digits only?
11. Delivery/Pickup → reminder created?
12. Walk-in → no reminder created?
13. Role check before owner-only UI?
