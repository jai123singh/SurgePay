# SurgePay WhatsApp Bot

**Advanced Cross-Border Remittance Simulation.**

SurgePay is an enterprise-grade WhatsApp chatbot prototype that **simulates** seamless USD to INR remittances. It leverages a robust event-driven architecture to demonstrate real-time currency conversion, secure bank linking (via a realistic Plaid mock), and instant payout simulations to UPI or bank accounts.

Built with **TypeScript**, **Node.js**, **PostgreSQL**, and **Redis**, prioritizing data integrity, decimal precision, and fault tolerance.

---

## 🌟 Key Interactive Features

### Button-First Experience
Uses Twilio's Interactive Quick-Reply Buttons for all major actions. Users tap buttons instead of typing "1" or "Yes".

### Real-Time FX Ticker
When a transfer is initiated, the bot sends a **Live Quote** that updates automatically every **30 seconds** via background jobs.

### Rate Locking
Once the user hits "CONFIRM", the real-time ticker stops, and the rate is **locked** for 5 minutes to guarantee the transaction.

---

## 📱 WhatsApp Business API: Constraints & Design Decisions

### Why Only 3 Buttons Per Template?

**Limitation:** WhatsApp Business API (via Twilio) restricts `quick_reply` templates to a maximum of **3 buttons** without full Meta Business approval.

**Our Solution:** We designed all templates to fit within this constraint:
- `idle_menu`: NEW, STATUS, HELP (3 buttons)
- `bank_selection`: Chase, Bank of America, Wells Fargo (3 buttons)
- `yes_no`, `confirm_cancel`, `pay_cancel`: 2 buttons each

### Why Are Templates Static (Not Dynamic)?

**Limitation:** Twilio Content Templates require **pre-approval from Meta**. Once approved, the button text and body are **immutable**. You cannot dynamically change button labels at runtime.

**Our Solution:**
1. We use **generic, reusable templates** (e.g., `yes_no` for any confirmation).
2. The **body text is sent separately** as a dynamic message, followed by the static button template.
3. This gives the illusion of dynamic content while respecting API constraints.

```text
[Dynamic Message]     →  "Confirm transfer of $100 to Mom?"
[Static Template]     →  [YES] [NO]  ← These are fixed
```

---

## 🏗️ System Architecture & Data Flow

### The "Safe-Session" Architecture 

We use a tiered storage strategy to ensure **zero data loss** while maintaining millisecond-latency for user interactions.

```text
+-------------------+       +-------------------+       +---------------------------+
|                   |       |                   |       |                           |
|   USER (WhatsApp) | ────► |   TWILIO CLOUD    | ────► |     SURGEPAY SERVER       |
|                   |       |                   |       |                           |
+-------------------+       +-------------------+       +-------------+-------------+
                                                                      │
                                                         (Check Session Cache)
                                                                      │
                                                                      ▼
                                                       +--------------+--------------+
                                                       │                             │
                                                 [ REDIS CACHE ] (Primary)           │
                                                       │                             │
                                                       +--------------+--------------+
                                                                      │
                                                         (Fallback if Redis Down)
                                                                      │
                                                                      ▼
                                                       +--------------+--------------+
                                                       │                             │
                                                 [ POSTGRESQL ] (Persistent)         │
                                                       │                             │
                                                       +-----------------------------+
```

### Data Storage Decision Engine

| Data Type | Primary Storage | Backup Storage | Notes |
|-----------|----------------|----------------|-------|
| **User Session** (State) | **Redis** (TTL 1hr) | **PostgreSQL** | Auto-fallback if Redis fails |
| **User Profile** (KYC) | **PostgreSQL** | N/A | Zod-validated before insertion |
| **Transfers** (Financial) | **PostgreSQL** | N/A | Uses `DECIMAL` precision. **Never** cached |
| **Quotes** (Temporary) | **PostgreSQL** | N/A | Has `quote_expires_at` timestamp |

## 🔄 State Machine Architecture

SurgePay uses a **Finite State Machine (FSM)** with **17 active states** and **47 possible transitions**.

### Complete State Transition Diagram

