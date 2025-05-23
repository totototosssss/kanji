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
        nandeyaPhrases = [];
        const fullText = LONG_NANDEYA_TEXT_CONTENT;
        const emphasisKeyword = "なんでや";
        const minL = 6; // Min length for a non-emphasized phrase
        const maxL = 30; // Max length for a non-emphasized phrase

        // Split by "なんでや" first, keeping "なんでや" and its surrounding punctuation as emphasized parts
        const parts = fullText.split(new RegExp(`(${emphasisKeyword}[。、！？　…]*)`, 'g'));

        parts.forEach(part => {
            if (!part || part.trim() === "") return;

            const trimmedPart = part.trim();
            const containsEmphasis = trimmedPart.startsWith(emphasisKeyword); // Check if the part IS an emphasis phrase

            if (containsEmphasis) {
                // This part is an emphasized phrase (e.g., "なんでや。", "なんでやウィスク")
                // Ensure it's not excessively long, but keep the core "なんでや"
                let emphasizedPhrase = trimmedPart;
                if (emphasizedPhrase.length > maxL + emphasisKeyword.length) { // If it's very long with context
                    const nandeyaIndex = emphasizedPhrase.indexOf(emphasisKeyword);
                    emphasizedPhrase = emphasizedPhrase.substring(
                        Math.max(0, nandeyaIndex - 5), // Include a bit before
                        Math.min(emphasizedPhrase.length, nandeyaIndex + emphasisKeyword.length + 10) // And a bit after
                    ).trim();
                }
                 if (emphasizedPhrase.length < minL && emphasizedPhrase !== emphasisKeyword) { // Too short, just use keyword
                    emphasizedPhrase = emphasisKeyword;
                }
                nandeyaPhrases.push({ text: emphasizedPhrase, isEmphasized: true });
            } else {
                // This part does NOT contain "なんでや" as the start, so treat as normal text to be split
                let remainingNormalText = trimmedPart;
                while (remainingNormalText.length > 0) {
                    let phraseLength = Math.floor(Math.random() * (maxL - minL + 1)) + minL;
                    let currentNormalPhrase = remainingNormalText.substring(0, Math.min(phraseLength, remainingNormalText.length));
                    
                    // Try to find a natural break (punctuation) within the segment
                    let cutPoint = -1;
                    const punctuation = /[。、！？　…]/g;
                    let match;
                    while ((match = punctuation.exec(currentNormalPhrase)) !== null) {
                        if (match.index > minL / 2 && match.index < currentNormalPhrase.length -1) { // Prefer cuts not at the very start/end
                           cutPoint = match.index;
                        }
                    }
                    if (cutPoint !== -1) {
                        currentNormalPhrase = currentNormalPhrase.substring(0, cutPoint + 1);
                    }
                    
                    const finalNormalPhrase = currentNormalPhrase.trim();
                    if (finalNormalPhrase) {
                        nandeyaPhrases.push({ text: finalNormalPhrase, isEmphasized: false });
                    }
                    remainingNormalText = remainingNormalText.substring(currentNormalPhrase.length).trim();
                    if (currentNormalPhrase.length === 0 && remainingNormalText.length > 0) { // Safety break
                         nandeyaPhrases.push({ text: remainingNormalText.substring(0, Math.min(remainingNormalText.length, maxL)), isEmphasized: false });
                         remainingNormalText = "";
                    }
                }
            }
        });

        if (nandeyaPhrases.length === 0 && LONG_NANDEYA_TEXT_CONTENT) { // Fallback
            const fp = LONG_NANDEYA_TEXT_CONTENT.substring(0, maxL);
            nandeyaPhrases.push({ text: fp.trim(), isEmphasized: fp.includes(emphasisKeyword) });
        }
        // Ensure at least one "なんでや" phrase if the keyword exists in the original text
        if (LONG_NANDEYA_TEXT_CONTENT.includes(emphasisKeyword) && !nandeyaPhrases.some(p => p.isEmphasized && p.text.includes(emphasisKeyword))) {
            nandeyaPhrases.push({ text: emphasisKeyword, isEmphasized: true });
        }
        console.log("Nandeya Phrases (Revised Split):", nandeyaPhrases);
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
        score = 0; currentGameDisplayLevel = 1;
        if (availableCsvLevels.length > 0 && !availableCsvLevels.includes(1)) { // If level 1 data doesn't exist, start from lowest available
            currentGameDisplayLevel = availableCsvLevels[0];
        }
        elements.currentLevelDisplay.textContent = currentGameDisplayLevel;
        availableCsvLevels.forEach(level => resetUnaskedQuestionsForCsvLevel(level)); // Reset all pools
        updateScoreDisplay(); elements.gameOverSection.classList.add('hidden'); elements.feedbackSection.classList.add('hidden');
        elements.loadingDisplay.classList.add('hidden'); elements.questionSection.classList.remove('hidden');
        enableGameControls(); displayNextQuestion();
    }

    function getActualCsvLevelToQuery(targetDisplayLevel) {
        let levelToQuery = targetDisplayLevel;
        if (quizDataByCsvLevel[String(levelToQuery)] && quizDataByCsvLevel[String(levelToQuery)].length > 0) {
            return levelToQuery; // Exact match found
        }
        // Find closest available CSV level <= targetDisplayLevel
        let closestLower = -1;
        for (let i = availableCsvLevels.length - 1; i >= 0; i--) {
            if (availableCsvLevels[i] <= levelToQuery) {
                closestLower = availableCsvLevels[i]; break;
            }
        }
        if (closestLower !== -1) return closestLower;
        // If nothing found (e.g. target is 1, CSV starts at 5), use lowest available
        return availableCsvLevels.length > 0 ? availableCsvLevels[0] : -1;
    }

    function displayNextQuestion() {
        if (isChaosModeActive) return;

        let actualCsvLevelForQuery = getActualCsvLevelToQuery(currentGameDisplayLevel);
        let csvLevelKey = String(actualCsvLevelForQuery);
        
        elements.currentLevelDisplay.textContent = currentGameDisplayLevel; // Base display
        if (actualCsvLevelForQuery !== currentGameDisplayLevel && actualCsvLevelForQuery !== -1) {
             elements.currentLevelDisplay.textContent = `${currentGameDisplayLevel} (問題Lv: ${actualCsvLevelForQuery})`;
        }


        if (actualCsvLevelForQuery === -1 || !quizDataByCsvLevel[csvLevelKey]) {
            showGameOver("適切な問題レベルが見つかりません。"); return;
        }

        if (!unaskedQuestionsByCsvLevel[csvLevelKey] || unaskedQuestionsByCsvLevel[csvLevelKey].length === 0) {
            resetUnaskedQuestionsForCsvLevel(actualCsvLevelForQuery); // Refill if empty (allows repeating level)
            if (unaskedQuestionsByCsvLevel[csvLevelKey].length === 0 && currentGameDisplayLevel > maxCsvLevel) {
                 // If truly exhausted even after refill and we are beyond max CSV levels
                 showGameOver("全問題を解き終えたか、問題がありません。"); return;
            } else if (unaskedQuestionsByCsvLevel[csvLevelKey].length === 0) {
                // This specific CSV level might be empty from the start, try next actual CSV level
                const currentIndex = availableCsvLevels.indexOf(actualCsvLevelForQuery);
                if (currentIndex !== -1 && currentIndex < availableCsvLevels.length - 1) {
                    actualCsvLevelForQuery = availableCsvLevels[currentIndex + 1];
                    csvLevelKey = String(actualCsvLevelForQuery);
                    elements.currentLevelDisplay.textContent = `${currentGameDisplayLevel} (問題Lv: ${actualCsvLevelForQuery})`;
                    resetUnaskedQuestionsForCsvLevel(actualCsvLevelForQuery);
                } else {
                     showGameOver("問題データが完全に枯渇しました。"); return;
                }
            }
        }
        
        let pool = unaskedQuestionsByCsvLevel[csvLevelKey];
        if (!pool || pool.length === 0) { showGameOver(`レベル ${csvLevelKey} の問題プールが空です。`); return; }

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
        if (!currentQuestion) { console.error("No current question!"); displayNextQuestion(); return; }
        let isCorrect = false;

        if(!isChaosModeActive){
            const normalizedUserAnswer = normalizeAnswer(userAnswer);
            for(const correctAnswer of currentQuestion.answers){ if(normalizeAnswer(correctAnswer) === normalizedUserAnswer){ isCorrect = true; break; }}
        }
        
        elements.feedbackSection.classList.remove('hidden'); elements.infoDetailsArea.classList.remove('hidden');
        
        if(isCorrect){
            elements.feedbackMessage.textContent="正解！"; elements.feedbackMessage.className='message-feedback correct';
            score+=10;
            currentGameDisplayLevel++;
            elements.currentLevelDisplay.textContent = currentGameDisplayLevel;
            elements.nextButton.classList.remove('hidden');
        } else {
            elements.feedbackMessage.innerHTML = `不正解ッ！！<br><span class="chaos-engage-text">「なんでや」<span class="emphasis-red">無限</span>カオス顕現</span>`;
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
        if(isChaosModeActive)return; // No game over screen if chaos is on
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

    // --- Perpetual, Sticky, Hardcore Chaos - Nandeya ONLY (Adjusted for phrase balance) ---
    function activateChaosMode() {
        if (isChaosModeActive) return; isChaosModeActive = true;
        disableGameControls();
        elements.feedbackMessage.innerHTML = `不正解…！<br><span class="chaos-engage-text">「なんでや」<span class="emphasis-red">永久</span>ループ開始！</span>`;
        
        triggerNandeyaElementsBatch(40); // ★ Initial burst: 40 (moderate) ★

        if (chaosIntervalId) clearInterval(chaosIntervalId);
        chaosIntervalId = setInterval(() => {
            triggerNandeyaElementsBatch(12 + Math.floor(Math.random() * 14)); // ★ Continuous: 12-25 elements ★
        }, 700); // ★ Interval: every 0.7 seconds (slightly less aggressive) ★
        requestAnimationFrame(updatePerformanceMonitorLoop);
    }

    function triggerNandeyaElementsBatch(numElements) {
        const DURATION_BASE = 16000; // Stickiness: long duration
        const DURATION_RANDOM_ADD = 12000;

        if (nandeyaPhrases.length === 0) nandeyaPhrases.push({text: "「なんでや」データなし！なんでや！", isEmphasized: true});
        
        const emphasizedPhrases = nandeyaPhrases.filter(p => p.isEmphasized);
        const normalPhrases = nandeyaPhrases.filter(p => !p.isEmphasized);

        for (let i = 0; i < numElements; i++) {
            let selectedPhraseObj;
            // ★ Adjust emphasis ratio: e.g., 40% chance for emphasized if available, otherwise fill with normal ★
            const emphasizeRoll = Math.random();
            if (emphasizedPhrases.length > 0 && (emphasizeRoll < 0.4 || normalPhrases.length === 0)) {
                selectedPhraseObj = emphasizedPhrases[Math.floor(Math.random() * emphasizedPhrases.length)];
            } else if (normalPhrases.length > 0) {
                selectedPhraseObj = normalPhrases[Math.floor(Math.random() * normalPhrases.length)];
            } else if (emphasizedPhrases.length > 0) { // Fallback to emphasized if normal is exhausted
                selectedPhraseObj = emphasizedPhrases[Math.floor(Math.random() * emphasizedPhrases.length)];
            }
             else { // Ultimate fallback
                selectedPhraseObj = {text: "…なんでや…", isEmphasized: true};
            }

            const duration = DURATION_BASE + Math.random() * DURATION_RANDOM_ADD;
            setTimeout(() => {
                createNandeyaElement(selectedPhraseObj.text, selectedPhraseObj.isEmphasized, duration);
            }, i * (150 / numElements) ); // Stagger slightly
        }
    }

    function createNandeyaElement(text, isEmphasized, duration) {
        const el = document.createElement('div');
        el.classList.add('flying-element', 'flying-text');
        flyingElementCount++;

        if (isEmphasized) {
            el.classList.add('nandeya-emphasis');
            el.style.fontSize = `${2.2 + Math.random() * 2.3}em`; // Emphasized: 2.2em to 4.5em (slightly reduced max)
            el.style.zIndex = (parseInt(el.style.zIndex || 5000) + 15).toString();
        } else {
            el.classList.add('general-rainbow-text');
            // ★ Ensure normal phrases are also clearly visible ★
            el.style.fontSize = `${1.2 + Math.random() * 1.1}em`; // Normal: 1.2em to 2.3em (increased min and overall)
        }
        el.textContent = text;
        
        const currentHue = (flyingElementHueStart + Math.random() * 160) % 360;
        flyingElementHueStart = (flyingElementHueStart + 6) % 360;

        el.style.setProperty('--base-hue', currentHue + 'deg'); // For potential CSS var use
        el.style.backgroundColor = `hsla(${currentHue}, 88%, ${10 + Math.random()*10}%, ${0.68 + Math.random()*0.22})`;
        el.style.border = `2px solid hsla(${(currentHue + Math.random()*50 -25) % 360}, 98%, ${52 + Math.random()*20}%, ${0.78 + Math.random()*0.15})`;
        
        if (!isEmphasized) { // Style for normal phrases
            el.style.color = `hsl(${(currentHue + 180) % 360}, 100%, 85%)`;
            el.style.textShadow = `0 0 1.5px black, 0 0 3px black, 0 0 5px hsla(${(currentHue + 190)%360}, 100%, 60%, 0.75)`;
        } // Emphasized text color/shadow is primarily handled by its CSS class

        document.body.appendChild(el);

        const screenW = window.innerWidth; const screenH = window.innerHeight;
        const elRect = el.getBoundingClientRect(); const elW = elRect
