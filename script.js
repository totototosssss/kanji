document.addEventListener('DOMContentLoaded', () => {
    // --- Game Configuration & User Text ---
    const LONG_NANDEYA_TEXT_CONTENT = '相当偏差値の高い高校（身の丈に合ってない）に通っています。高三なのですが未だにアルファベットが読めないことやadhdっぽいことに悩んで親に土下座してwais受けさせてもらいました。知覚推理144言語理解142ワーキングメモリ130処理速度84でした。　総合は覚えてないですが多分139とかだったはずです。ウィスクの年齢なのにウェイス受けさせられた。なんでや';
    let nandeyaPhrases = []; // Array of objects: { text: "phrase", isEmphasized: boolean }
    const STONE_IMAGE_FILENAME = 'stone.png';

    // --- HTML Element Cache & Validation ---
    const elements = {
        performanceMonitor: document.getElementById('performance-monitor'),
        loadingDisplay: document.getElementById('loading-display'),
        questionSection: document.getElementById('question-section'),
        kanjiDisplay: document.getElementById('kanji-character-display'),
        imageContainer: document.getElementById('image-container'),
        answerInput: document.getElementById('answer-input-field'),
        submitButton: document.getElementById('submit-answer-button'),
        feedbackSection: document.getElementById('feedback-section'),
        feedbackMessage: document.getElementById('feedback-message'),
        infoDetailsArea: document.getElementById('info-details-area'),
        meaningText: document.getElementById('meaning-text-content'),
        notesContainer: document.getElementById('notes-info-container'),
        notesText: document.getElementById('notes-text-content'),
        otherSpellingsContainer: document.getElementById('other-spellings-info-container'),
        otherSpellingsText: document.getElementById('other-spellings-text-content'),
        nextButton: document.getElementById('next-question-button'),
        gameOverSection: document.getElementById('game-over-section'),
        restartButton: document.getElementById('restart-game-button'),
        currentLevelDisplay: document.getElementById('current-level-display'),
        currentScoreDisplay: document.getElementById('current-score'),
        finalScoreDisplay: document.getElementById('final-score-value')
    };
    for (const key in elements) { if (!elements[key]) { const e=`FATAL ERROR: UI Element '${key}' not found. Check HTML IDs.`; console.error(e); if(document.body)document.body.innerHTML=`<p style="color:red;font-size:24px;padding:30px; text-align:center;">${e}</p>`; return; }}

    // --- Game State & Chaos Control ---
    let quizDataByCsvLevel = {};
    let availableCsvLevels = [];
    let currentQuestion = null;
    let score = 0;
    let currentGameDisplayLevel = 1;
    let maxCsvLevel = 0;
    const csvFilePath = 'ankiDeck.csv';
    let chaosIntervalId = null;
    let nandeyaBoostTimeoutId = null; // For the 15-second boost
    let isChaosModeActive = false;
    let flyingElementHueStart = Math.random() * 360;
    let flyingElementCount = 0;
    let unaskedQuestionsByCsvLevel = {};

    // --- Performance Monitor ---
    let lastFrameTime = performance.now(); let frameCount = 0;
    function updatePerformanceMonitorLoop() {
        frameCount++; const now = performance.now();
        if (now - lastFrameTime >= 1000) {
            const fps = Math.round((frameCount * 1000) / (now - lastFrameTime));
            elements.performanceMonitor.textContent = `FPS: ${fps} | Chaos Elements: ${flyingElementCount} | Game Display Level: ${currentGameDisplayLevel}`;
            frameCount = 0; lastFrameTime = now;
        }
        requestAnimationFrame(updatePerformanceMonitorLoop);
    }
    requestAnimationFrame(updatePerformanceMonitorLoop);

    // --- Nandeya Text Processing (Improved "なんでや" handling and general phrase splitting) ---
    function splitNandeyaText() {
        nandeyaPhrases = []; const fullText = LONG_NANDEYA_TEXT_CONTENT;
        const emphasisKeyword = "なんでや"; const minL = 5; const maxL = 28;
        const sentences = fullText.split(new RegExp(`(${emphasisKeyword}[。、！？　…]*|[^${emphasisKeyword}。、！？　…]*[。、！？　…]+)`, 'g')).filter(Boolean);

        sentences.forEach(sentence => {
            let currentSentence = sentence.trim();
            if (!currentSentence) return;

            const containsEmphasis = currentSentence.includes(emphasisKeyword);

            if (containsEmphasis && currentSentence.startsWith(emphasisKeyword)) {
                // This part is an emphasized phrase (e.g., "なんでや。", "なんでやウィスク")
                let emphasizedPhrase = currentSentence;
                if (emphasizedPhrase.length > maxL + emphasisKeyword.length) {
                    const nandeyaIndex = emphasizedPhrase.indexOf(emphasisKeyword);
                    emphasizedPhrase = emphasizedPhrase.substring(0, nandeyaIndex + emphasisKeyword.length + Math.floor(Math.random() * 10 + 5)).trim();
                }
                if (emphasizedPhrase.length < minL && emphasizedPhrase !== emphasisKeyword) emphasizedPhrase = emphasisKeyword;
                nandeyaPhrases.push({ text: emphasizedPhrase, isEmphasized: true });
            } else { // Normal phrase or part of a sentence not starting with "なんでや"
                let remainingNormalText = currentSentence;
                while (remainingNormalText.length > 0) {
                    let phraseLength = Math.floor(Math.random() * (maxL - minL + 1)) + minL;
                    let currentNormalPhrase = remainingNormalText.substring(0, Math.min(phraseLength, remainingNormalText.length));
                    let cutPoint = -1; const punctuation = /[。、！？　…]/g; let match;
                    while ((match = punctuation.exec(currentNormalPhrase)) !== null) { if (match.index > minL / 2 && match.index < currentNormalPhrase.length -1) cutPoint = match.index; }
                    if (cutPoint !== -1) currentNormalPhrase = currentNormalPhrase.substring(0, cutPoint + 1);
                    
                    const finalNormalPhrase = currentNormalPhrase.trim();
                    if (finalNormalPhrase) nandeyaPhrases.push({ text: finalNormalPhrase, isEmphasized: finalNormalPhrase.includes(emphasisKeyword) }); // Check again if a sub-phrase contains it
                    remainingNormalText = remainingNormalText.substring(currentNormalPhrase.length).trim();
                    if (currentNormalPhrase.length === 0 && remainingNormalText.length > 0) {
                        const safetyP = remainingNormalText.substring(0, Math.min(remainingNormalText.length,maxL));
                        nandeyaPhrases.push({text:safetyP, isEmphasized: safetyP.includes(emphasisKeyword)}); remainingNormalText="";
                    }
                }
            }
        });
        if (nandeyaPhrases.length === 0 && LONG_NANDEYA_TEXT_CONTENT) { const fp = LONG_NANDEYA_TEXT_CONTENT.substring(0,maxL); nandeyaPhrases.push({ text: fp.trim(), isEmphasized: fp.includes(emphasisKeyword) }); }
        if (LONG_NANDEYA_TEXT_CONTENT.includes(emphasisKeyword) && !nandeyaPhrases.some(p => p.isEmphasized && p.text.includes(emphasisKeyword))) { nandeyaPhrases.push({ text: emphasisKeyword, isEmphasized: true }); }
        console.log("Nandeya Phrases (Refined Split):", nandeyaPhrases);
    }


    // --- Data Loading & Processing ---
    async function loadAndProcessCSV() {
        elements.loadingDisplay.classList.remove('hidden'); elements.questionSection.classList.add('hidden'); elements.feedbackSection.classList.add('hidden'); elements.gameOverSection.classList.add('hidden');
        try { const r = await fetch(csvFilePath); if (!r.ok) throw new Error(`CSV Load: ${r.status} ${r.statusText}`); const t = await r.text();
            Papa.parse(t, { header: true, skipEmptyLines: true,
                complete: (results) => {
                    if (results.errors.length > 0) console.warn("CSV Parse Warnings:", results.errors);
                    processQuizData(results.data);
                    if (availableCsvLevels.length > 0) startGame();
                    else elements.loadingDisplay.innerHTML = "<p>Error: No valid quiz data levels found.</p>";
                },
                error: (err) => { console.error("CSV Parse Error:", err); elements.loadingDisplay.innerHTML = `<p>Fatal CSV Parse Error: ${err.message}</p>`; }
            });
        } catch (e) { console.error("CSV Fetch Error:", e); elements.loadingDisplay.innerHTML = `<p>Fatal CSV Load Error: ${e.message}</p>`; }
    }

    function processQuizData(rawData) {
        const tempQuizDataByCsvLevel = {};
        rawData.forEach(row => {
            if (!row['単語']?.trim() || !row['レベル']?.trim() || !row['問題ID']?.trim()) return;
            const problemId = row['問題ID'].trim(); const csvLevel = parseInt(row['レベル'], 10); if (isNaN(csvLevel)) return;
            if (!tempQuizDataByCsvLevel[csvLevel]) tempQuizDataByCsvLevel[csvLevel] = {};
            if (!tempQuizDataByCsvLevel[csvLevel][problemId]) tempQuizDataByCsvLevel[csvLevel][problemId] = { id: problemId, csvLevel: csvLevel, displayWords: new Set(), answers: new Set(), meanings: new Set(), notes: new Set(), otherSpellingsFromColumn: new Set() };
            const entry = tempQuizDataByCsvLevel[csvLevel][problemId];
            entry.displayWords.add(row['単語'].trim()); entry.answers.add(row['読み方']?.trim()||'');
            if(row['別解']?.trim())row['別解'].trim().split(/[/／、。・\s]+/).forEach(a=>{if(a)entry.answers.add(a.trim());});
            if(row['意味']?.trim())entry.meanings.add(row['意味'].trim()); if(row['追記']?.trim())entry.notes.add(row['追記'].trim()); if(row['別表記']?.trim())entry.otherSpellingsFromColumn.add(row['別表記'].trim());
        });
        quizDataByCsvLevel={}; for(const level in tempQuizDataByCsvLevel)quizDataByCsvLevel[level]=Object.values(tempQuizDataByCsvLevel[level]).map(item=>({...item,displayWords:Array.from(item.displayWords),answers:Array.from(item.answers).filter(Boolean),meanings:Array.from(item.meanings).join(' <br> '),notes:Array.from(item.notes).join(' <br> '),otherSpellingsFromColumn:Array.from(item.otherSpellingsFromColumn)}));
        availableCsvLevels=Object.keys(quizDataByCsvLevel).map(Number).sort((a,b)=>a-b);
        if(availableCsvLevels.length>0)maxCsvLevel=availableCsvLevels[availableCsvLevels.length-1];
    }
    
    function resetUnaskedQuestionsForCsvLevel(csvLevel) {
        const levelKey=String(csvLevel); if(quizDataByCsvLevel[levelKey])unaskedQuestionsByCsvLevel[levelKey]=[...quizDataByCsvLevel[levelKey]]; else unaskedQuestionsByCsvLevel[levelKey]=[];
    }

    // --- Game Logic ---
    function startGame() {
        score = 0;
        // Start game display level at 1. If CSV level 1 doesn't exist, use lowest available.
        currentGameDisplayLevel = 1; 
        if (availableCsvLevels.length > 0 && !availableCsvLevels.includes(1)) {
            currentGameDisplayLevel = availableCsvLevels[0];
        }
        elements.currentLevelDisplay.textContent = currentGameDisplayLevel;
        availableCsvLevels.forEach(level => resetUnaskedQuestionsForCsvLevel(level));
        updateScoreDisplay(); elements.gameOverSection.classList.add('hidden'); elements.feedbackSection.classList.add('hidden');
        elements.loadingDisplay.classList.add('hidden'); elements.questionSection.classList.remove('hidden');
        enableGameControls(); displayNextQuestion();
    }

    function getActualCsvLevelToQuery(targetDisplayLevel) {
        // Try to find the closest CSV level that is <= targetDisplayLevel and has questions
        // If targetDisplayLevel itself has questions, use it.
        if (quizDataByCsvLevel[String(targetDisplayLevel)] && quizDataByCsvLevel[String(targetDisplayLevel)].length > 0) {
             // Make sure its pool is ready or reset if empty
            if (!unaskedQuestionsByCsvLevel[String(targetDisplayLevel)] || unaskedQuestionsByCsvLevel[String(targetDisplayLevel)].length === 0) {
                resetUnaskedQuestionsForCsvLevel(targetDisplayLevel);
            }
            if (unaskedQuestionsByCsvLevel[String(targetDisplayLevel)].length > 0) return targetDisplayLevel;
        }

        // Otherwise, search downwards from targetDisplayLevel for an available CSV level
        for (let i = targetDisplayLevel; i >= 1; i--) {
            if (availableCsvLevels.includes(i) && quizDataByCsvLevel[String(i)] && quizDataByCsvLevel[String(i)].length > 0) {
                 if (!unaskedQuestionsByCsvLevel[String(i)] || unaskedQuestionsByCsvLevel[String(i)].length === 0) {
                    resetUnaskedQuestionsForCsvLevel(i);
                 }
                 if (unaskedQuestionsByCsvLevel[String(i)].length > 0) return i;
            }
        }
        // If still nothing found (e.g., targetDisplayLevel is below any available CSV level), use the lowest available CSV level.
        return availableCsvLevels.length > 0 ? availableCsvLevels[0] : -1; // -1 if no levels at all
    }


    function displayNextQuestion() {
        if (isChaosModeActive) return;

        let actualCsvLevelForQuery = getActualCsvLevelToQuery(currentGameDisplayLevel);
        let csvLevelKey = String(actualCsvLevelForQuery);

        elements.currentLevelDisplay.textContent = currentGameDisplayLevel; // Always show the incrementing game display level
        if (actualCsvLevelForQuery !== -1 && actualCsvLevelForQuery !== currentGameDisplayLevel) {
            elements.currentLevelDisplay.textContent = `${currentGameDisplayLevel} (問題Lv: ${actualCsvLevelForQuery})`;
        }

        if (actualCsvLevelForQuery === -1 || !quizDataByCsvLevel[csvLevelKey]) {
            showGameOver("適切な問題レベルが見つかりません。CSVデータを確認してください。"); return;
        }

        // Ensure the pool for the determined CSV level is ready
        if (!unaskedQuestionsByCsvLevel[csvLevelKey] || unaskedQuestionsByCsvLevel[csvLevelKey].length === 0) {
            resetUnaskedQuestionsForCsvLevel(actualCsvLevelForQuery);
        }
        
        let pool = unaskedQuestionsByCsvLevel[csvLevelKey];

        // If pool is *still* empty (e.g., actualCsvLevel had no questions or was just reset to an empty state)
        // This indicates a potential issue or truly all questions for this path are exhausted.
        // As per user: "レベルすぐ探せないと次のレベルにいっていいよ"
        // This implies we should rapidly try to find *any* available question pool if current one fails.
        // The getActualCsvLevelToQuery should ideally handle finding a suitable level.
        // If it returns a level but its pool is empty (e.g. after reset), we might be out of questions for that level.
        // Let's try to be more robust or default to highest if really stuck.
        if (!pool || pool.length === 0) {
            if (maxCsvLevel > 0 && quizDataByCsvLevel[String(maxCsvLevel)]?.length > 0) {
                 // If stuck, try to get questions from the max available CSV level
                 console.warn(`Pool for CSV level ${csvLevelKey} (target display ${currentGameDisplayLevel}) is empty. Falling back to max CSV level ${maxCsvLevel}.`);
                 actualCsvLevelForQuery = maxCsvLevel;
                 csvLevelKey = String(actualCsvLevelForQuery);
                 resetUnaskedQuestionsForCsvLevel(actualCsvLevelForQuery); // Refill for max level
                 pool = unaskedQuestionsByCsvLevel[csvLevelKey];
                 elements.currentLevelDisplay.textContent = `${currentGameDisplayLevel} (問題Lv: ${actualCsvLevelForQuery} 再)`;
            }
            if (!pool || pool.length === 0) { // If still no questions
                showGameOver("問題データが完全に枯渇しました。"); return;
            }
        }

        const randomIndex = Math.floor(Math.random() * pool.length);
        currentQuestion = pool.splice(randomIndex, 1)[0];

        elements.feedbackSection.classList.add('hidden'); elements.infoDetailsArea.classList.add('hidden'); elements.nextButton.classList.add('hidden');
        const wordToShow = currentQuestion.displayWords[Math.floor(Math.random()*currentQuestion.displayWords.length)];
        elements.kanjiDisplay.textContent = wordToShow;
        elements.imageContainer.innerHTML = `<img src="${STONE_IMAGE_FILENAME}" alt="Stylized Stone">`;
        elements.answerInput.value = ''; elements.answerInput.disabled = false; elements.submitButton.disabled = false; elements.answerInput.focus();
    }

    function handleSubmit() {
        if(elements.answerInput.disabled && !isChaosModeActive) return;
        const userAnswer = elements.answerInput.value.trim();
        if (!currentQuestion) { console.error("No current question for submit!"); displayNextQuestion(); return; }
        let isCorrect = false;

        if(!isChaosModeActive){
            const normalizedUserAnswer = normalizeAnswer(userAnswer);
            for(const correctAnswer of currentQuestion.answers){ if(normalizeAnswer(correctAnswer) === normalizedUserAnswer){ isCorrect = true; break; }}
        }
        
        elements.feedbackSection.classList.remove('hidden'); elements.infoDetailsArea.classList.remove('hidden');
        
        if(isCorrect){
            elements.feedbackMessage.textContent="正解！"; elements.feedbackMessage.className='message-feedback correct';
            score+=10;
            currentGameDisplayLevel++; // ★ Display Level up on correct answer ★
            elements.currentLevelDisplay.textContent = currentGameDisplayLevel; // Update display level directly
            elements.nextButton.classList.remove('hidden');
        } else {
            elements.feedbackMessage.innerHTML = `不正解ッ！！<br><span class="chaos-engage-text">「なんでや」<span class="emphasis-red">15秒後</span>ブーストカオス</span>`;
            elements.feedbackMessage.className='message-feedback incorrect';
            const correctAnswersText = currentQuestion.answers.join(' ／ ');
            elements.feedbackMessage.innerHTML += ` <span style="font-size:0.6em; color: var(--dim-text);">(正解: ${correctAnswersText})</span>`;
            if(!isChaosModeActive) activateChaosMode();
            elements.nextButton.classList.add('hidden');
        }
        elements.answerInput.disabled = true; elements.submitButton.disabled = true;

        elements.meaningText.innerHTML = currentQuestion.meanings || '－';
        if(currentQuestion.notes?.trim()){ elements.notesText.innerHTML = currentQuestion.notes; elements.notesContainer.classList.remove('hidden');}
        else elements.notesContainer.classList.add('hidden');
        const otherDisplayOptions = currentQuestion.displayWords.filter(w=>w!==elements.kanjiDisplay.textContent);
        const allOtherSpellings = new Set([...otherDisplayOptions, ...currentQuestion.otherSpellingsFromColumn]);
        if(allOtherSpellings.size > 0){ elements.otherSpellingsText.innerHTML = Array.from(allOtherSpellings).join('、 '); elements.otherSpellingsContainer.classList.remove('hidden');}
        else elements.otherSpellingsContainer.classList.add('hidden');
        
        updateScoreDisplay();
    }
    
    function normalizeAnswer(str) { if(!str)return"";return str.normalize('NFKC').toLowerCase().replace(/[\u30a1-\u30f6]/g,m=>String.fromCharCode(m.charCodeAt(0)-0x60)).replace(/\s+/g,''); }
    function updateScoreDisplay() { elements.currentScoreDisplay.textContent = score; }
    function showGameOver(message = "ゲームオーバー") {
        if(isChaosModeActive)return;
        elements.questionSection.classList.add('hidden'); elements.feedbackSection.classList.add('hidden');
        elements.gameOverSection.classList.remove('hidden');
        elements.gameOverSection.querySelector('h2').textContent = message;
        elements.finalScoreDisplay.textContent=score;
    }
    
    function disableGameControls() {
        elements.answerInput.disabled = true; elements.submitButton.disabled = true;
        elements.nextButton.disabled = true; elements.restartButton.disabled = true;
        let overlay = document.getElementById('chaos-active-overlay');
        if (!overlay) {
            overlay = document.createElement('div'); overlay.id = 'chaos-active-overlay';
            overlay.classList.add('chaos-active-overlay'); document.body.appendChild(overlay);
        }
        overlay.classList.remove('hidden');
    }
    function enableGameControls() {
        elements.answerInput.disabled=false;elements.submitButton.disabled=false;
        elements.nextButton.classList.add('hidden'); elements.restartButton.disabled=false;
        const overlay = document.getElementById('chaos-active-overlay');
        if (overlay) overlay.classList.add('hidden');
    }

    // --- Perpetual, Sticky, Hardcore Chaos - Nandeya ONLY ---
    function activateChaosMode() {
        if (isChaosModeActive) return; isChaosModeActive = true;
        disableGameControls();
        elements.feedbackMessage.innerHTML = `不正解…！<br><span class="chaos-engage-text">「なんでや」<span class="emphasis-red">永久</span>カオス開始！</span>`;
        
        triggerNandeyaElementsBatch(30); // Initial burst: 30 (balanced)

        if (chaosIntervalId) clearInterval(chaosIntervalId);
        chaosIntervalId = setInterval(() => {
            triggerNandeyaElementsBatch(10 + Math.floor(Math.random() * 11)); // Continuous: 10-20 elements
        }, 850); // Interval: every 0.85 seconds

        // ★ Nandeya Boost after 15 seconds ★
        if (nandeyaBoostTimeoutId) clearTimeout(nandeyaBoostTimeoutId); // Clear previous if any
        nandeyaBoostTimeoutId = setTimeout(() => {
            if (isChaosModeActive) { // Only boost if chaos is still active
                console.log("Executing 15-second Nandeya Boost!");
                elements.feedbackMessage.innerHTML += `<br><span style="color:var(--tertiary-accent); animation: pulseCorrect 1s infinite;">「なんでや」ブーストタイム！！！</span>`;
                triggerNandeyaElementsBatch(30 + Math.floor(Math.random() * 21), true); // Add 30-50 EXCLUSIVELY emphasized Nandeya phrases
            }
        }, 15000); // 15 seconds

        requestAnimationFrame(updatePerformanceMonitorLoop);
    }

    // Added an optional parameter 'emphasizedOnly' for the boost
    function triggerNandeyaElementsBatch(numElements, emphasizedOnly = false) {
        const DURATION_BASE = 15000;
        const DURATION_RANDOM_ADD = 10000;

        if (nandeyaPhrases.length === 0) nandeyaPhrases.push({text: "「なんでや」がないとは何でや！", isEmphasized: true});
        
        const phrasesToUse = emphasizedOnly ? nandeyaPhrases.filter(p => p.isEmphasized) : nandeyaPhrases;
        if (phrasesToUse.length === 0) { // Fallback if no suitable phrases (e.g., emphasizedOnly but no emphasized phrases)
            console.warn("No suitable phrases for batch, using fallback.");
            phrasesToUse.push({text: emphasizedOnly ? "なんでやブースト失敗！？" : "フレーズ枯渇…なんでや", isEmphasized: true});
        }


        const emphasizedAvailable = nandeyaPhrases.filter(p => p.isEmphasized);
        const normalAvailable = nandeyaPhrases.filter(p => !p.isEmphasized);

        for (let i = 0; i < numElements; i++) {
            let selectedPhraseObj;
            if (emphasizedOnly && emphasizedAvailable.length > 0) {
                selectedPhraseObj = emphasizedAvailable[Math.floor(Math.random() * emphasizedAvailable.length)];
            } else { // Normal batch generation logic (balancing emphasized and normal)
                const emphasizeRoll = Math.random();
                // ★ "なんでや" 強調フレーズの出現率 約45% ★
                if (emphasizedAvailable.length > 0 && (emphasizeRoll < 0.45 || normalAvailable.length === 0)) {
                    selectedPhraseObj = emphasizedAvailable[Math.floor(Math.random() * emphasizedAvailable.length)];
                } else if (normalAvailable.length > 0) {
                    selectedPhraseObj = normalAvailable[Math.floor(Math.random() * normalAvailable.length)];
                } else if (emphasizedAvailable.length > 0) {
                    selectedPhraseObj = emphasizedAvailable[Math.floor(Math.random() * emphasizedAvailable.length)];
                } else {
                    selectedPhraseObj = {text: "…なんでや…何故だ…", isEmphasized: true}; // Ultimate fallback
                }
            }

            const duration = DURATION_BASE + Math.random() * DURATION_RANDOM_ADD;
            setTimeout(() => {
                createNandeyaElement(selectedPhraseObj.text, selectedPhraseObj.isEmphasized, duration);
            }, i * (180 / numElements) ); // Stagger slightly
        }
    }

    function createNandeyaElement(text, isEmphasized, duration) {
        const el = document.createElement('div');
        el.classList.add('flying-element', 'flying-text');
        flyingElementCount++;

        if (isEmphasized) {
            el.classList.add('nandeya-emphasis');
            el.style.fontSize = `${2.3 + Math.random() * 2.7}em`; // Emphasized: 2.3em to 5.0em
            el.style.zIndex = (parseInt(el.style.zIndex || 5000) + Math.floor(10 + Math.random()*10)).toString(); // Higher z-index for emphasis
        } else {
            el.classList.add('general-rainbow-text');
            el.style.fontSize = `${1.1 + Math.random() * 1.3}em`; // Normal: 1.1em to 2.4em
        }
        el.textContent = text;
        
        const currentHue = (flyingElementHueStart + Math.random() * 170) % 360;
        flyingElementHueStart = (flyingElementHueStart + 5) % 360;

        el.style.setProperty('--base-hue', currentHue + 'deg');
        el.style.backgroundColor = `hsla(${currentHue}, 90%, ${8 + Math.random()*10}%, ${0.72 + Math.random()*0.2})`;
        el.style.border = `2px solid hsla(${(currentHue + Math.random()*40 -20) % 360}, 100%, ${50 + Math.random()*20}%, ${0.82 + Math.random()*0.15})`;
        
        if (!isEmphasized) {
            el.style.color = `hsl(${(currentHue + 180) % 360}, 100%, 86%)`;
            el.style.textShadow = `0 0 1.5px black, 0 0 3.5px black, 0 0 6px hsla(${(currentHue + 190)%360}, 100%, 62%, 0.8)`;
        }

        document.body.appendChild(el);

        const screenW = window.innerWidth; const screenH = window.innerHeight;
        const elRect = el.getBoundingClientRect(); const elW = elRect.width; const elH = elRect.height;

        const animType = Math.random(); let keyframes;
        let animDuration = duration * (0.78 + Math.random() * 0.45);
        let animEasing = `cubic-bezier(${Math.random()*0.3}, ${0.4 + Math.random()*0.55}, ${0.75 - Math.random()*0.3}, ${Math.random()*0.5 + 0.1})`;
        let iterations = Infinity; let direction = (Math.random() < 0.4 ? 'alternate-reverse' : 'normal');

        const startX = Math.random() * screenW - elW / 2;
        const startY = Math.random() * screenH - elH / 2;
        let endX, endY;

        const rotStart = Math.random() * 660 - 330;
        let rotEnd = rotStart + (Math.random() > 0.5 ? 1 : -1) * (660 + Math.random() * 800);

        if (animType < 0.11) { // Super Sticky
            endX = startX + (Math.random() * 22 - 11); endY = startY + (Math.random() * 22 - 11);
            rotEnd = rotStart + (Math.random() * 25 - 12.5); animDuration *= (1.9 + Math.random()*1.1);
            animEasing = 'steps(3, start)'; direction = 'alternate';
        } else if (animType < 0.38) { // Edge Loiterer
            const edge = Math.floor(Math.random() * 4);
            if(edge === 0) { endX = Math.random()*screenW; endY = Math.random()*elH*0.3 - elH*0.15; }
            else if (edge === 1) { endX = screenW - Math.random()*elW*0.3 + elW*0.15; endY = Math.random()*screenH; }
            else if (edge === 2) { endX = Math.random()*screenW; endY = screenH - Math.random()*elH*0.3 + elH*0.15; }
            else { endX = Math.random()*elW*0.3 - elW*0.15; endY = Math.random()*screenH; }
            animDuration *= (1.35 + Math.random()*0.7); rotEnd = rotStart + (Math.random() * 50 - 25);
        } else { // Dynamic Chaos
            endX = Math.random() * screenW * 1.9 - screenW * 0.45;
            endY = Math.random() * screenH * 1.9 - screenH * 0.45;
        }
        
        const initialScale = 0.18 + Math.random() * 0.22;
        const peakScale = isEmphasized ? (1.5 + Math.random() * 0.75) : (0.95 + Math.random() * 0.45);
        const finalPersistScale = isEmphasized ? (0.78 + Math.random()*0.4) : (0.52 + Math.random()*0.32);

        keyframes = [
            { transform: `translate(${startX}px, ${startY}px) scale(${initialScale}) rotate(${rotStart}deg)`, opacity: 0, filter: 'blur(14px) brightness(0.4)'},
            { transform: `translate(${startX + (endX-startX)*0.08}px, ${startY + (endY-startY)*0.08}px) scale(${peakScale}) rotate(${rotStart + (rotEnd - rotStart)*0.08}deg)`, opacity: 1, filter: 'blur(0px) brightness(1.18) saturate(1.7)', offset: 0.09 },
            { transform: `translate(${startX + (endX-startX)*0.5}px, ${startY + (endY-startY)*0.5}px) scale(${(peakScale + finalPersistScale) / (isEmphasized?1.65:2.05)}) rotate(${rotStart + (rotEnd - rotStart)*0.5}deg)`, opacity: 0.96, filter: `brightness(1.02) saturate(1.35) hue-rotate(${Math.random()*22-11}deg)`, offset: 0.38 + Math.random()*0.22 },
            { transform: `translate(${endX}px, ${endY}px) scale(${finalPersistScale}) rotate(${rotEnd}deg)`, opacity: 0.9 + Math.random()*0.1, filter: `brightness(0.92) saturate(1.18) hue-rotate(${Math.random()*44-22}deg)` }
        ];
        const timing = { duration: animDuration, easing: animEasing, iterations: Infinity, direction: direction };
        
        try { el.animate(keyframes, timing); }
        catch (e) { console.warn("Anim fail:", e, el); el.remove(); flyingElementCount--; }
    }

    // --- Event Listeners & Initialization ---
    elements.submitButton.addEventListener('click', handleSubmit);
    elements.answerInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSubmit(); });
    elements.nextButton.addEventListener('click', displayNextQuestion);
    elements.restartButton.addEventListener('click', () => {
        if (chaosIntervalId) clearInterval(chaosIntervalId); chaosIntervalId = null;
        if (nandeyaBoostTimeoutId) clearTimeout(nandeyaBoostTimeoutId); nandeyaBoostTimeoutId = null;
        isChaosModeActive = false;
        document.querySelectorAll('.flying-element').forEach(fe => fe.remove());
        flyingElementCount = 0;
        enableGameControls();
        loadAndProcessCSV();
    });
    splitNandeyaText();
    loadAndProcessCSV();
});
