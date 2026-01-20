// scripts/extract-products-from-pdf.js
// Script to help extract product information from PDF catalogs
// This script provides a framework for extracting products from PDFs
//
// Note: This is a helper script. You'll need to manually extract data from PDFs
// and format it according to the SQL template structure.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CATALOGS_PATH = path.join(__dirname, '../../TI_water/src/assets/catalogs');
const OUTPUT_SQL_PATH = path.join(__dirname, '../migrations/006_import_tiwater_products_from_pdfs.sql');

// Catalog mapping
const CATALOGS = {
  'TI Water General.pdf': 'general',
  'TI Water PRESURIZADORES.pdf': 'presurizadores',
  'TI Water valvulas y sistemas.pdf': 'valvulas_sistemas',
  'TI WATER EQUIPOS Y ACCESORIOS SUMERGIBLES.pdf': 'sumergibles',
  'TI Water Plomeria.pdf': 'plomeria',
};

/**
 * Extract products from PDF (placeholder - requires PDF parsing library)
 * 
 * To use this, you would need to install a PDF parsing library:
 * npm install pdf-parse pdfjs-dist
 * 
 * However, manual extraction is recommended for better accuracy
 */
function extractProductsFromPDF(pdfPath, category) {
  // TODO: Implement PDF parsing
  // This is a placeholder - you would use pdf-parse or pdfjs-dist here
  
  console.log(`⚠️  PDF parsing not implemented.`);
  console.log(`📝 Please extract products manually from: ${path.basename(pdfPath)}`);
  console.log(`📂 Category: ${category}`);
  
  return [];
}

/**
 * Generate SQL INSERT statements from product data
 */
function generateSQLInsert(products) {
  if (products.length === 0) {
    return '-- No products to import\n';
  }

  let sql = `-- Auto-generated SQL for product import\n`;
  sql += `-- Generated on: ${new Date().toISOString()}\n\n`;
  sql += `BEGIN;\n\n`;
  sql += `INSERT INTO tiwater_products (\n`;
  sql += `  code, name, description, category, price, specifications, catalog_source, page_number, is_active\n`;
  sql += `) VALUES\n`;

  const values = products.map((product, index) => {
    const specs = product.specifications ? JSON.stringify(product.specifications).replace(/'/g, "''") : 'NULL';
    const price = product.price !== null && product.price !== undefined ? product.price : 'NULL';
    
    return `  (
    '${product.code.replace(/'/g, "''")}',
    '${product.name.replace(/'/g, "''")}',
    '${(product.description || '').replace(/'/g, "''")}',
    '${product.category}',
    ${price},
    ${specs === 'NULL' ? 'NULL' : `'${specs}'::jsonb`},
    '${product.catalogSource.replace(/'/g, "''")}',
    ${product.pageNumber || 'NULL'},
    ${product.isActive !== false}
  )`;
  }).join(',\n');

  sql += values;
  sql += `\n\nON CONFLICT (code) DO UPDATE SET\n`;
  sql += `  name = EXCLUDED.name,\n`;
  sql += `  description = EXCLUDED.description,\n`;
  sql += `  category = EXCLUDED.category,\n`;
  sql += `  price = EXCLUDED.price,\n`;
  sql += `  specifications = EXCLUDED.specifications,\n`;
  sql += `  catalog_source = EXCLUDED.catalog_source,\n`;
  sql += `  page_number = EXCLUDED.page_number,\n`;
  sql += `  updated_at = CURRENT_TIMESTAMP;\n\n`;
  sql += `COMMIT;\n`;

  return sql;
}

/**
 * Manual product entry helper
 * Use this function to manually structure product data
 */
function manualProductEntryExample() {
  // Example product structure
  const exampleProducts = [
    {
      code: 'TW-GEN-001',
      name: 'Producto Ejemplo',
      description: 'Descripción del producto',
      category: 'general',
      price: 1000.00,
      specifications: {
        material: 'Acero inoxidable',
        capacidad: '100 litros',
        dimensiones: '50x50x50 cm'
      },
      catalogSource: 'TI Water General.pdf',
      pageNumber: 1,
      isActive: true
    }
  ];

  const sql = generateSQLInsert(exampleProducts);
  return sql;
}

/**
 * Main execution
 */
function main() {
  console.log('🔍 TI Water Product Extraction Helper');
  console.log('=====================================\n');

  console.log('📚 Available catalogs:');
  Object.entries(CATALOGS).forEach(([filename, category]) => {
    const filePath = path.join(CATALOGS_PATH, filename);
    const exists = fs.existsSync(filePath);
    console.log(`  ${exists ? '✅' : '❌'} ${filename} -> ${category}`);
  });

  console.log('\n⚠️  PDF automatic extraction is not implemented.');
  console.log('📝 Please use one of these methods:\n');
  console.log('1. Manual extraction:');
  console.log('   - Open each PDF catalog');
  console.log('   - Extract product information');
  console.log('   - Use the SQL template: 007_import_tiwater_products_template.sql');
  console.log('\n2. Use this script as a helper:');
  console.log('   - Edit manualProductEntryExample() function');
  console.log('   - Add your products in the correct format');
  console.log('   - Run: node scripts/extract-products-from-pdf.js\n');

  // Generate example SQL
  const exampleSQL = manualProductEntryExample();
  console.log('📄 Example SQL output:');
  console.log('----------------------');
  console.log(exampleSQL);

  // Optionally write to file
  // fs.writeFileSync(OUTPUT_SQL_PATH, exampleSQL);
  // console.log(`\n✅ SQL written to: ${OUTPUT_SQL_PATH}`);
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { generateSQLInsert, extractProductsFromPDF, manualProductEntryExample };