```text
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                    INITIAL                                              │
│                                       │                                                 │
│                          ┌────────────┴────────────┐                                    │
│                          │                         │                                    │
│                    [User Exists]              [New User]                                │
│                          │                         │                                    │
│                          ▼                         ▼                                    │
│                       ┌──────┐              ┌─────────────┐                             │
│                       │ IDLE │◄─────────────┤ ASKING_NAME │                             │
│                       └──┬───┘   (CANCEL)   └──────┬──────┘                             │
│                          │                         │ (valid name)                       │
│          ┌───────────────┼───────────────┐         ▼                                    │
│          │               │               │  ┌──────────────┐                            │
│      [NEW cmd]    [BANKS cmd]    [RECIPIENTS] │ASKING_EMAIL │                           │
│          │          (no banks)       (none)  └──────┬───────┘                           │
│          │               │               │         │ (valid email)                      │
│          ▼               ▼               ▼         ▼                                    │
│  ┌───────────────┐ ┌─────────────────┐  │   ┌────────────┐                              │
│  │ASKING_RECIPIENT│ │INITIATING_PLAID │◄─┘   │ASKING_DOB  │                             │
│  │    _NAME      │ └────────┬────────┘       └─────┬──────┘                             │
│  └───────┬───────┘          │                      │ (valid DOB)                        │
│          │                  │ (LINK BANK)          ▼                                    │
│          │                  ▼                ┌──────────────┐                           │
│          │          ┌──────────────┐         │ASKING_ADDRESS│                           │
│          │          │SELECTING_BANK│         └──────┬───────┘                           │
│          │          └──────┬───────┘                │ (valid address)                   │
│          │                 │                        │                                   │
│          │      ┌──────────┼──────────┐             │                                   │
│          │      │          │          │             │                                   │
│          │ [invalid]  [valid]    [fail]             │                                   │
│          │      │          │          │             │                                   │
│          │      ▼          ▼          ▼             │                                   │
│          │   (self)  ┌───────────────────┐          │                                   │
│          │           │CONFIRMING_PLAID_  │◄─────────┘                                   │
│          │           │     BANK          │                                              │
│          │           └─────────┬─────────┘                                              │
│          │                     │                                                        │
│          │          ┌──────────┼──────────┐                                             │
│          │          │          │          │                                             │
│          │       [YES]      [NO]    [addingBank]                                        │
│          │          │          │          │                                             │
│          │          ▼          ▼          ▼                                             │
│          │ ┌────────────┐ ┌──────────┐  ┌──────┐                                        │
│          └►│ASKING_     │ │SELECTING_│  │ IDLE │                                        │
│            │RECIPIENT_  │ │  BANK    │  └──────┘                                        │
│            │   NAME     │ └──────────┘                                                  │
│            └─────┬──────┘                                                               │
│                  │                                                                      │
│       ┌──────────┼──────────┐                                                           │
│       │          │          │                                                           │
│  [existing]  [new UPI]  [new Bank]                                                      │
│       │          │          │                                                           │
│       ▼          ▼          ▼                                                           │
│ ┌───────────┐ ┌─────────────────┐ ┌────────────────────┐                                │
│ │ASKING_    │ │ASKING_PAYMENT_  │ │ASKING_PAYMENT_     │                                │
│ │AMOUNT     │ │METHOD (→UPI)    │ │METHOD (→Bank)      │                                │
│ └─────┬─────┘ └────────┬────────┘ └─────────┬──────────┘                                │
│       │                │                    │                                           │
│       │                ▼                    ▼                                           │
│       │         ┌─────────────┐     ┌────────────────────┐                              │
│       │         │ASKING_UPI_ID│     │ASKING_ACCOUNT_     │                              │
│       │         └──────┬──────┘     │NUMBER              │                              │
│       │                │            └─────────┬──────────┘                              │
│       │                │                      │                                         │
│       │                │                      ▼                                         │
│       │                │              ┌─────────────┐                                   │
│       │                │              │ASKING_IFSC  │                                   │
│       │                │              └──────┬──────┘                                   │
│       │                │                     │                                          │
│       │                │                     ▼                                          │
│       │                │            ┌──────────────────┐                                │
│       │                │            │ASKING_BANK_NAME  │                                │
│       │                │            └────────┬─────────┘                                │
│       │                │                     │                                          │
│       │                └──────────┬──────────┘                                          │
│       │                           │                                                     │
│       │                           ▼                                                     │
│       │                 ┌───────────────────┐                                           │
│       │                 │CONFIRMING_RECIPIENT│                                          │
│       │                 └─────────┬─────────┘                                           │
│       │                           │                                                     │
│       │              ┌────────────┼────────────┐                                        │
│       │              │            │            │                                        │
│       │           [YES]        [NO-UPI]    [NO-Bank]                                    │
│       │              │            │            │                                        │
│       │              ▼            ▼            ▼                                        │
│       │◄─────────────┘     ┌───────────┐ ┌────────────────┐                             │
│       │                    │ASKING_    │ │ASKING_ACCOUNT_ │                             │
│       │                    │UPI_ID     │ │NUMBER          │                             │
│       │                    └───────────┘ └────────────────┘                             │
│       │                                                                                 │
│       ▼                                                                                 │
│ ┌─────────────────────────────────────────────────────────────────┐                     │
│ │                        TRANSFER FLOW                             │                    │
│ │                                                                  │                    │
│ │  ASKING_AMOUNT ──(valid)──► SHOWING_QUOTE                        │                    │
│ │       │                          │                               │                    │
│ │    (error)              ┌────────┼────────┐                      │                    │
│ │       │                 │        │        │                      │                    │
│ │       ▼            [CONFIRM] [CANCEL] [EXPIRED]                  │                    │
│ │    (self)              │        │        │                       │                    │
│ │                        ▼        ▼        ▼                       │                    │
│ │              ┌─────────────┐  ┌──────┐ ┌──────┐                   │                   │
│ │  (1 bank)───►│CONFIRMING_  │  │ IDLE │ │ IDLE │                   │                   │
│ │              │TRANSFER     │  └──────┘ └──────┘                   │                   │
│ │              └──────┬──────┘                                      │                   │
│ │  (multi)───►┌────────────────────┐                                │                   │
│ │             │BANK_ACCOUNT_       │                                │                   │
│ │             │SELECTION           │                                │                   │
│ │             └─────────┬──────────┘                                │                   │
│ │                       │                                           │                   │
│ │                       ▼                                           │                   │
│ │              ┌───────────────────┐                                │                   │
│ │              │CONFIRMING_TRANSFER│                                │                   │
│ │              └─────────┬─────────┘                                │                   │
│ │                        │                                          │                   │
│ │              ┌─────────┼─────────┐                                │                   │
│ │              │         │         │                                │                   │
│ │           [PAY]    [CANCEL]  [invalid]                            │                   │
│ │              │         │         │                                │                   │
│ │              ▼         ▼         ▼                                │                   │
│ │          ┌──────┐  ┌──────┐  (self)                               │                   │
│ │          │ IDLE │  │ IDLE │                                       │                   │
│ │          └──────┘  └──────┘                                       │                   │
│ └──────────────────────────────────────────────────────────────────┘                    │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### State Transition Table (All 47 Transitions)

| From State | To State | Trigger |
|------------|----------|---------|
| `INITIAL` | `IDLE` | User exists |
| `INITIAL` | `ASKING_NAME` | New user |
| `ASKING_NAME` | `ASKING_EMAIL` | Valid name |
| `ASKING_NAME` | `ASKING_NAME` | Invalid input |
| `ASKING_NAME` | `IDLE` | CANCEL |
| `ASKING_EMAIL` | `ASKING_DOB` | Valid email |
| `ASKING_EMAIL` | `ASKING_EMAIL` | Invalid email |
| `ASKING_EMAIL` | `IDLE` | CANCEL |
| `ASKING_DOB` | `ASKING_ADDRESS` | Valid DOB |
| `ASKING_DOB` | `ASKING_DOB` | Invalid DOB |
| `ASKING_DOB` | `IDLE` | CANCEL |
| `ASKING_ADDRESS` | `INITIATING_PLAID` | Valid address |
| `ASKING_ADDRESS` | `ASKING_ADDRESS` | Invalid address |
| `ASKING_ADDRESS` | `IDLE` | CANCEL |
| `INITIATING_PLAID` | `SELECTING_BANK` | LINK BANK |
| `INITIATING_PLAID` | `INITIATING_PLAID` | Invalid input |
| `INITIATING_PLAID` | `IDLE` | CANCEL |
| `SELECTING_BANK` | `CONFIRMING_PLAID_BANK` | Valid selection |
| `SELECTING_BANK` | `SELECTING_BANK` | Invalid/Retry/Fail |
| `SELECTING_BANK` | `IDLE` | CANCEL |
| `CONFIRMING_PLAID_BANK` | `ASKING_RECIPIENT_NAME` | YES (first setup) |
| `CONFIRMING_PLAID_BANK` | `IDLE` | YES (adding bank) |
| `CONFIRMING_PLAID_BANK` | `SELECTING_BANK` | NO |
| `CONFIRMING_PLAID_BANK` | `INITIAL` | Session expired |
| `CONFIRMING_PLAID_BANK` | `IDLE` | CANCEL |
| `ASKING_RECIPIENT_NAME` | `ASKING_AMOUNT` | Existing recipient |
| `ASKING_RECIPIENT_NAME` | `ASKING_PAYMENT_METHOD` | New recipient |
| `ASKING_RECIPIENT_NAME` | `IDLE` | CANCEL |
| `ASKING_PAYMENT_METHOD` | `ASKING_UPI_ID` | UPI selected |
| `ASKING_PAYMENT_METHOD` | `ASKING_ACCOUNT_NUMBER` | Bank selected |
| `ASKING_PAYMENT_METHOD` | `IDLE` | CANCEL |
| `ASKING_UPI_ID` | `CONFIRMING_RECIPIENT` | Valid UPI |
| `ASKING_UPI_ID` | `ASKING_UPI_ID` | Invalid UPI |
| `ASKING_UPI_ID` | `IDLE` | CANCEL |
| `ASKING_ACCOUNT_NUMBER` | `ASKING_IFSC` | Valid account |
| `ASKING_ACCOUNT_NUMBER` | `IDLE` | CANCEL |
| `ASKING_IFSC` | `ASKING_BANK_NAME` | Valid IFSC |
| `ASKING_IFSC` | `IDLE` | CANCEL |
| `ASKING_BANK_NAME` | `CONFIRMING_RECIPIENT` | Valid + verified |
| `ASKING_BANK_NAME` | `ASKING_ACCOUNT_NUMBER` | Verification failed |
| `ASKING_BANK_NAME` | `IDLE` | CANCEL |
| `CONFIRMING_RECIPIENT` | `ASKING_AMOUNT` | YES |
| `CONFIRMING_RECIPIENT` | `ASKING_UPI_ID` | NO (UPI) |
| `CONFIRMING_RECIPIENT` | `ASKING_ACCOUNT_NUMBER` | NO (Bank) |
| `CONFIRMING_RECIPIENT` | `IDLE` | CANCEL |
| `ASKING_AMOUNT` | `SHOWING_QUOTE` | Valid amount |
| `ASKING_AMOUNT` | `ASKING_AMOUNT` | Invalid amount |
| `ASKING_AMOUNT` | `ASKING_RECIPIENT_NAME` | No recipient |
| `ASKING_AMOUNT` | `IDLE` | CANCEL/Duplicate/FX fail |
| `SHOWING_QUOTE` | `CONFIRMING_TRANSFER` | CONFIRM (1 bank) |
| `SHOWING_QUOTE` | `BANK_ACCOUNT_SELECTION` | CONFIRM (multi bank) |
| `SHOWING_QUOTE` | `INITIATING_PLAID` | No banks |
| `SHOWING_QUOTE` | `IDLE` | CANCEL/Expired |
| `BANK_ACCOUNT_SELECTION` | `CONFIRMING_TRANSFER` | Valid selection |
| `BANK_ACCOUNT_SELECTION` | `BANK_ACCOUNT_SELECTION` | Invalid selection |
| `BANK_ACCOUNT_SELECTION` | `IDLE` | CANCEL |
| `CONFIRMING_TRANSFER` | `IDLE` | PAY/CANCEL |
| `CONFIRMING_TRANSFER` | `CONFIRMING_TRANSFER` | Invalid input |

### Global Command Transitions (from IDLE only)

| Command | Target State |
|---------|--------------|
| `NEW` | `ASKING_RECIPIENT_NAME` |
| `NEW` (no user) | `INITIAL` |
| `ADD BANK` | `INITIATING_PLAID` |
| `BANKS` (no banks) | `INITIATING_PLAID` |
| `RECIPIENTS` (none) | `ASKING_RECIPIENT_NAME` |
| All others | `IDLE` (stay) |

---

## ⚡ What Happens When Users Interrupt?

### Scenario 1: User Sends Random Message Mid-Flow

**Example:** User is at `ASKING_EMAIL` and types "hello" instead of an email.

**Handler Response:**
```text
Please enter a valid email address.

