const fs = require('fs-extra');
const path = require('path');
const cheerio = require('cheerio');

// CONFIGURATION
// We will look in the same pdf_files folder, or you can make a new 'html_files' folder
const INPUT_DIR = './pdf_files'; 
const OUTPUT_FILE = './extracted_data/raw_text.json';

async function extractHTML() {
    console.log("🚀 Starting HTML Extraction...");
    
    // 1. Find HTML files
    let files = [];
    try {
        files = fs.readdirSync(INPUT_DIR).filter(f => f.toLowerCase().endsWith('.html'));
    } catch (e) {
        console.log(`❌ Error: Could not read ${INPUT_DIR}`);
        return;
    }

    if (files.length === 0) {
        console.log(`⚠️ No HTML files found in ${INPUT_DIR}`);
        return;
    }

    console.log(`📚 Found ${files.length} HTML files.`);
    let allTextData = [];

    // 2. Loop through files
    for (const file of files) {
        console.log(`   📄 Scraping: ${file} ...`);
        const filePath = path.join(INPUT_DIR, file);
        
        // Read the HTML content
        const htmlContent = fs.readFileSync(filePath, 'utf8');
        
        // Load into Cheerio (like jQuery)
        const $ = cheerio.load(htmlContent);
        
        // SMART CLEANING
        // 1. Remove scripts and styles (we just want text)
        $('script').remove();
        $('style').remove();
        $('nav').remove();
        $('header').remove();
        $('footer').remove();

        // 2. Get the clean text
        // We add newlines between paragraphs so questions don't squish together
        let cleanText = $('body').text().replace(/\n\s*\n/g, '\n'); 

        allTextData.push({
            filename: file,
            text: cleanText
        });
    }

    // 3. Save it exactly like the PDF extractor did
    // This allows the "convert" script to work without changes!
    await fs.writeJson(OUTPUT_FILE, allTextData, { spaces: 2 });
    console.log("\n✅ HTML Extraction Complete!");
    console.log("👉 Now run: npm run convert");
}

extractHTML();
