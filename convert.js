const fs = require('fs-extra');
const path = require('path');

console.log('🔄 Converting extracted data to MCQ format...');

async function main() {
    try {
        const outputDir = './mcq_engine_data';
        await fs.ensureDir(outputDir);
        
        // Create sample chapter data based on your Psychiatry.pdf content
        const chapters = [
            {
                id: 1,
                title: "Theories of Personality & Defense Mechanisms",
                description: "Freud's theories, defense mechanisms, and personality development",
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
                        explanation: "Sigmund Freud is credited with all the above-mentioned achievements except psychosocial theory (proposed by Erik Erikson). Contributions include: Free association, Interpretation of dreams, Psychoanalysis, Psychosexual development, Psychodynamic theory, Topographic theory, Structural theory of mind, and introducing cocaine in psychiatry.",
                        image: null,
                        tags: ["Freud", "Contributions", "History"]
                    },
                    {
                        id: 2,
                        question: "Which of the following principles is matched correctly with the part of the mind it works on?",
                        options: {
                            "a": "Id- principle of reality, in the conscious domain",
                            "b": "Ego- principle of pleasure, in the unconscious domain",
                            "c": "Super Ego- principle of idealism, both in the conscious and unconscious domain",
                            "d": "Id- defence mechanisms, in the unconscious domain"
                        },
                        correct: "c",
                        explanation: "The superego is based on the principle of idealism, both in the conscious and unconscious domain. It acts to perfect and civilize our behaviour. The id works on pleasure principle (unconscious), ego on reality principle (mostly conscious), and defense mechanisms are primarily handled by the ego.",
                        image: null,
                        tags: ["Structural Theory", "Id-Ego-Superego"]
                    },
                    {
                        id: 3,
                        question: "According to Sigmund Freud, we have a barrier in our mind called repression. This function is done by which of the following part of the mind?",
                        options: {
                            "a": "The conscious part",
                            "b": "The preconscious part",
                            "c": "The unconscious part",
                            "d": "The subconscious part"
                        },
                        correct: "b",
                        explanation: "According to Sigmund Freud, the preconscious part of our mind has a barrier called repression. This barrier separates the contents of the unconscious and the conscious mind. The preconscious contains mental events that can be brought into conscious awareness by focusing attention.",
                        image: null,
                        tags: ["Topographic Theory", "Repression", "Preconscious"]
                    }
                ]
            },
            {
                id: 2,
                title: "Symptoms and Clinical Manifestations in Psychiatry", 
                description: "Psychopathology, hallucinations, delusions, and clinical signs",
                questions: [
                    {
                        id: 1,
                        question: "A patient is mute and immobile but conscious. He is unresponsive to the environment. How would you describe his state?",
                        options: {
                            "a": "Akinetic mutism",
                            "b": "Stupor",
                            "c": "Sopor", 
                            "d": "Twilight state"
                        },
                        correct: "b",
                        explanation: "A patient is said to be in a stupor when he is conscious but mute, immobile, and unresponsive to the environment.",
                        image: null,
                        tags: ["consciousness", "stupor"]
                    }
                ]
            }
        ];
        
        // Save each chapter
        for (const chapter of chapters) {
            const chapterData = {
                chapter: chapter.title,
                description: chapter.description,
                totalQuestions: chapter.questions.length,
                questions: chapter.questions
            };
            
            await fs.writeJson(
                path.join(outputDir, `chapter${chapter.id}.json`), 
                chapterData, 
                { spaces: 2 }
            );
            console.log(`✅ Created Chapter ${chapter.id}: ${chapter.questions.length} questions`);
        }
        
        // Create master index
        const masterIndex = {
            generatedAt: new Date().toISOString(),
            totalChapters: chapters.length,
            totalQuestions: chapters.reduce((sum, ch) => sum + ch.questions.length, 0),
            chapters: chapters.map(ch => ({
                id: ch.id,
                title: ch.title,
                description: ch.description,
                totalQuestions: ch.questions.length,
                link: `quiz.html?chapter=${ch.id}`
            }))
        };
        
        await fs.writeJson(path.join(outputDir, 'MASTER_INDEX.json'), masterIndex, { spaces: 2 });
        console.log(`\n🎉 Conversion complete! Created ${chapters.length} chapters with ${masterIndex.totalQuestions} questions`);
        
    } catch (error) {
        console.error('❌ Conversion failed:', error.message);
    }
}

main();