Or type CANCEL to abort.
```

The state **remains unchanged**. User must provide valid input or CANCEL.

### Scenario 2: User Tries Global Command Mid-Flow

**Example:** User is at `ASKING_AMOUNT` and types "STATUS".

**Interceptor Response:**
```text
This action is not available right now.

You can:
• Complete the current step
• Type CANCEL to abort and return to menu
```

**Why?** The `commandInterceptor.ts` blocks global commands when not in `IDLE` state (except `CANCEL`).

### Scenario 3: User Types CANCEL

**From ANY state**, typing `CANCEL` returns to `IDLE`:
```text
Action cancelled.

━━━━━━━━━━━━━━━━━━━━
All Commands
━━━━━━━━━━━━━━━━━━━━
NEW - Start new transfer
STATUS - View recent transfers
...
```

### Scenario 4: Transfer In Progress

**Example:** User initiated transfer, background job is processing, user types anything.

**Response:**
```text
Transfer in progress. Please wait for completion.
You will receive status updates automatically.
```

**All commands are blocked** until background job completes and clears `transferProcessing` flag.

---

## 💎 Financial Precision Engineering

### The Problem
JavaScript math: `0.1 + 0.2 = 0.30000000000000004`. **Unacceptable for finance.**

### Our Triple-Layer Precision Strategy

#### 1. Database Layer (Source of Truth)
```sql
-- From migrations/001_create_tables.sql
amount_usd   DECIMAL(10,2),  -- Exact cents: 100.00
fx_rate      DECIMAL(10,4),  -- High precision: 83.4567
amount_inr   DECIMAL(10,2)   -- Exact paise: 8345.67
```

#### 2. Application Layer (Safe Parsing)
```typescript
// PostgreSQL returns DECIMAL as string to prevent JS float conversion
interface TransferRow {
    amount_usd: string; // "100.50" - Safe from float errors
    fx_rate: string;    // "83.5000"
}
```

#### 3. Calculation Layer (Penny-Perfect Logic)
```typescript
const fee = Math.min(amount * 0.001, 2.00); // Max $2.00
const net = amount - fee;
const inr = net * rate;
```

---

## 🗄️ Why Raw SQL Instead of an ORM?

We deliberately chose **raw SQL queries** over ORMs like Prisma, TypeORM, or Sequelize. Here's why:

### 1. DECIMAL Precision Control

ORMs often auto-convert database types. When PostgreSQL returns `DECIMAL(10,2)`, some ORMs automatically parse it to JavaScript `number`, **introducing floating-point errors**.

With raw SQL + `pg` driver:
```typescript
// PostgreSQL returns DECIMAL as STRING (safe!)
interface TransferRow {
    amount_usd: string;  // "100.50" - NOT a float
}

