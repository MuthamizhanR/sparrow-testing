cat > build - engine.js << 'EOF'
const fs = require('fs-extra');
const path = require('path');

class EngineBuilder {
    constructor() {
        this.dataDir = './mcq_engine_data';
        this.engineDir = './psychiatry-mcq-engine';
    }

    async build() {
        console.log('🏗 Building MCQ Engine...');

        await this.cleanEngineDir();
        await this.copyTemplateFiles();
        await this.injectChapterData();
        await this.generateReadme();

        console.log('🎉 MCQ ENGINE BUILT SUCCESSFULLY!');
        console.log('\n📋 NEXT STEPS:');
        console.log('1. cd psychiatry-mcq-engine');
        console.log('2. Open index.html in browser');
        console.log('3. Test all chapters');
        console.log('4. Push to GitHub for hosting');
    }

    async cleanEngineDir() {
        await fs.emptyDir(this.engineDir);
        console.log('✅ Cleared engine directory');
    }

    async copyTemplateFiles() {
        const templateFiles = {
            'index.html': this.getIndexTemplate(),
            'quiz.html': this.getQuizTemplate(),
            'css/style.css': this.getCSSTemplate(),
            'css/quiz.css': this.getQuizCSSTemplate(),
            'js/main.js': this.getMainJSTemplate(),
            'js/quiz.js': this.getQuizJSTemplate()
        };

        for (const [filePath, content] of Object.entries(templateFiles)) {
            const fullPath = path.join(this.engineDir, filePath);
            await fs.ensureDir(path.dirname(fullPath));
            await fs.writeFile(fullPath, content);
            console.log(`✅ Created: ${filePath}`);
        }
    }

    async injectChapterData() {
        const dataDir = path.join(this.engineDir, 'data');
        await fs.ensureDir(dataDir);

        const sourceFiles = await fs.readdir(this.dataDir);
        const chapterFiles = sourceFiles.filter(f => f.startsWith('chapter') && f.endsWith('.json'));

        for (const file of chapterFiles) {
            const sourcePath = path.join(this.dataDir, file);
            const destPath = path.join(dataDir, file);
            await fs.copy(sourcePath, destPath);
            console.log(`✅ Copied: data/${file}`);
        }
    }

    async generateReadme() {
            try {
                const masterIndex = await fs.readJson(path.join(this.dataDir, 'MASTER_INDEX.json'));

                const readme = `# Psychiatry MCQ Engine

## Auto-Generated from ${masterIndex.totalChapters} PDF Files

**Total Chapters:** ${masterIndex.totalChapters}
**Total Questions:** ${masterIndex.totalQuestions}
**Generated:** ${new Date().toLocaleDateString()}

## Chapters Available

${masterIndex.chapters.map(ch => \`- **Chapter \${ch.id}:** \${ch.title} (\${ch.totalQuestions} questions)\`).join('\n')}

## Usage

1. Open \`index.html\` in your web browser
2. Select any chapter to start practicing
3. All questions include detailed explanations

## Features

- 📚 \${masterIndex.totalChapters} Psychiatry Chapters
- ❓ \${masterIndex.totalQuestions} Interactive MCQs
- 📖 Detailed Explanations
- 📊 Progress Tracking
- 🎯 Score Calculation
- 📱 Mobile Responsive

## Host on GitHub Pages

\`\`\`bash
# Push to GitHub
git add .
git commit -m "Add \${masterIndex.totalChapters} psychiatry chapters"
git push origin main

# Enable GitHub Pages in repository settings
\`\`\`
`;

            await fs.writeFile(path.join(this.engineDir, 'README.md'), readme);
            console.log('✅ Generated README.md');
        } catch (error) {
            console.log('⚠️  Could not generate detailed README, creating basic one');
            const basicReadme = `# Psychiatry MCQ Engine\n\nAuto-generated MCQ engine from PDF files. Open index.html to start using.`;
            await fs.writeFile(path.join(this.engineDir, 'README.md'), basicReadme);
        }
    }

