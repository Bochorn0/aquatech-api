// Script to fix codigo_tienda index in MongoDB
// This ensures the index is sparse, allowing multiple null values

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/aquatech_prod';

async function fixIndex() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('puntoventas');

    // Get current indexes
    console.log('\n📋 Current indexes:');
    const indexes = await collection.indexes();
    indexes.forEach(idx => {
      console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)}`);
      if (idx.name.includes('codigo_tienda')) {
        console.log(`    sparse: ${idx.sparse || false}`);
        console.log(`    unique: ${idx.unique || false}`);
      }
    });

    // Check if codigo_tienda index exists and is not sparse
    const codigoTiendaIndex = indexes.find(idx => 
      idx.key && idx.key.codigo_tienda !== undefined
    );

    if (codigoTiendaIndex) {
      console.log('\n🔧 Found codigo_tienda index');
      
      if (!codigoTiendaIndex.sparse) {
        console.log('⚠️  Index is not sparse - this can cause duplicate key errors for null values');
        console.log('🗑️  Dropping existing index...');
        
        try {
          await collection.dropIndex(codigoTiendaIndex.name);
          console.log('✅ Index dropped');
        } catch (error) {
          console.log(`⚠️  Could not drop index: ${error.message}`);
          console.log('   This might be because the index was created by Mongoose');
        }
      } else {
        console.log('✅ Index is already sparse - no action needed');
        await mongoose.disconnect();
        return;
      }
    }

    // Recreate the index as sparse
    console.log('\n🔨 Creating sparse unique index on codigo_tienda...');
    await collection.createIndex(
      { codigo_tienda: 1 },
      { 
        unique: true, 
        sparse: true,
        name: 'codigo_tienda_1'
      }
    );
    console.log('✅ Sparse unique index created successfully');

    // Verify the new index
    console.log('\n📋 Updated indexes:');
    const newIndexes = await collection.indexes();
    newIndexes.forEach(idx => {
      if (idx.key && idx.key.codigo_tienda !== undefined) {
        console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)}`);
        console.log(`    sparse: ${idx.sparse || false}`);
        console.log(`    unique: ${idx.unique || false}`);
      }
    });

    console.log('\n✅ Index fix completed successfully!');
    console.log('   You can now create multiple puntos de venta without codigo_tienda');

  } catch (error) {
    console.error('❌ Error fixing index:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

fixIndex();
