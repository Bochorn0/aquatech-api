// scripts/extract-pdf-images-simple.js
// Simplified script using pdf-poppler or pdf-lib for image extraction
//
// Alternative approach: Using canvas to render PDF pages as images
// This is simpler but requires converting entire pages to images

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CATALOGS_PATH = path.join(__dirname, '../../TI_water/src/assets/catalogs');
const OUTPUT_IMAGES_PATH = path.join(__dirname, '../../TI_water/public/assets/product-images');
const PUBLIC_IMAGES_URL = '/assets/product-images';

/**
 * Alternative: Use pdf-lib to extract images
 * Install: npm install pdf-lib
 */
async function extractImagesWithPdfLib(pdfPath) {
  try {
    const { PDFDocument } = await import('pdf-lib');
    const pdfBytes = fs.readFileSync(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    
    // Note: pdf-lib doesn't directly extract images easily
    // This is a placeholder for a different approach
    console.log(`Loaded PDF with ${pdfDoc.getPageCount()} pages`);
    
    return [];
  } catch (error) {
    console.error('Error with pdf-lib:', error);
    return [];
  }
}

/**
 * Extract images using system pdftocairo (more reliable)
 * Uses poppler-utils installed via brew/apt
 */
async function extractImagesWithSystemPoppler(pdfPath, outputDir) {
  try {
    // Check if pdftocairo is available
    let pdftocairoPath = 'pdftocairo';
    
    // Try to find pdftocairo in common locations
    try {
      const { stdout } = await execAsync('which pdftocairo');
      pdftocairoPath = stdout.trim();
    } catch (e) {
      // Fallback to system PATH
      pdftocairoPath = 'pdftocairo';
    }

    const pdfBasename = path.basename(pdfPath, '.pdf');
    const sanitizedBasename = pdfBasename.replace(/[^a-zA-Z0-9]/g, '_');
    const outputPrefix = path.join(outputDir, sanitizedBasename);

    // Use pdftocairo to convert PDF pages to PNG
    // -png: output PNG format
    // -scale-to 1024: scale to max width/height of 1024px (good quality, reasonable size)
    const command = `"${pdftocairoPath}" -png -scale-to 1024 "${pdfPath}" "${outputPrefix}"`;

    await execAsync(command, { maxBuffer: 10 * 1024 * 1024 }); // 10MB buffer
    
    // Get list of generated image files
    const files = fs.readdirSync(outputDir);
    const images = files
      .filter(file => file.startsWith(sanitizedBasename) && file.endsWith('.png'))
      .sort((a, b) => {
        // Sort by page number: prefix-1.png, prefix-2.png, etc.
        const pageA = parseInt(a.match(/-(\d+)\.png$/)?.[1] || '0');
        const pageB = parseInt(b.match(/-(\d+)\.png$/)?.[1] || '0');
        return pageA - pageB;
      });
    
    return images;
  } catch (error) {
    console.error(`   ✗ Error: ${error.message}`);
    return [];
  }
}

/**
 * Alternative: Use pdf-poppler npm package (fallback)
 */
async function extractImagesWithPoppler(pdfPath, outputDir) {
  try {
    const pdf = await import('pdf-poppler');
    
    const options = {
      format: 'png',
      out_dir: outputDir,
      out_prefix: path.basename(pdfPath, '.pdf'),
      page: null, // Extract all pages
    };

    await pdf.convert(pdfPath, options);
    
    // Return list of generated image files
    const images = fs.readdirSync(outputDir)
      .filter(file => file.startsWith(path.basename(pdfPath, '.pdf')))
      .sort();
    
    return images;
  } catch (error) {
    console.error(`   ✗ Error with pdf-poppler: ${error.message}`);
    return [];
  }
}

/**
 * Map extracted images to products based on page numbers
 */
function mapImagesToProducts(images, productMapping, pdfName) {
  const productImageMap = {};
  
  for (const [productCode, productInfo] of Object.entries(productMapping)) {
    if (productInfo.catalogName === pdfName) {
      const pageNumber = productInfo.pageNumber;
      const imageIndex = pageNumber - 1; // 0-based index
      
      if (images[imageIndex]) {
        const imageUrl = `${PUBLIC_IMAGES_URL}/${images[imageIndex]}`;
        productImageMap[productCode] = [imageUrl];
        console.log(`   ✓ Mapped ${images[imageIndex]} to ${productCode} (page ${pageNumber})`);
      }
    }
  }
  
  return productImageMap;
}

/**
 * Main execution
 * 
 * This script extracts ALL pages from PDFs as images.
 * You can run it locally and then upload the images to the server.
 * 
 * Workflow:
 * 1. Run this script locally: npm run extract:pdf:images
 * 2. Upload TI_water/public/assets/product-images/ to your server
 * 3. Run SQL script on server to update database URLs: npm run update:product:images
 */
async function main() {
  console.log('🖼️  TI Water PDF Image Extractor');
  console.log('==================================\n');
  console.log('📌 This script extracts ALL pages from PDFs as images');
  console.log('   You can run it locally and upload images to server later\n');

  // Create output directory
  if (!fs.existsSync(OUTPUT_IMAGES_PATH)) {
    fs.mkdirSync(OUTPUT_IMAGES_PATH, { recursive: true });
    console.log(`✓ Created output directory: ${OUTPUT_IMAGES_PATH}\n`);
  }

  const pdfFiles = fs.readdirSync(CATALOGS_PATH).filter(file => file.endsWith('.pdf'));

  if (pdfFiles.length === 0) {
    console.log('❌ No PDF files found in:', CATALOGS_PATH);
    return;
  }

  console.log(`📚 Found ${pdfFiles.length} PDF file(s):`);
  pdfFiles.forEach(file => console.log(`   - ${file}`));
  console.log('');

  let totalPages = 0;
  const extractedFiles = [];

  // Try system pdftocairo first (most reliable)
  try {
    // Check if pdftocairo is available
    try {
      await execAsync('which pdftocairo');
      console.log('✓ Using system pdftocairo\n');
    } catch (e) {
      console.log('⚠️  pdftocairo not found in PATH, trying pdf-poppler package...\n');
    }

    for (const pdfFile of pdfFiles) {
      const pdfPath = path.join(CATALOGS_PATH, pdfFile);
      console.log(`📄 Processing: ${pdfFile}`);
      
      // Try system poppler first, fallback to pdf-poppler package
      let images = await extractImagesWithSystemPoppler(pdfPath, OUTPUT_IMAGES_PATH);
      
      if (images.length === 0) {
        console.log('   ⚠️  System poppler failed, trying pdf-poppler package...');
        images = await extractImagesWithPoppler(pdfPath, OUTPUT_IMAGES_PATH);
      }
      
      if (images.length > 0) {
        totalPages += images.length;
        extractedFiles.push(...images);
        console.log(`   ✓ Extracted ${images.length} page(s)`);
      } else {
        console.log(`   ✗ Failed to extract images from this PDF`);
      }
    }

    console.log(`\n✅ Extraction complete!`);
    console.log(`   Total pages extracted: ${totalPages}`);
    console.log(`   Images saved to: ${OUTPUT_IMAGES_PATH}`);
    console.log(`\n📦 Next steps:`);
    console.log(`   1. Upload the folder '${OUTPUT_IMAGES_PATH}' to your server`);
    console.log(`   2. Run on server: npm run update:product:images`);
    console.log(`      (This will update the database with image URLs)`);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.log('\n💡 Tip: Install poppler-utils first:');
    console.log('   macOS: brew install poppler');
    console.log('   Linux: sudo apt-get install poppler-utils');
    console.log('   Windows: Download from https://github.com/oschwartz10612/poppler-windows');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