    getIndexTemplate() {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Psychiatry MCQ Engine</title>
    <link rel="stylesheet" href="css/style.css">
</head>
<body>
    <div class="container">
        <header>
            <h1>🧠 Psychiatry MCQ Engine</h1>
            <p>Auto-generated from multiple PDF sources - Comprehensive question bank</p>
        </header>
        
        <div class="chapters-grid" id="chaptersContainer">
            <div class="loading">Loading chapters...</div>
        </div>
        
        <footer>
            <p>Built for medical education | Auto-generated system</p>
        </footer>
    </div>
    
    <script src="js/main.js"></script>
</body>
</html>`;
    }

    getQuizTemplate() {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Psychiatry MCQ Quiz</title>
    <link rel="stylesheet" href="css/quiz.css">
</head>
<body>
    <div class="quiz-container">
        <header class="quiz-header">
            <div class="progress-bar">
                <div class="progress-fill" id="progressFill"></div>
            </div>
            <div class="quiz-info">
                <h1 id="chapterTitle">Loading Chapter...</h1>
                <div class="stats">
                    <span id="questionCounter">Question 1 of ?</span>
                    <span id="score">Score: 0%</span>
                    <button id="backBtn" class="back-btn">← Back to Chapters</button>
                </div>
            </div>
        </header>

        <main class="quiz-main">
            <div class="question-card">
                <h2 id="questionText">Loading question...</h2>
                
                <div class="image-container" id="imageContainer" style="display: none;">
                    <img id="questionImage" src="" alt="Question image">
                </div>
                
                <div class="options-container" id="optionsContainer">
                    <!-- Options will be dynamically inserted -->
                </div>

                <div class="navigation">
                    <button id="prevBtn" class="nav-btn">← Previous</button>
                    <button id="nextBtn" class="nav-btn">Next →</button>
                    <button id="submitBtn" class="nav-btn submit-btn">Submit Answer</button>
                </div>
            </div>

            <div class="explanation-card" id="explanationCard" style="display: none;">
                <h3>📖 Explanation</h3>
                <div id="explanationText"></div>
                <div class="explanation-footer">
                    <button id="continueBtn" class="continue-btn">Continue</button>
                </div>
            </div>
        </main>
    </div>

    <script src="js/quiz.js"></script>
</body>
</html>`;
    }

    getCSSTemplate() {
        return `* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    line-height: 1.6;
    color: #333;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
}

.container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
}

header {
    text-align: center;
    margin-bottom: 40px;
    color: white;
}

header h1 {
    font-size: 2.5rem;
    margin-bottom: 10px;
    text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
}

header p {
    font-size: 1.1rem;
    opacity: 0.9;
}

.chapters-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 20px;
    margin-bottom: 40px;
}

.chapter-card {
    background: white;
    border-radius: 10px;
    padding: 25px;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
    transition: transform 0.3s ease, box-shadow 0.3s ease;
    cursor: pointer;
    border-left: 4px solid #4299e1;
}

.chapter-card:hover {
    transform: translateY(-5px);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
}

.chapter-card h3 {
    color: #2d3748;
    margin-bottom: 10px;
    font-size: 1.2rem;
}

.chapter-card p {
    color: #718096;
    margin-bottom: 15px;
    font-size: 0.9rem;
}

.chapter-card .stats {
    font-size: 0.9rem;
    color: #718096;
    margin-bottom: 15px;
    display: flex;
    justify-content: space-between;
}

.start-btn {
    background: #4299e1;
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 5px;
    cursor: pointer;
    font-size: 0.9rem;
    transition: background 0.3s ease;
    width: 100%;
}

.start-btn:hover {
    background: #3182ce;
}

.start-btn:disabled {
    background: #a0aec0;
    cursor: not-allowed;
}

footer {
    text-align: center;
    color: white;
    margin-top: 40px;
    opacity: 0.8;
}

.loading {
    text-align: center;
    color: white;
    font-size: 1.2rem;
    grid-column: 1 / -1;
}`;
    }
    
