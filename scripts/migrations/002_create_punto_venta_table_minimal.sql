-- Minimal migration: Just create the table
-- If this works, we can add the rest later

CREATE TABLE IF NOT EXISTS puntoventa (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) DEFAULT NULL,
    code VARCHAR(100) UNIQUE NOT NULL,
    codigo_tienda VARCHAR(100) UNIQUE,
    createdAt TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    owner VARCHAR(255) DEFAULT NULL,
    clientId VARCHAR(255) DEFAULT NULL,
    status VARCHAR(50) DEFAULT NULL,
    lat DECIMAL(10, 8) DEFAULT NULL,
    long DECIMAL(11, 8) DEFAULT NULL,
    address TEXT DEFAULT NULL,
    contactId VARCHAR(255) DEFAULT NULL,
    meta JSONB DEFAULT NULL
);

SELECT 'puntoventa table created successfully' AS result;

