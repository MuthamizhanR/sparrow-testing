const fs = require('fs-extra');
const path = require('path');

console.log('🚀 PDF to MCQ Converter - Simple Version');
console.log('=========================================\n');

// Check for PDF files
const pdfDir = './pdf_files';
const outputDir = './extracted_data';

async function main() {
    try {
        await fs.ensureDir(pdfDir);
        await fs.ensureDir(outputDir);
        
        const files = await fs.readdir(pdfDir);
        const pdfFiles = files.filter(f => f.endsWith('.pdf'));
        
        if (pdfFiles.length === 0) {
            console.log('❌ No PDF files found in pdf_files directory!');
            console.log('\n📋 INSTRUCTIONS:');
            console.log('1. Copy your PDF files to the pdf_files folder');
            console.log('2. Run: npm run extract');
            console.log('3. Then run: npm run convert');
            console.log('4. Finally run: npm run build');
            return;
        }
        
        console.log(`📚 Found ${pdfFiles.length} PDF files:`);
        pdfFiles.forEach((file, index) => {
            console.log(`   ${index + 1}. ${file}`);
        });
        
        console.log('\n✅ Extraction setup complete!');
        console.log('💡 For now, we will create sample data directly from your content.');
        
        // Create sample extracted data
        const sampleData = {
            filename: "Psychiatry.pdf",
            totalChapters: 1,
            chapters: [
                {
                    title: "Theories of Personality & Defense Mechanisms",
                    questions: [
                        {
                            id: 1,
                            question: "Which of the following is not a contribution by Sigmund Freud?",
                            options: {
                                "a": "Free association",
                                "b": "Introducing cocaine in psychiatry", 
                                "c": "Psychodynamic theory",
                                "d": "Psychosocial theory"
                            },
                            correct: "d",
                            explanation: "Sigmund Freud is credited with all except psychosocial theory (proposed by Erik Erikson)."
                        }
                    ]
                }
            ]
        };
        
        await fs.writeJson(path.join(outputDir, 'sample_extracted.json'), sampleData, { spaces: 2 });
        console.log('✅ Created sample extracted data');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

main();