    getQuizCSSTemplate() {
        return `* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    line-height: 1.6;
    color: #333;
    background: #f7fafc;
    min-height: 100vh;
}

.quiz-container {
    max-width: 800px;
    margin: 0 auto;
    padding: 20px;
    background: white;
    min-height: 100vh;
    box-shadow: 0 0 20px rgba(0,0,0,0.1);
}

.quiz-header {
    margin-bottom: 30px;
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 20px;
}

.progress-bar {
    width: 100%;
    height: 8px;
    background: #e2e8f0;
    border-radius: 4px;
    margin-bottom: 20px;
    overflow: hidden;
}

.progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #4299e1, #667eea);
    width: 0%;
    transition: width 0.3s ease;
    border-radius: 4px;
}

.quiz-info h1 {
    color: #2d3748;
    margin-bottom: 15px;
    font-size: 1.5rem;
}

.stats {
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: #718096;
    font-size: 0.9rem;
    flex-wrap: wrap;
    gap: 10px;
}

.back-btn {
    background: #718096;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 5px;
    cursor: pointer;
    font-size: 0.8rem;
    transition: background 0.3s ease;
}

.back-btn:hover {
    background: #4a5568;
}

.question-card {
    background: #f7fafc;
    padding: 30px;
    border-radius: 10px;
    margin-bottom: 20px;
    border: 1px solid #e2e8f0;
}

#questionText {
    color: #2d3748;
    margin-bottom: 25px;
    font-size: 1.2rem;
    line-height: 1.5;
}

.image-container {
    text-align: center;
    margin-bottom: 20px;
}

#questionImage {
    max-width: 100%;
    height: auto;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

.options-container {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 25px;
}

.option {
    padding: 15px;
    background: white;
    border: 2px solid #e2e8f0;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: flex-start;
}

.option:hover {
    border-color: #4299e1;
    background: #ebf8ff;
    transform: translateX(5px);
}

.option.selected {
    border-color: #4299e1;
    background: #bee3f8;
}

.option.correct {
    border-color: #48bb78;
    background: #c6f6d5;
}

.option.incorrect {
    border-color: #f56565;
    background: #fed7d7;
}

.option-label {
    font-weight: bold;
    margin-right: 10px;
    min-width: 30px;
}

.option-text {
    flex: 1;
}

.navigation {
    display: flex;
    gap: 10px;
    justify-content: space-between;
    flex-wrap: wrap;
}

.nav-btn {
    padding: 12px 24px;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.9rem;
    transition: background 0.2s ease;
    flex: 1;
    min-width: 120px;
}

.nav-btn:not(:disabled) {
    background: #4299e1;
    color: white;
}

.nav-btn:hover:not(:disabled) {
    background: #3182ce;
}

.nav-btn:disabled {
    background: #cbd5e0;
    color: #718096;
    cursor: not-allowed;
}

.submit-btn {
    background: #48bb78 !important;
}

.submit-btn:hover:not(:disabled) {
    background: #38a169 !important;
}

.explanation-card {
    background: #f0fff4;
    padding: 25px;
    border-radius: 10px;
    border-left: 4px solid #48bb78;
    margin-top: 20px;
}

.explanation-card h3 {
    color: #2f855a;
    margin-bottom: 15px;
    display: flex;
    align-items: center;
    gap: 8px;
}

#explanationText {
    line-height: 1.6;
    color: #2d3748;
}

.explanation-footer {
    margin-top: 20px;
    text-align: center;
}

.continue-btn {
    background: #48bb78;
    color: white;
    border: none;
    padding: 12px 30px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 1rem;
    transition: background 0.3s ease;
}

.continue-btn:hover {
    background: #38a169;
}

@media (max-width: 768px) {
    .quiz-container {
        padding: 15px;
    }
    
    .question-card {
        padding: 20px;
    }
    
    .stats {
        flex-direction: column;
        align-items: stretch;
        gap: 10px;
    }
    
    .navigation {
        flex-direction: column;
    }
    
    .nav-btn {
        min-width: auto;
    }
}`;
    }
    
    getMainJSTemplate() {
        return `// Load chapters dynamically
async function loadChapters() {
    const container = document.getElementById('chaptersContainer');
    
    try {
        const response = await fetch('./data/MASTER_INDEX.json');
        const data = await response.json();
        
        container.innerHTML = '';
        
        data.chapters.forEach(chapter => {
            const chapterCard = document.createElement('div');
            chapterCard.className = 'chapter-card';
            chapterCard.innerHTML = \`
                <h3>Chapter \${chapter.id}: \${chapter.title}</h3>
                <p>\${chapter.description}</p>
                <div class="stats">
                    <span>\${chapter.totalQuestions} questions</span>
                    <span>Ready</span>
                </div>
                <button class="start-btn" onclick="startChapter(\${chapter.id})">
                    Start Chapter \${chapter.id}
                </button>
            \`;
            container.appendChild(chapterCard);
        });
        
    } catch (error) {
        console.error('Error loading chapters:', error);
        container.innerHTML = '<div class="loading">Error loading chapters. Please check if data files exist.</div>';
    }
}

function startChapter(chapterId) {
    window.location.href = \`quiz.html?chapter=\${chapterId}\`;
}

// Load chapters when page loads
document.addEventListener('DOMContentLoaded', loadChapters);`;
    }
    
