cat > convert.js << 'EOF'
const fs = require('fs-extra');
const path = require('path');

class BulkConverter {
    constructor() {
        this.extractedDir = './extracted_data';
        this.outputDir = './mcq_engine_data';
        this.finalData = [];
    }

    async init() {
        await fs.ensureDir(this.outputDir);
        console.log('🔄 Starting bulk conversion...');
    }

    async convertAll() {
        try {
            const files = await fs.readdir(this.extractedDir);
            const jsonFiles = files.filter(f => f.endsWith('_extracted.json'));

            console.log(`📁 Found ${jsonFiles.length} extracted files`);

            for (const file of jsonFiles) {
                console.log(`\n🛠 Converting: ${file}`);
                await this.convertSingleFile(file);
            }

            await this.generateMasterIndex();
            console.log('\n🎉 BULK CONVERSION COMPLETE!');

        } catch (error) {
            console.error('❌ Conversion failed:', error);
        }
    }

    async convertSingleFile(filename) {
        try {
            const data = await fs.readJson(path.join(this.extractedDir, filename));

            let chapterId = 1;
            for (const chapter of data.chapters) {
                const mcqData = this.convertChapter(chapter, chapterId, filename);

                if (mcqData.questions.length > 0) {
                    const outputFile = path.join(this.outputDir, `chapter${chapterId}.json`);
                    await fs.writeJson(outputFile, mcqData, { spaces: 2 });

                    this.finalData.push({
                        id: chapterId,
                        title: mcqData.chapter,
                        description: mcqData.description,
                        totalQuestions: mcqData.questions.length,
                        source: filename,
                        link: `quiz.html?chapter=${chapterId}`
                    });

                    console.log(`✅ Chapter ${chapterId}: ${mcqData.questions.length} questions`);
                    chapterId++;
                }
            }

        } catch (error) {
            console.error(`❌ Failed to convert ${filename}:`, error);
        }
    }

    convertChapter(chapter, chapterId, filename) {
        return {
            chapter: chapter.title || `Chapter ${chapterId}`,
            description: this.generateDescription(chapter.title),
            totalQuestions: chapter.questions.length,
            questions: chapter.questions.map((q, index) => ({
                id: index + 1,
                question: q.question,
                options: q.options,
                correct: q.correct || this.guessCorrectAnswer(q.options),
                explanation: q.explanation || 'Explanation not extracted',
                image: null,
                tags: this.generateTags(q.question, chapter.title)
            })).filter(q => q.question && Object.keys(q.options).length >= 4)
        };
    }

    guessCorrectAnswer(options) {
        return Object.keys(options)[0] || 'a';
    }

    generateDescription(title) {
        const descriptors = [
            'Comprehensive questions and explanations',
            'Detailed MCQs with answer explanations',
            'Practice questions with detailed solutions',
            'MCQ bank with comprehensive coverage',
            'Question bank with explanatory answers'
        ];
        return descriptors[Math.floor(Math.random() * descriptors.length)];
    }

    generateTags(question, chapterTitle) {
        const tags = [];

        if (chapterTitle) {
            tags.push(chapterTitle.toLowerCase().split(' ')[0]);
        }

        const commonTerms = ['diagnosis', 'treatment', 'symptoms', 'management', 'etiology'];
        commonTerms.forEach(term => {
            if (question.toLowerCase().includes(term)) {
                tags.push(term);
            }
        });

        return tags.slice(0, 3);
    }

    async generateMasterIndex() {
        const masterData = {
            generatedAt: new Date().toISOString(),
            totalChapters: this.finalData.length,
            totalQuestions: this.finalData.reduce((sum, ch) => sum + ch.totalQuestions, 0),
            chapters: this.finalData
        };

        await fs.writeJson(path.join(this.outputDir, 'MASTER_INDEX.json'), masterData, { spaces: 2 });
        console.log(`📊 Master index created: ${this.finalData.length} chapters, ${masterData.totalQuestions} questions`);
    }
}

// EXECUTE BULK CONVERSION
(async() => {
    const converter = new BulkConverter();
    await converter.init();
    await converter.convertAll();
})();
EOF