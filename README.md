# SurgePay WhatsApp Bot

# SurgePay WhatsApp Bot

**Advanced Cross-Border Remittance Simulation.**

SurgePay is an enterprise-grade WhatsApp chatbot prototype that **simulates** seamless USD to INR remittances. It leverages a robust event-driven architecture to demonstrate real-time currency conversion, secure bank linking (via a realistic Plaid mock), and instant payout simulations to UPI or bank accounts.

Built with **TypeScript**, **Node.js**, **PostgreSQL**, and **Redis**, prioritizing data integrity, decimal precision, and fault tolerance.

### 🌟 Key Interactive Features
- **Button-First Experience**: Uses Twilio's Interactive Buttons for all major actions (Bank Selection, Confirmations, Payment Methods) - no more typing "1" or "Yes".
- **Real-Time FX Ticker**: When a transfer is initiated, the bot sends a **Live Quote** that updates automatically every **30 seconds** via background jobs.
- **Rate Locking**: Once the user hits "CONFIRM", the real-time ticker stops, and the rate is **locked** for 5 minutes to guarantee the transaction.

---

## 🏗️ System Architecture & Data Flow

SurgePay uses a robust **Event-Driven Architecture** designed for high availability.

### 🔄 The "Safe-Session" Architecture

We use a tiered storage strategy to ensure **zero data loss** while maintaining millisecond-latency for user interactions.

```text
+-------------------+       +-------------------+       +---------------------------+
|                   |       |                   |       |                           |
|   USER (WhatsApp) | ----> |   TWILIO CLOUD    | ----> |     SURGEPAY SERVER       |
|                   |       |                   |       |                           |
+-------------------+       +-------------------+       +-------------+-------------+
                                                                      |
                                                         (Check Session Cache)
                                                                      |
                                                                      v
                                                       +--------------+--------------+
                                                       |                             |
                                                 [ REDIS CACHE ] (Primary)           |
                                                       |                             |
                                                       +--------------+--------------+
                                                                      |
                                                         (Fallback if Redis Down)
                                                                      |
                                                                      v
                                                       +--------------+--------------+
                                                       |                             |
                                                 [ POSTGRESQL ] (Persistent)         |
                                                       |                             |
                                                       +-----------------------------+
```

### 🧠 Decision Engine: Where is Data Saved?

| Data Type | Primary Storage | Backup Storage | Verification |
|-----------|----------------|----------------|--------------|
| **User Session** (State) | **Redis** (TTL 1hr) | **PostgreSQL** | If Redis fails, app automatically reads/writes to Postgres `sessions` table. |
| **User Profile** (KYC) | **PostgreSQL** | N/A | Validated via Zod Schemas before insertion into `users` table. |
| **Transfers** (Financial) | **PostgreSQL** | N/A | Stored with `DECIMAL` precision. **Never** in Redis. |
| **Quotes** (Temporary) | **PostgreSQL** | N/A | Stored in `transfers` table with `quote_expires_at` timestamp. |

---

## � Financial Precision Engineering

Handling money requires absolute precision. In JavaScript/TypeScript, standard math (`0.1 + 0.2`) results in floating-point errors (`0.30000000000000004`). **This is unacceptable for finance.**

SurgePay solves this with a **Triple-Layer Precision Strategy**:

### 1. Database Layer (The Source of Truth)
We strictly use the `DECIMAL` data type in PostgreSQL, not `FLOAT` or `REAL`.
- **Amount (USD):** `DECIMAL(10,2)` -> Stores exact cents (e.g., `100.00`).
- **FX Rate:** `DECIMAL(10,4)` -> High precision for rates (e.g., `83.4567`).
- **Amount (INR):** `DECIMAL(10,2)` -> Exact payout amount.

### 2. Application Layer (Safe Parsing)
Data from the database is returned as `string` to prevent JavaScript from auto-converting to float.
```typescript
// Example from src/models/Transfer.ts
interface TransferRow {
    amount_usd: string; // "100.50" - Safe from float errors
    fx_rate: string;    // "83.5000"
}
```
We interpret these strings using strict float parsing **only** at the moment of calculation, and immediately re-fix them using `toFixed(2)`.

