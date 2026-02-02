#!/usr/bin/env node
/**
 * Sync Clients from MongoDB to PostgreSQL
 * 
 * This script syncs client data from MongoDB to PostgreSQL.
 * It helps maintain consistency between the two databases for dashboard v2.
 * 
 * Usage:
 *   node scripts/sync-clients-mongo-to-postgres.js
 * 
 * Options:
 *   --dry-run    Show what would be synced without making changes
 *   --force      Overwrite existing PostgreSQL clients with MongoDB data
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

// Import models
import Client from '../src/models/client.model.js';
import ClientModel from '../src/models/postgres/client.model.js';

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isForce = args.includes('--force');

async function syncClients() {
  try {
    console.log('🔄 Starting client sync from MongoDB to PostgreSQL...\n');
    
    if (isDryRun) {
      console.log('⚠️  DRY RUN MODE - No changes will be made\n');
    }

    // Connect to MongoDB
    console.log('📦 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/tiwater');
    console.log('✅ Connected to MongoDB\n');

    // Fetch all clients from MongoDB
    console.log('📥 Fetching clients from MongoDB...');
    const mongoClients = await Client.find({});
    console.log(`✅ Found ${mongoClients.length} clients in MongoDB\n`);

    if (mongoClients.length === 0) {
      console.log('⚠️  No clients found in MongoDB. Nothing to sync.');
      return;
    }

    // Process each client
    let created = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const mongoClient of mongoClients) {
      try {
        console.log(`\n📋 Processing: ${mongoClient.name} (${mongoClient.email})`);

        // Check if client exists in PostgreSQL by email
        const existingClient = await ClientModel.findByEmail(mongoClient.email);

        if (existingClient) {
          if (isForce) {
            // Update existing client
            if (!isDryRun) {
              await ClientModel.update(existingClient.id, {
                name: mongoClient.name,
                email: mongoClient.email,
                phone: mongoClient.phone,
                protected: mongoClient.protected,
                address: mongoClient.address,
              });
            }
            console.log(`   ✅ Updated (PostgreSQL ID: ${existingClient.id})`);
            updated++;
          } else {
            console.log(`   ⏭️  Skipped (already exists, use --force to update)`);
            skipped++;
          }
        } else {
          // Create new client
          if (!isDryRun) {
            const newClient = await ClientModel.create({
              name: mongoClient.name,
              email: mongoClient.email,
              phone: mongoClient.phone,
              protected: mongoClient.protected,
              address: mongoClient.address,
            });
            console.log(`   ✅ Created (PostgreSQL ID: ${newClient.id})`);
          } else {
            console.log(`   ✅ Would create new client`);
          }
          created++;
        }
      } catch (error) {
        console.error(`   ❌ Error processing ${mongoClient.name}:`, error.message);
        errors++;
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 SYNC SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total MongoDB clients: ${mongoClients.length}`);
    console.log(`Created:               ${created}`);
    console.log(`Updated:               ${updated}`);
    console.log(`Skipped:               ${skipped}`);
    console.log(`Errors:                ${errors}`);
    console.log('='.repeat(60));

    if (isDryRun) {
      console.log('\n⚠️  This was a dry run. Run without --dry-run to apply changes.');
    } else {
      console.log('\n✅ Sync completed successfully!');
    }

    console.log('\n💡 Next steps:');
    console.log('   1. Go to the Users management page');
    console.log('   2. Edit each user and assign their PostgreSQL client');
    console.log('   3. Users will now see filtered data in Dashboard V2\n');

  } catch (error) {
    console.error('❌ Fatal error during sync:', error);
    process.exit(1);
  } finally {
    // Close MongoDB connection
    await mongoose.connection.close();
    console.log('👋 MongoDB connection closed');
  }
}

// Run the sync
syncClients()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
  });
