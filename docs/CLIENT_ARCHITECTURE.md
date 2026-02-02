# Client Architecture: MongoDB + PostgreSQL Integration

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              AQUATECH APPLICATION                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                    ┌─────────────────┴─────────────────┐
                    │                                   │
                    ▼                                   ▼
        ┌───────────────────────┐         ┌───────────────────────┐
        │   MongoDB Database    │         │ PostgreSQL Database   │
        │   (User Management)   │         │  (Dashboard V2 Data)  │
        └───────────────────────┘         └───────────────────────┘
                    │                                   │
        ┌───────────┴───────────┐         ┌───────────┴───────────┐
        │                       │         │                       │
        ▼                       ▼         ▼                       ▼
    ┌────────┐           ┌────────┐   ┌────────┐           ┌──────────┐
    │ Users  │           │Clients │   │Clients │           │ Sensores │
    └────────┘           └────────┘   └────────┘           └──────────┘
        │                     ▲            │                     ▲
        │ cliente (ObjectId)  │            │ clientId (BIGINT)   │
        └─────────────────────┘            └─────────────────────┘
        │
        │ postgresClientId (String)
        └──────────────────────────────────┐
                                           │
                                           ▼
                                    ┌────────────┐
                                    │ PostgreSQL │
                                    │  Client ID │
                                    └────────────┘
```

## Data Flow

### 1. User Login Flow

```
┌──────┐     Login      ┌──────────┐     Fetch User     ┌─────────┐
│Client├───────────────▶│  Backend ├───────────────────▶│ MongoDB │
└──────┘                └──────────┘                     └─────────┘
   ▲                          │                               │
   │                          │                               │
   │    JWT + User Data       │         User + cliente +      │
   │  (with postgresClientId) │         postgresClientId      │
   └──────────────────────────┴───────────────────────────────┘
```

### 2. Dashboard V2 Data Filtering

```
┌──────┐   Request Data   ┌──────────┐   Query with      ┌────────────┐
│Client├─────────────────▶│  Backend ├──────────────────▶│ PostgreSQL │
└──────┘                  └──────────┘   clientId filter └────────────┘
   │                            │                               │
   │  localStorage.user         │                               │
   │  .postgresClientId         │         Filtered Sensors      │
   │                            │         & Metrics Data        │
   └────────────────────────────┴───────────────────────────────┘
```

### 3. Client Sync Process

```
┌─────────────┐                                      ┌──────────────┐
│   MongoDB   │                                      │  PostgreSQL  │
│   Clients   │                                      │   Clients    │
└──────┬──────┘                                      └──────▲───────┘
       │                                                    │
       │  1. Fetch all clients                             │
       ├───────────────────────────────────────────────────┤
       │                                                    │
       │  2. For each client:                              │
       │     - Check if exists (by email)                  │
       │     - Create new OR update existing               │
       ├───────────────────────────────────────────────────┤
       │                                                    │
       │  3. Return sync summary                           │
       └────────────────────────────────────────────────────┘
```

## Database Schemas

### MongoDB User Schema

```javascript
{
  _id: ObjectId("507f1f77bcf86cd799439011"),
  email: "user@example.com",
  password: "$2b$10$...",  // hashed
  role: ObjectId("507f191e810c19729de860ea"),
  cliente: ObjectId("507f191e810c19729de860eb"),  // MongoDB Client
  postgresClientId: "123",                         // PostgreSQL Client ID
  nombre: "John Doe",
  puesto: "Manager",
  status: "active",
  verified: true,
  createdAt: ISODate("2024-01-01T00:00:00Z"),
  updatedAt: ISODate("2024-01-01T00:00:00Z")
}
```

### MongoDB Client Schema

```javascript
{
  _id: ObjectId("507f191e810c19729de860eb"),
  name: "Acme Corporation",
  email: "contact@acme.com",
  phone: "+1234567890",
  protected: false,
  address: {
    street: "123 Main St",
    city: "New York",
    state: "NY",
    zip: "10001",
    country: "USA",
    lat: "40.7128",
    lng: "-74.0060"
  },
  createdAt: ISODate("2024-01-01T00:00:00Z"),
  updatedAt: ISODate("2024-01-01T00:00:00Z")
}
```

### PostgreSQL Client Table

```sql
CREATE TABLE clients (
  id BIGSERIAL PRIMARY KEY,              -- 123
  name VARCHAR(255) NOT NULL,            -- "Acme Corporation"
  email VARCHAR(255) UNIQUE NOT NULL,    -- "contact@acme.com"
  phone VARCHAR(50),                     -- "+1234567890"
  protected BOOLEAN DEFAULT FALSE,       -- false
  address JSONB,                         -- {...}
  createdat TIMESTAMPTZ DEFAULT NOW(),
  updatedat TIMESTAMPTZ DEFAULT NOW()
);
```

### PostgreSQL Sensores Table (Excerpt)

```sql
CREATE TABLE sensores (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255),
  value DOUBLE PRECISION,
  type VARCHAR(100),
  timestamp TIMESTAMPTZ,
  clientId BIGINT,                       -- References clients.id
  resourceId VARCHAR(255),
  resourceType VARCHAR(100),
  -- ... other fields
);
```

## User Assignment Scenarios

### Scenario 1: User with Both Clients Assigned

```
User:
  cliente: "507f191e810c19729de860eb" (MongoDB)
  postgresClientId: "123" (PostgreSQL)