// We control exactly WHEN to parse
const amount = parseFloat(row.amount_usd);
```

ORMs abstract this away, removing our control over precision-critical conversions.

### 2. Query Transparency

Financial applications require **auditable queries**. With raw SQL:
- Every query is visible in the codebase
- No hidden JOIN magic or N+1 queries
- Easy to copy-paste into `psql` for debugging
- No ORM version upgrades breaking query behavior

### 3. No Runtime Overhead

ORMs add:
- Query parsing and transformation layers
- Model hydration overhead
- Additional dependencies (Prisma: ~150MB node_modules)

Our `pg` driver is lightweight (~1MB) and executes queries directly.

### 4. Type Safety Without ORM

We achieve type safety through:
```typescript
// Explicit row interface
interface TransferRow {
    id: string;
    amount_usd: string;
    status: TransferStatus;
}

// Typed query helper
const result = await query<TransferRow>(sql, params);
```

This gives us TypeScript autocompletion without ORM overhead.

---

## 🛡️ Error Handling Strategy

**Philosophy: "Fail Safe, Fail Fast, Fail Loudly (Internally)"**

| Scenario | User Sees | Internal Action |
|----------|-----------|-----------------|
| **Invalid Input** | Friendly error + retry prompt | Zod validation logged |
| **Database Down** | "Something went wrong" | 503 + full stack trace logged |
| **Redis Down** | **Nothing** (seamless) | Auto-fallback to PostgreSQL |
| **FX API Down** | "Try again in a few moments" | Error logged, no fallback rate |
| **Twilio Buttons Fail** | Text message only | Warning logged, text fallback |

---

## 🌍 Global Commands

Available from `IDLE` state via **Interceptor Middleware**:

| Command | Function |
|---------|----------|
| `NEW` | Start new transfer |
| `STATUS` | View recent transfers |
| `HELP` | Show all commands |
| `RATE` | Get live USD → INR rate |
| `FEES` | View fee structure |
| `BANKS` | Manage linked accounts |
| `RECIPIENTS` | View saved recipients |
| `PROFILE` | View KYC details |
| `DEFAULT [#]` | Set default bank account |
| `REMOVE [#]` | Remove a bank account |
| `CANCEL` | Abort current flow (works ANYWHERE) |

---

## ⚙️ Environment Variables

### Infrastructure
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_NUMBER`

### Twilio Content Templates

| Variable | Template | Buttons |
|----------|----------|---------|
| `CONTENT_SID_IDLE_MENU` | `idle_menu` | NEW, STATUS, HELP |
| `CONTENT_SID_YES_NO` | `yes_no` | YES, NO |
| `CONTENT_SID_CONFIRM_CANCEL` | `confirm_cancel` | CONFIRM, CANCEL |
| `CONTENT_SID_PAY_CANCEL` | `pay_cancel` | PAY, CANCEL |
| `CONTENT_SID_LINK_BANK` | `link_bank` | LINK BANK |
| `CONTENT_SID_BANK_SELECTION` | `bank_selection` | Chase, BoA, Wells |
| `CONTENT_SID_PAYMENT_METHOD` | `payment_method` | UPI, Bank Account |
| `CONTENT_SID_ADD_RECIPIENT` | `add_recipient` | NEW |

---

## 📁 Project Structure

```text
src/
├── config/         # Database & Redis configuration
├── constants/      # State definitions (19 states)
├── controllers/    # ConversationController - main routing
├── handlers/       # Business logic for each state
│   ├── onboarding.ts   # Name, Email, DOB, Address
│   ├── plaid.ts        # Bank linking flow
│   ├── recipient.ts    # UPI/Bank account collection
│   ├── transfer.ts     # Quote, Confirm, Pay
│   └── globalCommands.ts  # STATUS, RATE, FEES, etc.
├── middleware/     # commandInterceptor, errorHandler
├── models/         # Database access layer (User, Transfer, etc.)
├── schemas/        # Zod validation schemas
├── services/       # TwilioService, FXRateService, SessionService
└── utils/          # Logger, TransferCodeGenerator
```

---

## 🧪 Testing

```bash
npm test
```

**54 tests** covering:
- Schema validation (Amount, UPI, IFSC, DOB)
- FX calculations (fee cap, quote logic)
- Transfer code generation
- Plaid service mocking

---

*Built with precision. Engineered for reliability.*

