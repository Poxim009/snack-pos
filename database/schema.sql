-- ============================================================
-- schema.sql — สร้างตารางทั้งหมดในฐานข้อมูลสำหรับ PostgreSQL
-- ============================================================

-- ============================================================
-- 1. หมวดหมู่สินค้า
-- ============================================================
CREATE TABLE IF NOT EXISTS product_categories (
    id         SERIAL PRIMARY KEY,
    name       TEXT    NOT NULL,
    emoji      TEXT    DEFAULT '📦',
    sort_order INTEGER DEFAULT 0
);

-- ============================================================
-- 2. สินค้า
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
    id          SERIAL PRIMARY KEY,
    category_id INTEGER REFERENCES product_categories(id),
    name        TEXT    NOT NULL,
    emoji       TEXT    DEFAULT '🍪',
    sell_price  REAL    NOT NULL DEFAULT 0,
    cost_price  REAL    NOT NULL DEFAULT 0,
    stock_qty   INTEGER NOT NULL DEFAULT 0,
    is_active   INTEGER DEFAULT 1,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 3. รายการขาย (1 Bill = 1 แถว)
-- ============================================================
CREATE TABLE IF NOT EXISTS sales (
    id           SERIAL PRIMARY KEY,
    date         TEXT    NOT NULL,
    total_amount REAL    NOT NULL,
    note         TEXT    DEFAULT '',
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 4. รายละเอียดของแต่ละบิล
-- ============================================================
CREATE TABLE IF NOT EXISTS sale_items (
    id           SERIAL PRIMARY KEY,
    sale_id      INTEGER NOT NULL REFERENCES sales(id),
    product_id   INTEGER REFERENCES products(id),
    product_name TEXT    NOT NULL,
    quantity     INTEGER NOT NULL,
    unit_price   REAL    NOT NULL,
    subtotal     REAL    NOT NULL
);

-- ============================================================
-- 5. หมวดหมู่รายจ่าย
-- ============================================================
CREATE TABLE IF NOT EXISTS expense_categories (
    id         SERIAL PRIMARY KEY,
    name       TEXT    NOT NULL,
    emoji      TEXT    DEFAULT '💸',
    sort_order INTEGER DEFAULT 0
);

-- ============================================================
-- 6. รายจ่าย / ต้นทุน
-- ============================================================
CREATE TABLE IF NOT EXISTS expenses (
    id          SERIAL PRIMARY KEY,
    category_id INTEGER REFERENCES expense_categories(id),
    date        TEXT    NOT NULL,
    description TEXT    NOT NULL,
    amount      REAL    NOT NULL,
    image_path  TEXT    DEFAULT '',
    note        TEXT    DEFAULT '',
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 7. ลูกค้า
-- ============================================================
CREATE TABLE IF NOT EXISTS customers (
    id            SERIAL PRIMARY KEY,
    display_name  TEXT    NOT NULL,
    line_user_id  TEXT    UNIQUE,
    picture_url   TEXT    DEFAULT '',
    is_line_friend INTEGER DEFAULT 0,
    phone         TEXT    DEFAULT '',
    note          TEXT    DEFAULT '',
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 8. รายการหนี้
-- ============================================================
CREATE TABLE IF NOT EXISTS debts (
    id                SERIAL PRIMARY KEY,
    customer_id       INTEGER NOT NULL REFERENCES customers(id),
    sale_id           INTEGER REFERENCES sales(id) ON DELETE CASCADE,
    amount            REAL    NOT NULL,
    paid_amount       REAL    DEFAULT 0,
    items_description TEXT    DEFAULT '',
    due_date          TEXT,
    status            TEXT    DEFAULT 'pending',
    auto_remind       INTEGER DEFAULT 1,
    last_reminded_at  TIMESTAMP,
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    paid_at           TIMESTAMP
);

-- ============================================================
-- 9. ประวัติการทวงหนี้
-- ============================================================
CREATE TABLE IF NOT EXISTS debt_reminders (
    id          SERIAL PRIMARY KEY,
    debt_id     INTEGER NOT NULL REFERENCES debts(id),
    type        TEXT    DEFAULT 'auto',
    status      TEXT    DEFAULT 'sent',
    sent_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 10. บันทึกประจำวัน (Manager's Log)
-- ============================================================
CREATE TABLE IF NOT EXISTS daily_notes (
    id         SERIAL PRIMARY KEY,
    date       TEXT    NOT NULL UNIQUE,
    note       TEXT    DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 11. หมวดหมู่รายรับ-รายจ่ายส่วนตัว
-- ============================================================
CREATE TABLE IF NOT EXISTS personal_categories (
    id         SERIAL PRIMARY KEY,
    name       TEXT    NOT NULL,
    type       TEXT    NOT NULL, -- 'income' หรือ 'expense'
    emoji      TEXT    DEFAULT '👛',
    sort_order INTEGER DEFAULT 0
);

-- ============================================================
-- 12. บันทึกรายรับ-รายจ่ายส่วนตัว
-- ============================================================
CREATE TABLE IF NOT EXISTS personal_transactions (
    id          SERIAL PRIMARY KEY,
    category_id INTEGER REFERENCES personal_categories(id) ON DELETE SET NULL,
    type        TEXT    NOT NULL, -- 'income' หรือ 'expense'
    amount      REAL    NOT NULL,
    description TEXT    DEFAULT '',
    date        TEXT    NOT NULL,
    note        TEXT    DEFAULT '',
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