    getQuizJSTemplate() {
        return `class QuizEngine {
    constructor() {
        this.currentQuestion = 0;
        this.score = 0;
        this.userAnswers = [];
        this.questions = [];
        this.chapterData = null;
        
        this.initializeQuiz();
    }
    
    async initializeQuiz() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const chapterId = urlParams.get('chapter') || '1';
            
            const response = await fetch(\`./data/chapter\${chapterId}.json\`);
            this.chapterData = await response.json();
            this.questions = this.chapterData.questions;
            
            document.getElementById('chapterTitle').textContent = 
                \`Chapter \${chapterId}: \${this.chapterData.chapter}\`;
            
            this.displayQuestion();
            this.setupEventListeners();
            
        } catch (error) {
            console.error('Error loading quiz:', error);
            document.getElementById('questionText').textContent = 
                'Error loading quiz. Please check if the chapter data exists.';
        }
    }
    
    displayQuestion() {
        const question = this.questions[this.currentQuestion];
        
        const progress = ((this.currentQuestion + 1) / this.questions.length) * 100;
        document.getElementById('progressFill').style.width = \`\${progress}%\`;
        document.getElementById('questionCounter').textContent = 
            \`Question \${this.currentQuestion + 1} of \${this.questions.length}\`;
        
        document.getElementById('questionText').textContent = question.question;
        
        const imageContainer = document.getElementById('imageContainer');
        if (question.image) {
            document.getElementById('questionImage').src = question.image;
            imageContainer.style.display = 'block';
        } else {
            imageContainer.style.display = 'none';
        }
        
        this.displayOptions(question);
        this.updateNavigation();
        document.getElementById('explanationCard').style.display = 'none';
    }
    
    displayOptions(question) {
        const optionsContainer = document.getElementById('optionsContainer');
        optionsContainer.innerHTML = '';
        
        Object.entries(question.options).forEach(([key, value]) => {
            const optionDiv = document.createElement('div');
            optionDiv.className = 'option';
            optionDiv.innerHTML = \`
                <span class="option-label">\${key.toUpperCase()}</span>
                <span class="option-text">\${value}</span>
            \`;
            optionDiv.addEventListener('click', () => this.selectOption(key));
            optionsContainer.appendChild(optionDiv);
        });
    }
    
    selectOption(selectedKey) {
        document.querySelectorAll('.option').forEach(opt => {
            opt.classList.remove('selected');
        });
        
        event.currentTarget.classList.add('selected');
        this.userAnswers[this.currentQuestion] = selectedKey;
    }
    
    updateNavigation() {
        document.getElementById('prevBtn').disabled = this.currentQuestion === 0;
        
        const hasAnswered = this.userAnswers[this.currentQuestion] !== undefined;
        document.getElementById('submitBtn').style.display = 
            hasAnswered ? 'block' : 'none';
        document.getElementById('nextBtn').style.display = 
            (this.currentQuestion < this.questions.length - 1) && !hasAnswered ? 'block' : 'none';
    }
    
    showExplanation() {
        const question = this.questions[this.currentQuestion];
        const userAnswer = this.userAnswers[this.currentQuestion];
        
        document.querySelectorAll('.option').forEach(opt => {
            const optionKey = opt.querySelector('.option-label').textContent.toLowerCase();
            
            if (optionKey === question.correct) {
                opt.classList.add('correct');
            } else if (optionKey === userAnswer && userAnswer !== question.correct) {
                opt.classList.add('incorrect');
            }
        });
        
        document.getElementById('explanationText').textContent = question.explanation;
        document.getElementById('explanationCard').style.display = 'block';
        
        if (userAnswer === question.correct) {
            this.score++;
        }
        
        const percentage = Math.round((this.score / (this.currentQuestion + 1)) * 100);
        document.getElementById('score').textContent = \`Score: \${percentage}%\`;
        
        document.getElementById('nextBtn').style.display = 
            this.currentQuestion < this.questions.length - 1 ? 'block' : 'none';
        document.getElementById('submitBtn').style.display = 'none';
    }
    
    setupEventListeners() {
        document.getElementById('nextBtn').addEventListener('click', () => {
            this.currentQuestion++;
            this.displayQuestion();
        });
        
        document.getElementById('prevBtn').addEventListener('click', () => {
            this.currentQuestion--;
            this.displayQuestion();
        });
        
        document.getElementById('submitBtn').addEventListener('click', () => {
            this.showExplanation();
        });
        
        document.getElementById('continueBtn').addEventListener('click', () => {
            if (this.currentQuestion < this.questions.length - 1) {
                this.currentQuestion++;
                this.displayQuestion();
            } else {
                alert(\`Quiz completed! Your final score: \${Math.round((this.score / this.questions.length) * 100)}%\`);
                window.location.href = 'index.html';
            }
        });
        
        document.getElementById('backBtn').addEventListener('click', () => {
            window.location.href = 'index.html';
        });
    }
}

// Initialize quiz when page loads
document.addEventListener('DOMContentLoaded', () => {
    new QuizEngine();
});`;
    }
}

// BUILD THE ENGINE
(async () => {
    const builder = new EngineBuilder();
    await builder.build();
})();
EOF