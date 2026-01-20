// scripts/update-product-images.js
// Script to update product images in the database based on extracted PDF images
//
// This script maps images to products based on catalog_source and page_number
// It updates the 'images' JSONB column with the correct image URLs
//
// Usage: node scripts/update-product-images.js

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../src/config/postgres-tiwater.config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const IMAGES_PATH = path.join(__dirname, '../../TI_water/public/assets/product-images');
const PUBLIC_IMAGES_URL = '/assets/product-images';

/**
 * Map catalog source filename to image filename pattern
 */
function mapCatalogToImagePattern(catalogSource) {
  if (!catalogSource) return null;
  
  // Remove .pdf extension and sanitize
  const baseName = catalogSource.replace(/\.pdf$/i, '');
  // Replace spaces and special chars with underscores
  const sanitized = baseName.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').toUpperCase();
  
  return sanitized;
}

/**
 * Get all image files from the images directory
 */
function getAllImageFiles() {
  if (!fs.existsSync(IMAGES_PATH)) {
    console.log(`❌ Images directory not found: ${IMAGES_PATH}`);
    return [];
  }

  const files = fs.readdirSync(IMAGES_PATH).filter(file => file.endsWith('.png'));
  return files;
}

/**
 * Find image file for a given catalog source and page number
 */
function findImageForProduct(catalogSource, pageNumber, allImages) {
  if (!catalogSource || !pageNumber) return null;

  const pattern = mapCatalogToImagePattern(catalogSource);
  if (!pattern) return null;

  // Images are named as: PATTERN-001.png, PATTERN-002.png, etc.
  // Page numbers might be 1-indexed, so we need to match: pattern-001 for page 1
  const pageStr = String(pageNumber).padStart(3, '0');
  const imageName = `${pattern}-${pageStr}.png`;

  if (allImages.includes(imageName)) {
    return `${PUBLIC_IMAGES_URL}/${imageName}`;
  }

  return null;
}

/**
 * Update product images in the database
 */
async function updateProductImages() {
  console.log('🖼️  Updating Product Images in Database');
  console.log('========================================\n');

  try {
    // Get all image files
    const allImages = getAllImageFiles();
    console.log(`📁 Found ${allImages.length} image file(s) in ${IMAGES_PATH}\n`);

    if (allImages.length === 0) {
      console.log('⚠️  No images found. Make sure you ran the extraction script first.');
      return;
    }

    // Get all products that need image updates
    const productsQuery = `
      SELECT 
        id,
        code,
        name,
        catalog_source,
        page_number,
        images
      FROM tiwater_products
      WHERE catalog_source IS NOT NULL 
        AND page_number IS NOT NULL
      ORDER BY catalog_source, page_number;
    `;

    const productsResult = await pool.query(productsQuery);
    const products = productsResult.rows;

    console.log(`📦 Found ${products.length} product(s) with catalog_source and page_number\n`);

    if (products.length === 0) {
      console.log('⚠️  No products found. Make sure products are imported first.');
      return;
    }

    let updatedCount = 0;
    let notFoundCount = 0;
    const updates = [];

    // Process each product
    for (const product of products) {
      const imageUrl = findImageForProduct(product.catalog_source, product.page_number, allImages);

      if (imageUrl) {
        // Check if image already exists (to avoid unnecessary updates)
        const currentImages = product.images || [];
        if (!currentImages.includes(imageUrl)) {
          updates.push({
            id: product.id,
            code: product.code,
            imageUrl: imageUrl,
          });
        }
      } else {
        notFoundCount++;
        console.log(`   ⚠️  Image not found for: ${product.code} (${product.catalog_source}, page ${product.page_number})`);
      }
    }

    // Perform batch update
    if (updates.length > 0) {
      console.log(`\n🔄 Updating ${updates.length} product(s)...\n`);

      for (const update of updates) {
        const updateQuery = `
          UPDATE tiwater_products
          SET images = jsonb_build_array($1::text),
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $2;
        `;

        await pool.query(updateQuery, [update.imageUrl, update.id]);
        console.log(`   ✓ Updated ${update.code} → ${update.imageUrl}`);
        updatedCount++;
      }
    }

    // Summary
    console.log(`\n✅ Update complete!`);
    console.log(`   Updated: ${updatedCount} product(s)`);
    console.log(`   Images not found: ${notFoundCount} product(s)`);
    console.log(`   Total products checked: ${products.length}`);

    // Show some examples
    if (updatedCount > 0) {
      console.log(`\n📝 Sample updated products:`);
      const sampleQuery = `
        SELECT code, name, catalog_source, page_number, images
        FROM tiwater_products
        WHERE images IS NOT NULL 
          AND images != '[]'::jsonb
        ORDER BY updated_at DESC
        LIMIT 5;
      `;
      const sampleResult = await pool.query(sampleQuery);
      sampleResult.rows.forEach(product => {
        console.log(`   - ${product.code}: ${product.images[0]}`);
      });
    }

  } catch (error) {
    console.error('\n❌ Error updating product images:', error);
    throw error;
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    await updateProductImages();
  } catch (error) {
    if (error.code === '28000' || error.message.includes('does not exist')) {
      console.error('\n❌ Database connection error:');
      console.error('   The database user or database does not exist locally.');
      console.error('\n💡 This script should be run on the server where PostgreSQL is configured.');
      console.error('   Or configure your local .env file with the correct database credentials.\n');
      console.error('   Example .env configuration:');
      console.error('   POSTGRES_TIWATER_HOST=localhost');
      console.error('   POSTGRES_TIWATER_PORT=5432');
      console.error('   POSTGRES_TIWATER_DB=ti_water');
      console.error('   POSTGRES_TIWATER_USER=tiwater_user');
      console.error('   POSTGRES_TIWATER_PASSWORD=your_password\n');
    } else {
      console.error('\n❌ Fatal error:', error.message);
    }
    process.exit(1);
  } finally {
    try {
      await pool.end();
    } catch (e) {
      // Ignore errors when closing pool
    }
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
