# Honesty Store 2 - Autonomous Micro-Retail Production Application

Honesty Store 2 is a fully independent, production-ready autonomous micro-retail software installation created for a new customer/institution.

It contains the complete feature set of the Honesty Store platform (live UPI Cashfree integration, atomic inventory management, Supabase PostgreSQL with RLS, telemetry and order history) but operates with **100% architectural and operational isolation** from any previous installation.

---

## 🏗️ Architecture & Isolation

| Component | Installation 1 (Original) | Installation 2 (Honesty Store 2) |
| :--- | :--- | :--- |
| **Codebase & Git** | Original Repo (`honesty-store`) | Separate Repo (`honesty-store-2`) |
| **Hosting (Render)** | Render Web Service A | Render Web Service B |
| **Database (Supabase)** | Supabase Project A | Supabase Project B |
| **Payment Gateway** | Cashfree Merchant A | Cashfree Merchant B |
| **Admins & Users** | Original Admins & Users | Customer B Admins & Users |
| **Orders & Stock** | Original Store Orders | Customer B Orders |

---

## 🚀 Quick Setup Guide for New Customer

### Step 1: Create a New Supabase Project (Database B)
1. Go to [https://supabase.com](https://supabase.com) and create a brand new organization / project (e.g. `honesty-store-2`).
2. Once the project is created, open the **SQL Editor**.
3. Open [`supabase/00_full_schema_init.sql`](./supabase/00_full_schema_init.sql), copy the entire content, paste it into the SQL Editor, and click **Run**.
4. This will set up:
   - All tables (`products`, `orders`, `order_items`, `stock_audits`, `community_metrics`, `store_visits`, `admin_users`)
   - All indexes, constraints, triggers, and Row Level Security (RLS) policies
   - Atomic stored procedures (`deduct_inventory`, `record_store_visit`, `get_visit_metrics`)
   - `product-images` storage bucket with public read access
   - Clean initial seed catalog
5. Note down your credentials from **Project Settings > API**:
   - `Project URL` (`SUPABASE_URL`)
   - `anon public key` (`SUPABASE_ANON_KEY`)
   - `service_role key` (`SUPABASE_SERVICE_ROLE_KEY`)

### Step 2: Configure Cashfree Payment Gateway B
1. Register/log in to [https://merchant.cashfree.com](https://merchant.cashfree.com) for the new customer.
2. Go to **Developers > API Keys**:
   - Generate your **App ID** (`CASHFREE_APP_ID`)
   - Generate your **Secret Key** (`CASHFREE_SECRET_KEY`)
3. Set the Webhook URL in Cashfree Merchant Dashboard to:
   `https://<your-new-render-app>.onrender.com/api/cashfree-webhook`
   - Select version: `2023-08-01`
   - Subscribe to events: `ORDER.PAID`, `PAYMENT.SUCCESS`

### Step 3: Deploy on Render (Web Service B)
1. Push this repository to a new, private GitHub/GitLab repository for Customer B.
2. Log in to [https://render.com](https://render.com) and click **New > Web Service**.
3. Connect the new repository.
4. Set Build and Start settings:
   - **Environment:** `Node`
   - **Build Command:** `npm install` (or leave empty if no additional dependencies)
   - **Start Command:** `node server.js`
5. Under **Environment Variables**, add:
   ```env
   STORE_NAME=Honesty Store 2
   APP_BASE_URL=https://<your-new-render-service>.onrender.com
   ADMIN_EMAILS=admin@new-institution.edu,manager@new-institution.edu
   SERVER_SECRET=generate-a-32-char-random-string
   ALLOWED_ORIGINS=https://<your-new-render-service>.onrender.com

   SUPABASE_URL=https://<your-new-supabase-id>.supabase.co
   SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1Ni...
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1Ni...

   CASHFREE_APP_ID=CF_APP_ID_FOR_CUSTOMER_B
   CASHFREE_SECRET_KEY=cfsk_ma_...
   CASHFREE_ENV=PRODUCTION

   CRON_SECRET=generate-a-random-cron-secret
   ```
6. Click **Create Web Service**.

### Step 4: Configure Automatic Uptime / Reconciliation
In [UptimeRobot](https://uptimerobot.com) or your preferred pinger:
- Monitor Type: `HTTP(s)`
- URL: `https://<your-new-render-service>.onrender.com/api/cron/reconcile?key=<YOUR_CRON_SECRET>`
- Interval: Every 5 minutes
- This keeps Render awake and automatically reconciles any abandoned or missed webhook payments against Cashfree's server!

---

## 🔒 Verification of Complete Isolation
After deployment, confirm:
1. Creating a product in Honesty Store 2 does NOT appear in Store 1.
2. Customer orders placed in Honesty Store 2 only exist in Supabase Project B and Cashfree Account B.
3. Modifying inventory or settings in Honesty Store 2 has zero impact on Store 1.
