const fs = require('fs-extra');
const path = require('path');
const pdf = require('pdf-parse');

// CONFIGURATION
const PDF_DIR = './pdf_files';
const OUTPUT_FILE = './extracted_data/raw_text.json';

async function extractRealData() {
    console.log("🚀 Starting REAL PDF Extraction...");
    
    // 1. Check folders
    await fs.ensureDir(PDF_DIR);
    await fs.ensureDir('./extracted_data');

    // 2. Find PDF files
    let files = [];
    try {
        files = fs.readdirSync(PDF_DIR).filter(file => file.toLowerCase().endsWith('.pdf'));
    } catch (e) {
        console.log("❌ Error reading folder. Make sure 'pdf_files' exists.");
        return;
    }

    if (files.length === 0) {
        console.log("⚠️ No PDFs found! Please upload files to the 'pdf_files' folder.");
        return;
    }

    console.log(`📚 Found ${files.length} PDFs. Extracting text now...`);
    let allTextData = [];

    // 3. Loop through every file and extract text
    for (const file of files) {
        process.stdout.write(`   📄 Processing: ${file} ... `); // Print without newline
        const filePath = path.join(PDF_DIR, file);
        
        try {
            const dataBuffer = fs.readFileSync(filePath);
            const data = await pdf(dataBuffer);
            
            // Basic cleaning: Remove "null" bytes and excessive whitespace
            let cleanText = data.text.replace(/\u0000/g, ''); 
            
            allTextData.push({
                filename: file,
                text: cleanText
            });
            console.log("✅ Done.");
        } catch (err) {
            console.log("❌ Failed!");
            console.error(`      Error: ${err.message}`);
        }
    }

    // 4. Save the REAL data
    await fs.writeJson(OUTPUT_FILE, allTextData, { spaces: 2 });
    console.log("\n===========================================");
    console.log(`🎉 SUCCESS! Extracted text saved to: ${OUTPUT_FILE}`);
    console.log("👉 NEXT STEP: Run 'npm run convert' to turn this text into questions.");
    console.log("===========================================");
}

extractRealData();
