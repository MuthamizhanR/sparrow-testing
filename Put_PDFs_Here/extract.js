cat > extract.js << 'EOF'
const fs = require('fs-extra');
const pdf = require('pdf-parse');
const path = require('path');

class PDFExtractor {
    constructor() {
        this.outputDir = './extracted_data';
        this.pdfDir = './pdf_files';
    }

    async init() {
        await fs.ensureDir(this.outputDir);
        console.log('🚀 Starting bulk PDF extraction...');
    }

    async extractAllPDFs() {
        try {
            const files = await fs.readdir(this.pdfDir);
            const pdfFiles = files.filter(f => f.endsWith('.pdf'));

            console.log(`📚 Found ${pdfFiles.length} PDF files`);

            for (const pdfFile of pdfFiles) {
                console.log(`\n🔍 Processing: ${pdfFile}`);
                await this.extractSinglePDF(pdfFile);
            }

            console.log('\n🎉 ALL PDFs PROCESSED SUCCESSFULLY!');
        } catch (error) {
            console.error('❌ Extraction failed:', error);
        }
    }

    async extractSinglePDF(filename) {
        try {
            const dataBuffer = await fs.readFile(path.join(this.pdfDir, filename));
            const data = await pdf(dataBuffer);

            const extractedData = this.parsePDFContent(data.text, filename);

            const outputFile = path.join(this.outputDir,
                `${path.basename(filename, '.pdf')}_extracted.json`);

            await fs.writeJson(outputFile, extractedData, { spaces: 2 });
            console.log(`✅ Saved: ${outputFile}`);

        } catch (error) {
            console.error(`❌ Failed to process ${filename}:`, error);
        }
    }

    parsePDFContent(text, filename) {
        const lines = text.split('\n').filter(line => line.trim());

        const chapters = [];
        let currentChapter = null;
        let currentQuestion = null;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // Detect chapter headers
            if (this.isChapterHeader(line)) {
                if (currentChapter) {
                    chapters.push(currentChapter);
                }
                currentChapter = {
                    title: this.cleanChapterTitle(line),
                    questions: []
                };
                continue;
            }

            // Detect questions
            if (this.isQuestionLine(line)) {
                if (currentQuestion && currentChapter) {
                    currentChapter.questions.push(currentQuestion);
                }
                currentQuestion = {
                    id: currentChapter ? currentChapter.questions.length + 1 : 1,
                    question: this.cleanQuestionText(line),
                    options: {},
                    correct: '',
                    explanation: '',
                    tags: []
                };
                continue;
            }

            // Detect options (a), b), c), d)
            if (this.isOptionLine(line) && currentQuestion) {
                const optionMatch = line.match(/^([a-d])[\)\.]\s*(.*)/i);
                if (optionMatch) {
                    const optionKey = optionMatch[1].toLowerCase();
                    const optionText = optionMatch[2].trim();
                    currentQuestion.options[optionKey] = optionText;
                }
                continue;
            }

            // Detect correct answer
            if (this.isAnswerLine(line) && currentQuestion) {
                const answerMatch = line.match(/[a-d]/i);
                if (answerMatch) {
                    currentQuestion.correct = answerMatch[0].toLowerCase();
                }
                continue;
            }

            // Detect explanation
            if (this.isExplanationLine(line) && currentQuestion) {
                currentQuestion.explanation = line;
                // Also check next lines for continuation of explanation
                let j = i + 1;
                while (j < lines.length && !this.isQuestionLine(lines[j]) &&
                    !this.isChapterHeader(lines[j])) {
                    currentQuestion.explanation += ' ' + lines[j].trim();
                    j++;
                }
                i = j - 1;
            }
        }

        // Push the last chapter and question
        if (currentQuestion && currentChapter) {
            currentChapter.questions.push(currentQuestion);
        }
        if (currentChapter) {
            chapters.push(currentChapter);
        }

        return {
            filename: filename,
            totalChapters: chapters.length,
            totalQuestions: chapters.reduce((sum, ch) => sum + ch.questions.length, 0),
            chapters: chapters,
            rawText: text.substring(0, 1000) + '...'
        };
    }

    isChapterHeader(line) {
        return /^#\s+|^Chapter\s+\d+|^CHAPTER\s+\d+|^[A-Z][A-Z\s]{10,}/.test(line);
    }

    isQuestionLine(line) {
        return /^Question\s*\d+|^Q\.?\s*\d+|^\d+\.\s+[A-Z]/.test(line);
    }

    isOptionLine(line) {
        return /^[a-d][\)\.]\s+/.test(line);
    }

    isAnswerLine(line) {
        return /Answer|Correct|Option.*correct/i.test(line);
    }

    isExplanationLine(line) {
        return /Explanation|Solution|Detailed/i.test(line);
    }

    cleanChapterTitle(title) {
        return title.replace(/^#\s+|^Chapter\s+\d+[:\.]?\s*/i, '').trim();
    }

    cleanQuestionText(question) {
        return question.replace(/^Question\s*\d+[:\.]?\s*/i, '')
            .replace(/^Q\.?\s*\d+[:\.]?\s*/i, '')
            .replace(/^\d+\.\s*/, '')
            .trim();
    }
}

// EXECUTE THE EXTRACTION
(async() => {
    const extractor = new PDFExtractor();
    await extractor.init();
    await extractor.extractAllPDFs();
})();
EOF