### 3. Calculation Layer (The "Penny-Perfect" Logic)
All fee calculations use explicit rounding rules to ensure the `Fee + Net Amount` always equals `Total Amount`.

```typescript
// Fee Calculation Logic
const fee = Math.min(amount * 0.001, 2.00); // Max $2.00
const net = amount - fee;                   // Exact subtraction
const inr = net * rate;                     // Conversion
```

---

## 🛠️ Core Features

### 🔐 Secure Onboarding & KYC
- **Schema Validation**: Every input (Name, DOB, Address) is validated against strict Zod schemas.
- **State Machine**: Users are guided through a linear, unbreakable onboarding flow.

### 🏦 Bank Integration (Plaid)
- **Interactive Flow**: Uses Twilio button templates (`link_bank`, `bank_selection`).
- **Mock Service**: Simulates Plaid's `Link` flow with realistic latency and error scenarios.
- **Security**: Account numbers are masked (`****1234`) in strict compliance with logs.

### 💸 Real-Time Transfers
- **Live Quotes**: Fetches real-time FX rates.
- **Quote Locking**: Quotes are valid for **5 minutes**.
- **Auto-Expiry**: Background jobs monitor active quotes and auto-expire them.
- **Status Updates**: Users get proactive notifications (`processing` -> `completed`).

### 🌍 Global Commands
At any point, users can access powerful tools via the **Interceptor Middleware**:

- `STATUS`: Check active transfers.
- `RATE`: Get live USD -> INR rate.
- `FEES`: View fee structure.
- `PROFILE`: View KYC details.
- `NEW`: Start a fresh transfer.

---

## 🛡️ Error Handling Strategy

**"Fail Safe, Fail Fast, Fail Loudly (Internally)"**

1. **User-Facing**: Generic, helpful messages ("Something went wrong, please try again"). **Internal stack traces are NEVER exposed.**
2. **Logging**: Full stack traces and context are logged to the console/file for debugging.
3. **Graceful Degradation**: 
   - **Database Down?** API returns 503 Service Unavailable.
   - **Redis Down?** Automatically falls back to Postgres for sessions. User notices nothing.
   - **FX API Down?** User is asked to "try again in a few moments".
4. **Input Sanitization**: All inputs are trimmed, normalized, and validated via Zod before touching business logic.

---

## ⚡ Setup & Deployment

### Environment Variables
Configure your `.env` file with these keys:

**Infrastructure**
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_NUMBER`

**Twilio Content Templates (Buttons)**
| Variable | Template Name | Function |
|----------|---------------|----------|
| `CONTENT_SID_IDLE_MENU` | `idle_menu` | Main menu (NEW, STATUS, HELP) |
| `CONTENT_SID_YES_NO` | `yes_no` | Generic confirmation |
| `CONTENT_SID_CONFIRM_CANCEL` | `confirm_cancel` | Quote acceptance |
| `CONTENT_SID_PAY_CANCEL` | `pay_cancel` | Final payment |
| `CONTENT_SID_LINK_BANK` | `link_bank` | Plaid initiation |
| `CONTENT_SID_BANK_SELECTION`| `bank_selection` | Chase / BoA / Wells |
| `CONTENT_SID_PAYMENT_METHOD`| `payment_method` | UPI / Bank |
| `CONTENT_SID_ADD_RECIPIENT` | `add_recipient` | Add new recipient |

### Database Migrations
We use raw SQL migrations for maximum control and performance.

```bash
npm run migrate
```

### Running the Project

```bash
# Development
npm run dev

# Production Build
npm run build
npm start
```

### Testing
Comprehensive test suite using **Jest**.

```bash
npm test
```
*Covering: Schema Validation, FX Logic, Code Generation, Plaid Services.*

---

## 📁 Project Structure

```
src/
├── config/         # Database & Redis configuration
├── constants/      # State definitions & Enums
├── controllers/    # Webhook entry points
├── handlers/       # Business logic for each state
├── jobs/           # Background tasks (Cron)
├── middleware/     # Command interception & Error handling
├── models/         # Database access layer (DAO)
├── routes/         # API routing
├── schemas/        # Zod validation schemas
├── services/       # Core business services (FX, Twilio, Session)
└── utils/          # Helpers (Logger, Generator)
```

---

*Built with precision. Engineered for reliability.*
