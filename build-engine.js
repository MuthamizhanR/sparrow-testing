const fs = require('fs-extra');
const path = require('path');

// CONFIGURATION
const INPUT_FILE = './extracted_data/questions.json';
const OUTPUT_DIR = './mcq_engine_data';

async function buildEngine() {
    console.log("🏗️  Building Smart MCQ Engine (Split Mode)...");

    if (!fs.existsSync(INPUT_FILE)) {
        console.log("❌ Error: 'questions.json' missing.");
        return;
    }

    const questions = await fs.readJson(INPUT_FILE);
    await fs.ensureDir(OUTPUT_DIR);

    // 1. SAVE THE DATA SEPARATELY (This fixes the crash)
    console.log(`📦 Saving ${questions.length} questions to data.json...`);
    await fs.writeJson(path.join(OUTPUT_DIR, 'data.json'), questions);

    // 2. CREATE THE LIGHTWEIGHT HTML
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MedTrix: Psychiatry Bank</title>
    <style>
        :root { --primary: #2563eb; --bg: #f3f4f6; --card: #ffffff; --text: #1f2937; }
        body { font-family: -apple-system, system-ui, sans-serif; background: var(--bg); color: var(--text); margin: 0; padding: 20px; }
        .container { max-width: 800px; margin: 0 auto; }
        
        header { text-align: center; margin-bottom: 30px; }
        h1 { color: var(--primary); margin-bottom: 10px; }
        .stats { font-size: 0.9em; color: #666; margin-bottom: 20px; }
        #search-box { width: 100%; padding: 15px; border: 2px solid #ddd; border-radius: 8px; font-size: 16px; box-sizing: border-box; }
        
        .pagination { display: flex; justify-content: space-between; margin: 20px 0; align-items: center; background: white; padding: 10px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .btn { background: var(--primary); color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-weight: bold; }
        .btn:disabled { background: #ccc; cursor: not-allowed; }
        
        .card { background: var(--card); padding: 20px; border-radius: 12px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); margin-bottom: 20px; }
        .q-header { font-weight: 700; font-size: 1.1em; margin-bottom: 15px; line-height: 1.5; }
        .q-meta { font-size: 0.8em; color: #999; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
        
        .option { padding: 12px 15px; margin: 8px 0; border: 1px solid #e5e7eb; border-radius: 6px; cursor: pointer; display: flex; align-items: center; }
        .option:hover { background: #f9fafb; border-color: #d1d5db; }
        .option-key { font-weight: bold; margin-right: 10px; width: 25px; text-transform: uppercase; color: #6b7280; }
        
        .correct { background-color: #dcfce7 !important; border-color: #86efac !important; color: #166534; }
        .wrong { background-color: #fee2e2 !important; border-color: #fca5a5 !important; color: #991b1b; }

        /* Loading Spinner */
        #loader { text-align: center; padding: 50px; font-size: 1.2em; color: #666; }
    </style>
</head>
<body>

<div class="container">
    <header>
        <h1>MedTrix Psychiatry Engine</h1>
        <div class="stats" id="status-text">Connecting to database...</div>
        <input type="text" id="search-box" placeholder="Wait for data..." disabled>
    </header>

    <div class="pagination">
        <button class="btn" id="prev-btn" onclick="changePage(-1)" disabled>← Prev</button>
        <span id="page-info">Page 1</span>
        <button class="btn" id="next-btn" onclick="changePage(1)" disabled>Next →</button>
    </div>

    <div id="quiz-container">
        <div id="loader">⏳ Downloading Question Bank...</div>
    </div>

    <div class="pagination">
        <button class="btn" onclick="changePage(-1)">← Prev</button>
        <button class="btn" onclick="scrollToTop()">Top</button>
        <button class="btn" onclick="changePage(1)">Next →</button>
    </div>
</div>

<script>
    let allQuestions = [];
    let currentPage = 1;
    const itemsPerPage = 50;
    let filteredQuestions = [];

    const container = document.getElementById('quiz-container');
    const searchBox = document.getElementById('search-box');
    const pageInfo = document.getElementById('page-info');
    const statusText = document.getElementById('status-text');

    // 1. FETCH DATA (The Safe Way)
    fetch('data.json')
        .then(response => {
            statusText.innerText = 'Parsing Data...';
            return response.json();
        })
        .then(data => {
            allQuestions = data;
            filteredQuestions = [...allQuestions];
            statusText.innerText = 'Loaded ' + allQuestions.length.toLocaleString() + ' Questions';
            
            // Enable UI
            searchBox.disabled = false;
            searchBox.placeholder = "🔍 Search keywords (e.g., 'schizo')...";
            renderPage();
        })
        .catch(err => {
            container.innerHTML = '<div style="color:red; text-align:center; padding:20px;">❌ Error loading questions.<br>Make sure data.json is in the same folder as this file.</div>';
            console.error(err);
        });

    // 2. SEARCH
    searchBox.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        if (term.length < 2) {
            filteredQuestions = [...allQuestions];
        } else {
            filteredQuestions = allQuestions.filter(q => 
                q.question.toLowerCase().includes(term) || 
                JSON.stringify(q.options).toLowerCase().includes(term)
            );
        }
        currentPage = 1;
        renderPage();
    });

    // 3. RENDER
    function renderPage() {
        container.innerHTML = '';
        const start = (currentPage - 1) * itemsPerPage;
        const end = start + itemsPerPage;
        const pageData = filteredQuestions.slice(start, end);

        if (pageData.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:40px;">No matches found.</div>';
            return;
        }

        pageData.forEach(q => {
            const card = document.createElement('div');
            card.className = 'card';
            
            const meta = document.createElement('div');
            meta.className = 'q-meta';
            meta.innerText = '#' + q.id + ' • ' + q.source_file;
            card.appendChild(meta);

            const qTitle = document.createElement('div');
            qTitle.className = 'q-header';
            qTitle.innerText = q.question;
            card.appendChild(qTitle);

            Object.entries(q.options).forEach(([key, val]) => {
                const opt = document.createElement('div');
                opt.className = 'option';
                opt.innerHTML = '<span class="option-key">' + key + '</span> ' + val;
                opt.onclick = function() {
                    Array.from(card.querySelectorAll('.option')).forEach(o => o.classList.remove('correct', 'wrong'));
                    this.classList.add('correct'); 
                };
                card.appendChild(opt);
            });
            container.appendChild(card);
        });

        const totalPages = Math.ceil(filteredQuestions.length / itemsPerPage);
        pageInfo.innerText = 'Page ' + currentPage + ' of ' + totalPages;
        document.getElementById('prev-btn').disabled = currentPage === 1;
        document.getElementById('next-btn').disabled = currentPage === totalPages;
    }

    function changePage(dir) {
        if (dir === -1 && currentPage === 1) return;
        currentPage += dir;
        renderPage();
        scrollToTop();
    }

    function scrollToTop() {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
</script>
</body>
</html>`;

    await fs.writeFile(path.join(OUTPUT_DIR, 'index.html'), htmlContent);
    console.log("===========================================");
    console.log("🎉 SPLIT BUILD COMPLETE!");
    console.log("📂 Created: index.html AND data.json");
    console.log("===========================================");
}

buildEngine();
