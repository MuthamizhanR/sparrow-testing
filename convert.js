const fs = require('fs-extra');

// CONFIGURATION
const INPUT_FILE = './extracted_data/raw_text.json';
const OUTPUT_FILE = './extracted_data/questions.json';

// REGEX PATTERNS (The "Brain" that finds questions)
// Looks for: "1." or "Q1." followed by text
const QUESTION_BLOCK_REGEX = /(?:^|\n)(?:Q|Question)?\s*(\d+)[\.:]\s*(.*?)(?=\n(?:Q|Question)?\s*\d+[\.:]|$)/gs;
// Looks for: "a)" or "a." followed by text
const OPTION_REGEX = /(?:^|\n)\s*([a-d])[\)\.]\s*(.*?)(?=\n\s*[a-d][\)\.]|\n|$)/gi;

async function convertToQuestions() {
    console.log("⚙️  Starting Conversion (Text -> JSON)...");
    
    // 1. Check if extraction was done
    if (!fs.existsSync(INPUT_FILE)) {
        console.log("❌ Error: 'raw_text.json' not found. Run 'npm run extract' first!");
        return;
    }

    const rawData = await fs.readJson(INPUT_FILE);
    let allQuestions = [];
    let globalId = 1;

    console.log(`Processing ${rawData.length} file(s)...`);

    // 2. Loop through each file's text
    rawData.forEach(doc => {
        let text = doc.text;
        let match;
        let countInFile = 0;

        // Find matches using the Question Regex
        while ((match = QUESTION_BLOCK_REGEX.exec(text)) !== null) {
            let fullBlock = match[2].trim();
            let options = {};
            
            // Extract options from within the question block
            let optMatch;
            while ((optMatch = OPTION_REGEX.exec(fullBlock)) !== null) {
                // Key: 'a', Val: 'The option text'
                options[optMatch[1].toLowerCase()] = optMatch[2].trim();
            }

            // Remove the options from the main question text to clean it up
            let cleanQuestionText = fullBlock.replace(OPTION_REGEX, '').trim();

            // Only save if we found options (otherwise it might just be a random sentence)
            if (Object.keys(options).length >= 2) {
                allQuestions.push({
                    id: globalId++,
                    source_file: doc.filename,
                    question: cleanQuestionText,
                    options: options,
                    // Default answer is 'a' because parsing answer keys is very hard without AI
                    // You can manually fix answers later or use the "AI Colab" method for better accuracy
                    correct: "a" 
                });
                countInFile++;
            }
        }
        console.log(`   found ${countInFile} questions in ${doc.filename}`);
    });

    // 3. Save the structured data
    await fs.writeJson(OUTPUT_FILE, allQuestions, { spaces: 2 });
    console.log("\n===========================================");
    console.log(`🎉 CONVERSION COMPLETE!`);
    console.log(`📊 Total Questions Found: ${allQuestions.length}`);
    console.log(`💾 Saved to: ${OUTPUT_FILE}`);
    console.log("👉 NEXT STEP: Run 'npm run build' to see your website!");
    console.log("===========================================");
}

convertToQuestions();
