// scripts/extract-images-from-pdf.js
// Script to extract images from PDF catalogs and associate them with products
//
// This script uses pdfjs-dist to extract images from PDF pages
// and saves them to a public directory for use in the frontend
//
// Usage: node scripts/extract-images-from-pdf.js

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CATALOGS_PATH = path.join(__dirname, '../../TI_water/src/assets/catalogs');
const OUTPUT_IMAGES_PATH = path.join(__dirname, '../../TI_water/public/assets/product-images');
const PUBLIC_IMAGES_URL = '/assets/product-images';

// Create output directory if it doesn't exist
if (!fs.existsSync(OUTPUT_IMAGES_PATH)) {
  fs.mkdirSync(OUTPUT_IMAGES_PATH, { recursive: true });
}

/**
 * Extract images from a PDF page
 */
async function extractImagesFromPage(page) {
  const operatorList = await page.getOperatorList();
  const images = [];

  for (let i = 0; i < operatorList.fnArray.length; i++) {
    if (operatorList.fnArray[i] === pdfjsLib.OPS.paintImageXObject) {
      const imageName = operatorList.argsArray[i][0];
      const image = await page.objs.get(imageName);

      if (image) {
        images.push({
          name: imageName,
          data: image.data,
          width: image.width,
          height: image.height,
        });
      }
    }
  }

  return images;
}

/**
 * Save image to file
 */
function saveImage(image, productCode, pageNumber, imageIndex) {
  const sanitizedCode = productCode.replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `${sanitizedCode}_p${pageNumber}_img${imageIndex}.png`;
  const filepath = path.join(OUTPUT_IMAGES_PATH, filename);

  // Convert image data to buffer and save
  fs.writeFileSync(filepath, image.data);
  
  return `${PUBLIC_IMAGES_URL}/${filename}`;
}

/**
 * Process a single PDF file
 */
async function processPDF(pdfPath, productMapping) {
  const pdfName = path.basename(pdfPath);
  console.log(`\n📄 Processing: ${pdfName}`);

  try {
    const data = new Uint8Array(fs.readFileSync(pdfPath));
    const pdf = await pdfjsLib.getDocument({ data }).promise;
    const numPages = pdf.numPages;

    console.log(`   Pages: ${numPages}`);

    const pageImages = {};

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const images = await extractImagesFromPage(page);

      if (images.length > 0) {
        console.log(`   Page ${pageNum}: Found ${images.length} image(s)`);
        pageImages[pageNum] = images;
      }
    }

    // Map images to products based on page numbers
    const productImageMap = {};

    for (const [productCode, productInfo] of Object.entries(productMapping)) {
      const pageNumber = productInfo.pageNumber;
      
      if (pageImages[pageNumber] && pageImages[pageNumber].length > 0) {
        // Use the first image from the page (or you could use a more sophisticated matching)
        const image = pageImages[pageNumber][0];
        const imageUrl = saveImage(image, productCode, pageNumber, 0);
        productImageMap[productCode] = imageUrl;
        console.log(`   ✓ Mapped image for ${productCode} (page ${pageNumber})`);
      }
    }

    return productImageMap;
  } catch (error) {
    console.error(`   ✗ Error processing ${pdfName}:`, error.message);
    return {};
  }
}

/**
 * Get product mapping from database or configuration
 * This is a placeholder - you would query your database here
 */
function getProductMapping() {
  // Example mapping: { productCode: { pageNumber: X, catalogName: '...' } }
  // In production, this should come from the database
  return {
    // Example - replace with actual product codes from your database
    'TW-SUM-001': { pageNumber: 5, catalogName: 'TI WATER EQUIPOS Y ACCESORIOS SUMERGIBLES.pdf' },
    'TW-SUM-002': { pageNumber: 8, catalogName: 'TI WATER EQUIPOS Y ACCESORIOS SUMERGIBLES.pdf' },
    // Add more mappings here
  };
}

/**
 * Main execution
 */
async function main() {
  console.log('🖼️  TI Water PDF Image Extractor');
  console.log('===================================\n');

  // Get all PDF files
  const pdfFiles = fs.readdirSync(CATALOGS_PATH).filter(file => file.endsWith('.pdf'));

  if (pdfFiles.length === 0) {
    console.log('❌ No PDF files found in:', CATALOGS_PATH);
    return;
  }

  console.log(`📚 Found ${pdfFiles.length} PDF file(s):`);
  pdfFiles.forEach(file => console.log(`   - ${file}`));

  // Get product mapping (from database in production)
  const productMapping = getProductMapping();
  console.log(`\n📦 Found ${Object.keys(productMapping).length} product mapping(s)`);

  // Process each PDF
  const allProductImages = {};

  for (const pdfFile of pdfFiles) {
    const pdfPath = path.join(CATALOGS_PATH, pdfFile);
    const images = await processPDF(pdfPath, productMapping);
    Object.assign(allProductImages, images);
  }

  console.log(`\n✅ Extraction complete!`);
  console.log(`   Extracted images for ${Object.keys(allProductImages).length} product(s)`);
  console.log(`   Images saved to: ${OUTPUT_IMAGES_PATH}`);

  // Optionally, update database with image URLs
  console.log('\n📝 Product Image Mapping:');
  console.log(JSON.stringify(allProductImages, null, 2));
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { processPDF, extractImagesFromPage, saveImage };
