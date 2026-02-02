# Client Synchronization Guide

## Overview

The Aquatech application uses two databases:
- **MongoDB**: For user authentication, roles, and client relationships
- **PostgreSQL**: For dashboard v2 sensor data, metrics, and punto de venta information

This creates a challenge: users need to be associated with clients in both databases for proper data filtering in dashboard v2.

## Solution Architecture

### Database Structure

#### MongoDB
- **Collection**: `clients`
- **Purpose**: User management and authentication
- **Referenced by**: `users.cliente` field (ObjectId)

#### PostgreSQL
- **Table**: `clients`
- **Purpose**: Dashboard v2 data filtering (sensors, metrics, punto de venta)
- **Referenced by**: `sensores.clientId`, `metrics.clientId`, `punto_ventas.clientId`

### User Model Enhancement

The `User` model now includes two client references:

```javascript
{
  cliente: ObjectId,           // MongoDB client reference (required)
  postgresClientId: String,    // PostgreSQL client ID (optional)
}
```

- **`cliente`**: Used for user management, permissions, and authentication
- **`postgresClientId`**: Used for filtering dashboard v2 data

## Setup Instructions

### Step 1: Sync Clients from MongoDB to PostgreSQL

Run the sync script to copy client data from MongoDB to PostgreSQL:

```bash
# Dry run (preview changes without applying them)
node scripts/sync-clients-mongo-to-postgres.js --dry-run

# Sync clients (create new ones only)
node scripts/sync-clients-mongo-to-postgres.js

# Force sync (update existing clients)
node scripts/sync-clients-mongo-to-postgres.js --force
```

The script will:
1. Connect to both MongoDB and PostgreSQL
2. Fetch all clients from MongoDB
3. Check if each client exists in PostgreSQL (by email)
4. Create new clients or update existing ones (with `--force`)
5. Display a summary of the sync operation

### Step 2: Assign PostgreSQL Clients to Users

1. Navigate to the **Users** management page in the application
2. Edit each user
3. You'll see two client fields:
   - **Cliente (MongoDB)**: The original client assignment (required)
   - **Cliente Dashboard V2 (PostgreSQL)**: The PostgreSQL client for dashboard v2 filtering (optional)
4. Select the appropriate PostgreSQL client for each user
5. Save the user

### Step 3: Verify Dashboard v2 Filtering

1. Log in as a user with an assigned `postgresClientId`
2. Navigate to **Dashboard V2**
3. Verify that only data for the assigned client is displayed
4. Check that the client dropdown is pre-filtered to the user's assigned client

## How It Works

### Frontend (Dashboard V2)

The dashboard v2 (`home-v2.tsx`) uses the following logic:

```typescript
const userCliente = useMemo(() => {
  const user = JSON.parse(localStorage.getItem('user'));
  
  // Prefer postgresClientId for dashboard v2
  if (user.postgresClientId) {
    return { id: user.postgresClientId };
  }
  
  // Fallback to MongoDB cliente
  return user.cliente;
}, []);
```

This ensures:
- Users with `postgresClientId` see only their assigned client's data
- Users without `postgresClientId` fall back to MongoDB cliente (if compatible)
- Admin users can still see all clients if not restricted

### Backend (API)

The login endpoint (`auth.controller.js`) includes `postgresClientId` in the response:

```javascript
const userResponse = {
  ...user._doc,
  postgresClientId: user.postgresClientId || null
};

res.json({ token, user: userResponse });
```

## Maintenance

### Adding New Clients

When adding new clients, you have two options:

#### Option 1: Add to Both Databases Manually
1. Add client to MongoDB via the Clients management page
2. Add the same client to PostgreSQL (same email is important)
3. Run the sync script to verify consistency

#### Option 2: Add to MongoDB, Then Sync
1. Add client to MongoDB via the Clients management page
2. Run the sync script: `node scripts/sync-clients-mongo-to-postgres.js`
3. The script will automatically create the client in PostgreSQL