Dashboard V1 (MongoDB):
  ✅ Uses cliente for filtering
  ✅ Shows products/metrics for MongoDB client

Dashboard V2 (PostgreSQL):
  ✅ Uses postgresClientId for filtering
  ✅ Shows sensors/punto de venta for PostgreSQL client
```

### Scenario 2: User with Only MongoDB Client

```
User:
  cliente: "507f191e810c19729de860eb" (MongoDB)
  postgresClientId: null

Dashboard V1 (MongoDB):
  ✅ Uses cliente for filtering
  ✅ Shows products/metrics for MongoDB client

Dashboard V2 (PostgreSQL):
  ⚠️  Falls back to cliente (if compatible)
  ⚠️  May show limited or no data
```

### Scenario 3: User with Only PostgreSQL Client

```
User:
  cliente: "507f191e810c19729de860eb" (MongoDB - required)
  postgresClientId: "123" (PostgreSQL)

Dashboard V1 (MongoDB):
  ✅ Uses cliente for filtering
  ✅ Shows products/metrics for MongoDB client

Dashboard V2 (PostgreSQL):
  ✅ Uses postgresClientId for filtering
  ✅ Shows sensors/punto de venta for PostgreSQL client
```

## API Endpoints

### Authentication

```
POST /api/auth/login
Request:
  {
    "email": "user@example.com",
    "password": "password123"
  }

Response:
  {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "_id": "507f1f77bcf86cd799439011",
      "email": "user@example.com",
      "nombre": "John Doe",
      "cliente": {
        "_id": "507f191e810c19729de860eb",
        "name": "Acme Corporation"
      },
      "postgresClientId": "123",  // ← New field
      "role": { ... },
      "status": "active"
    }
  }
```

### Get PostgreSQL Clients

```
GET /api/v2.0/clients
Response:
  [
    {
      "id": "123",
      "_id": "123",  // For compatibility
      "name": "Acme Corporation",
      "email": "contact@acme.com",
      "phone": "+1234567890",
      "protected": false,
      "address": { ... },
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z"
    }
  ]
```

### Update User

```
PATCH /api/users/:id
Request:
  {
    "postgresClientId": "123"  // ← New field
  }

Response:
  {
    "_id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "postgresClientId": "123",
    // ... other fields
  }
```

## Frontend Components

### Users Management Page

```typescript
// Fetch both MongoDB and PostgreSQL clients
const [clients, setClients] = useState<Cliente[]>([]);           // MongoDB
const [postgresClients, setPostgresClients] = useState<Cliente[]>([]);  // PostgreSQL

// User form with both client fields
<FormControl>
  <InputLabel>Cliente (MongoDB)</InputLabel>
  <Select name="cliente" value={userForm.cliente}>
    {clients.map(c => <MenuItem value={c._id}>{c.name}</MenuItem>)}
  </Select>
</FormControl>

<FormControl>
  <InputLabel>Cliente Dashboard V2 (PostgreSQL)</InputLabel>
  <Select name="postgresClientId" value={userForm.postgresClientId}>
    <MenuItem value="">Ninguno</MenuItem>
    {postgresClients.map(c => <MenuItem value={c.id}>{c.name}</MenuItem>)}
  </Select>
