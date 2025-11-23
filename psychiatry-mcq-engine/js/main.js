async function loadChapters() {
    try {
        const response = await fetch('./data/MASTER_INDEX.json');
        const data = await response.json();
        const container = document.getElementById('chaptersContainer');
        
        container.innerHTML = '';
        data.chapters.forEach(chapter => {
            const card = document.createElement('div');
            card.className = 'chapter-card';
            card.innerHTML = `
                <h3>Chapter ${chapter.id}: ${chapter.title}</h3>
                <p>${chapter.description}</p>
                <p><strong>${chapter.totalQuestions} questions</strong></p>
                <button class="start-btn" onclick="startChapter(${chapter.id})">
                    Start Chapter ${chapter.id}
                </button>
            `;
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
        const answer = prompt(`Q${i+1}: ${q.question}\n\n${q.options.map((o, j) => `${j+1}. ${o}`).join('\n')}\n\nEnter number:`);
        if (parseInt(answer) - 1 === q.correct) {
            alert('✅ Correct!\n' + q.explanation);
            score++;
        } else {
            alert('❌ Incorrect!\n' + q.explanation);
        }
    });
    alert(`Score: ${score}/${questions.length}`);
}

document.addEventListener('DOMContentLoaded', loadChapters);