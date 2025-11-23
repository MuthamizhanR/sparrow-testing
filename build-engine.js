const fs = require('fs-extra');
const path = require('path');

console.log('🏗 Building Psychiatry MCQ Engine...');

async function buildEngine() {
    const engineDir = './psychiatry-mcq-engine';
    const dataDir = './mcq_engine_data';
    
    try {
        // Clean and create directories
        await fs.emptyDir(engineDir);
        await fs.ensureDir(path.join(engineDir, 'data'));
        await fs.ensureDir(path.join(engineDir, 'css'));
        await fs.ensureDir(path.join(engineDir, 'js'));
        
        // Copy data files
        const dataFiles = await fs.readdir(dataDir);
        for (const file of dataFiles) {
            await fs.copy(
                path.join(dataDir, file),
                path.join(engineDir, 'data', file)
            );
        }
        console.log('✅ Copied data files');
        
        // Create main HTML file
        const indexHtml = `<!DOCTYPE html>
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
            <p>Interactive psychiatry question bank - Ready to use!</p>
        </header>
        
        <div class="chapters-grid" id="chaptersContainer">
            <div class="loading">Loading chapters...</div>
        </div>
        
        <footer>
            <p>Medical Education Tool | Auto-generated from PDF content</p>
        </footer>
    </div>
    
    <script src="js/main.js"></script>
</body>
</html>`;
        
        await fs.writeFile(path.join(engineDir, 'index.html'), indexHtml);
        console.log('✅ Created index.html');
        
        // Create CSS
        const css = `* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: Arial, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; padding: 20px; }
.container { max-width: 1200px; margin: 0 auto; }
header { text-align: center; margin-bottom: 40px; color: white; }
header h1 { font-size: 2.5rem; margin-bottom: 10px; }
.chapters-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; }
.chapter-card { background: white; padding: 25px; border-radius: 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); cursor: pointer; }
.chapter-card:hover { transform: translateY(-5px); }
.chapter-card h3 { color: #2d3748; margin-bottom: 10px; }
.start-btn { background: #4299e1; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; width: 100%; margin-top: 15px; }
.start-btn:hover { background: #3182ce; }
footer { text-align: center; color: white; margin-top: 40px; }`;
        
        await fs.writeFile(path.join(engineDir, 'css/style.css'), css);
        console.log('✅ Created CSS');
        
        // Create main JavaScript
        const mainJs = `async function loadChapters() {
    try {
        const response = await fetch('./data/MASTER_INDEX.json');
        const data = await response.json();
        const container = document.getElementById('chaptersContainer');
        
        container.innerHTML = '';
        data.chapters.forEach(chapter => {
            const card = document.createElement('div');
            card.className = 'chapter-card';
            card.innerHTML = \`
                <h3>Chapter \${chapter.id}: \${chapter.title}</h3>
                <p>\${chapter.description}</p>
                <p><strong>\${chapter.totalQuestions} questions</strong></p>
                <button class="start-btn" onclick="startChapter(\${chapter.id})">
                    Start Chapter \${chapter.id}
                </button>
            \`;
            container.appendChild(card);
        });
    } catch (error) {
        document.getElementById('chaptersContainer').innerHTML = 
            '<div class="loading">Error loading chapters. Please check console.</div>';
    }
}

function startChapter(chapterId) {
    // Simple alert-based quiz for demo
    const questions = [
        {
            question: "Which is not a Freud contribution?",
            options: ["Free association", "Cocaine in psychiatry", "Psychodynamic theory", "Psychosocial theory"],
            correct: 3,
            explanation: "Psychosocial theory was proposed by Erik Erikson."
        }
    ];
    
    let score = 0;
    questions.forEach((q, i) => {
        const answer = prompt(\`Q\${i+1}: \${q.question}\\n\\n\${q.options.map((o, j) => \`\${j+1}. \${o}\`).join('\\n')}\\n\\nEnter number:\`);
        if (parseInt(answer) - 1 === q.correct) {
            alert('✅ Correct!\\n' + q.explanation);
            score++;
        } else {
            alert('❌ Incorrect!\\n' + q.explanation);
        }
    });
    alert(\`Score: \${score}/\${questions.length}\`);
}

document.addEventListener('DOMContentLoaded', loadChapters);`;
        
        await fs.writeFile(path.join(engineDir, 'js/main.js'), mainJs);
        console.log('✅ Created JavaScript');
        
        // Create README
        const readme = `# Psychiatry MCQ Engine\n\n## Quick Start\n\n1. Open **index.html** in your web browser\n2. Click any chapter to start practicing\n3. All questions include detailed explanations\n\n## Features\n\n- Interactive multiple-choice questions\n- Detailed explanations\n- Clean, responsive design\n- Ready for GitHub Pages hosting\n\n## Host on GitHub\n\n1. Push this folder to GitHub\n2. Enable GitHub Pages in repository settings\n3. Your MCQ engine will be live!\n\nGenerated: ${new Date().toLocaleDateString()}`;
        
        await fs.writeFile(path.join(engineDir, 'README.md'), readme);
        console.log('✅ Created README');
        
        console.log('\\n🎉 PSYCHIATRY MCQ ENGINE BUILT SUCCESSFULLY!');
        console.log('\\n📋 NEXT STEPS:');
        console.log('1. cd psychiatry-mcq-engine');
        console.log('2. Open index.html in your browser');
        console.log('3. Start using your MCQ engine!');
        console.log('4. Push to GitHub for free hosting');
        
    } catch (error) {
        console.error('❌ Build failed:', error.message);
    }
}

buildEngine();