</FormControl>
```

### Dashboard V2 Page

```typescript
// Get user's PostgreSQL client ID from localStorage
const userCliente = useMemo(() => {
  const user = JSON.parse(localStorage.getItem('user'));
  
  // Prefer postgresClientId for dashboard v2
  if (user.postgresClientId) {
    return { id: user.postgresClientId };
  }
  
  // Fallback to MongoDB cliente
  return user.cliente;
}, []);

// Filter clients by user's assigned client
useEffect(() => {
  const fetchClients = async () => {
    const response = await getV2('/clients');
    let filtered = response;
    
    if (userCliente?.id) {
      filtered = response.filter(c => 
        String(c.id) === String(userCliente.id)
      );
    }
    
    setClients(filtered);
  };
  fetchClients();
}, [userCliente?.id]);
```

## Security Considerations

### 1. Client Isolation

```
✅ Users can only see data for their assigned PostgreSQL client
✅ Client filtering happens on the backend (not just frontend)
✅ API endpoints validate user's client access
```

### 2. Data Integrity

```
✅ Email is unique in both databases (enforced by unique constraint)
✅ Sync script validates data before creating/updating
✅ Protected clients cannot be deleted
```

### 3. Access Control

```
✅ Users must be authenticated to access dashboard v2
✅ Role permissions control which dashboards users can access
✅ Client assignment is admin-only operation
```

## Performance Optimization

### 1. Caching

```javascript
// Frontend caches user data in localStorage
localStorage.setItem('user', JSON.stringify(user));

// Backend can cache client lookups
const clientCache = new Map();
```

### 2. Indexing

```sql
-- PostgreSQL indexes for fast filtering
CREATE INDEX idx_sensores_clientid ON sensores(clientId);
CREATE INDEX idx_clients_email ON clients(LOWER(email));
```

### 3. Lazy Loading

```typescript
// Dashboard v2 loads data on-demand
useEffect(() => {
  if (selectedClientId) {
    fetchSensors(selectedClientId);
  }
}, [selectedClientId]);
```

## Maintenance Tasks

### Daily
- ✅ Monitor sync script logs
- ✅ Check for failed user logins

### Weekly
- ✅ Run sync script to catch any new clients
- ✅ Verify client data consistency

### Monthly
- ✅ Audit user-client assignments
- ✅ Review protected clients
- ✅ Clean up inactive users

## Future Enhancements

1. **Automatic Sync**: Trigger sync on client creation/update
2. **Bidirectional Sync**: Support PostgreSQL → MongoDB sync
3. **Sync Dashboard**: UI to monitor sync status
4. **Conflict Resolution**: Better handling of email conflicts
5. **Bulk Assignment**: Tool to assign clients to multiple users
6. **Audit Trail**: Log all client assignment changes
7. **Client Mapping**: Allow mapping different clients between databases

## Troubleshooting Guide

### Issue: User sees no data in Dashboard V2

**Diagnosis**:
```bash
# Check user's postgresClientId
mongo tiwater
db.users.findOne({ email: "user@example.com" }, { postgresClientId: 1 })

# Check if PostgreSQL client exists
psql -d tiwater_timeseries
SELECT * FROM clients WHERE id = '123';

# Check if client has data
SELECT COUNT(*) FROM sensores WHERE clientId = '123';
```

**Solution**:
1. Assign postgresClientId to user
2. Run sync script if client missing
3. Verify client has associated sensor data

### Issue: Sync script fails

**Diagnosis**:
```bash
# Check MongoDB connection
mongo --eval "db.adminCommand('ping')"

# Check PostgreSQL connection
psql -d tiwater_timeseries -c "SELECT 1"

# Check for email conflicts
psql -d tiwater_timeseries -c "SELECT email, COUNT(*) FROM clients GROUP BY email HAVING COUNT(*) > 1"
```

**Solution**:
1. Fix database connections
2. Resolve email conflicts
3. Re-run sync script

## Summary

This architecture provides:
- ✅ **Separation of Concerns**: User management (MongoDB) vs. Dashboard data (PostgreSQL)
- ✅ **Flexibility**: Users can have different clients in each database
- ✅ **Backward Compatibility**: Existing functionality remains intact
- ✅ **Easy Maintenance**: One-command sync keeps databases in sync
- ✅ **Scalability**: Works for any number of clients and users
- ✅ **Security**: Proper client isolation and access control