### Updating Client Information

To update client information (name, email, phone, address):

1. Update in MongoDB via the Clients management page
2. Run sync script with force flag: `node scripts/sync-clients-mongo-to-postgres.js --force`
3. This will update PostgreSQL with the latest MongoDB data

### Checking Sync Status

To see what would be synced without making changes:

```bash
node scripts/sync-clients-mongo-to-postgres.js --dry-run
```

## Troubleshooting

### User Can't See Data in Dashboard V2

**Problem**: User logs in but sees no data in dashboard v2.

**Solutions**:
1. Check if user has `postgresClientId` assigned
2. Verify the PostgreSQL client exists: `SELECT * FROM clients WHERE id = 'user_postgres_client_id';`
3. Verify the client has associated data: `SELECT * FROM sensores WHERE clientId = 'client_id' LIMIT 10;`
4. Check if the user's role has permission to access `/dashboard/v2`

### Client Exists in MongoDB but Not PostgreSQL

**Problem**: Client shows in user management but not in dashboard v2.

**Solutions**:
1. Run the sync script: `node scripts/sync-clients-mongo-to-postgres.js`
2. Check for email conflicts (PostgreSQL requires unique emails)
3. Manually create the client in PostgreSQL if sync fails

### Duplicate Clients

**Problem**: Multiple clients with similar names or emails.

**Solutions**:
1. Consolidate clients in MongoDB first
2. Update user assignments to the correct client
3. Delete duplicate clients from MongoDB
4. Re-run the sync script

### Sync Script Errors

**Problem**: Sync script fails with database connection errors.

**Solutions**:
1. Verify `.env` file has correct database credentials
2. Check MongoDB connection: `MONGODB_URI`
3. Check PostgreSQL connection in `postgres.config.js`
4. Ensure both databases are running and accessible

## API Endpoints

### Get PostgreSQL Clients
```
GET /api/v2.0/clients
```

Returns all clients from PostgreSQL for dashboard v2.

### Get User with PostgreSQL Client
```
POST /api/auth/login
```

Returns user object including `postgresClientId` field.

### Update User
```
PATCH /api/users/:id
```

Accepts `postgresClientId` in the request body to assign PostgreSQL client to user.

## Database Schema

### MongoDB User Schema
```javascript
{
  _id: ObjectId,
  email: String,
  password: String,
  role: ObjectId,
  cliente: ObjectId,              // MongoDB client reference
  postgresClientId: String,       // PostgreSQL client ID
  // ... other fields
}
```

### PostgreSQL Clients Table
```sql
CREATE TABLE clients (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(50),
  protected BOOLEAN DEFAULT FALSE,
  address JSONB,
  createdat TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updatedat TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

## Best Practices

1. **Always sync clients after MongoDB changes**: Run the sync script after adding or updating clients in MongoDB
2. **Use email as the unique identifier**: Both databases use email to match clients
3. **Assign PostgreSQL clients to all dashboard v2 users**: Ensure every user who needs dashboard v2 access has a `postgresClientId`
4. **Test with dry-run first**: Always use `--dry-run` to preview changes before applying them
5. **Keep protected clients in sync**: Protected clients in MongoDB should also be protected in PostgreSQL

## Future Improvements

Potential enhancements to consider:

1. **Automatic sync on client creation**: Trigger sync script automatically when clients are created/updated
2. **Bidirectional sync**: Support syncing from PostgreSQL to MongoDB
3. **Sync monitoring**: Dashboard to show sync status and last sync time
4. **Conflict resolution**: Better handling of email conflicts and duplicate clients
5. **Bulk user assignment**: Tool to automatically assign PostgreSQL clients to users based on MongoDB cliente

## Support

For issues or questions:
1. Check this guide first
2. Review the sync script logs for error details
3. Verify database connections and credentials
4. Contact the development team with specific error messages
