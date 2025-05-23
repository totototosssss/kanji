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
        currentLevelDisplay: document.getElementById('current-level-display'), // Corrected ID
        currentScoreDisplay: document.getElementById('current-score'),
        finalScoreDisplay: document.getElementById('final-score-value')
    };
    for (const key in elements) { if (!elements[key]) { const e=`FATAL ERROR: UI Element '${key}' not found. Check HTML IDs.`; console.error(e); if(document.body)document.body.innerHTML=`<p style="color:red;font-size:24px;padding:30px; text-align:center;">${e}</p>`; return; }}

    // --- Game State & Chaos Control ---
    let quizDataByLevel = {}; // Stores questions grouped by level: { "1": [q1, q2], "2": [q3] }
    let availableLevels = []; // Sorted list of levels that have questions
    let currentQuestion = null; // The current question object
    let score = 0;
    let currentGameLevel = 1; // Starts at level 1, increments with each correct answer
    let maxReachedLevel = 0; // Highest actual level reached based on CSV data
    const csvFilePath = 'ankiDeck.csv';
    let chaosIntervalId = null;
    let isChaosModeActive = false;
    let flyingElementHueStart = Math.random() * 360;
    let flyingElementCount = 0;
    let unaskedQuestionsByLevel = {}; // To track unasked questions within the current pool for a level

    // --- Performance Monitor ---
    let lastFrameTime = performance.now(); let frameCount = 0;
    function updatePerformanceMonitorLoop() {
        frameCount++; const now = performance.now();
        if (now - lastFrameTime >= 1000) {
            const fps = Math.round((frameCount * 1000) / (now - lastFrameTime));
            elements.performanceMonitor.textContent = `FPS: ${fps} | Chaos Elements: ${flyingElementCount} | Game Level: ${currentGameLevel}`;
            frameCount = 0; lastFrameTime = now;
        }
        requestAnimationFrame(updatePerformanceMonitorLoop);
    }
    requestAnimationFrame(updatePerformanceMonitorLoop);


    // --- Nandeya Text Processing (with emphasis flag) ---
    function splitNandeyaText() {
        const minL=5; const maxL=25; let txt=LONG_NANDEYA_TEXT_CONTENT; nandeyaPhrases=[];
        const emphasisKeyword="なんでや"; const emphasisRegex=new RegExp(emphasisKeyword,"g");
        while(txt.length>0){let len=Math.floor(Math.random()*(maxL-minL+1))+minL;let p=txt.substring(0,Math.min(len,txt.length));let cut=-1;
        ['。','、',' ','　','！','？','（','）',')','(','「','」','・','…'].forEach(char=>{let i=p.lastIndexOf(char);if(i>p.length/3&&i>cut)cut=i;});
        if(cut!==-1&&txt.length>cut+1)p=txt.substring(0,cut+1);else if(txt.length<=maxL*1.2)p=txt;
        const tp=p.trim();if(tp)nandeyaPhrases.push({text:tp,isEmphasized:emphasisRegex.test(tp)});
        txt=txt.substring(p.length);if(p.length===0&&txt.length>0){const sp=txt.substring(0,Math.min(txt.length,maxL));nandeyaPhrases.push({text:sp.trim(),isEmphasized:emphasisRegex.test(sp)});txt="";}}
        if(nandeyaPhrases.length===0&&LONG_NANDEYA_TEXT_CONTENT){const fp=LONG_NANDEYA_TEXT_CONTENT.substring(0,maxL);nandeyaPhrases.push({text:fp.trim(),isEmphasized:emphasisRegex.test(fp)});}}

    // --- Data Loading & Processing ---
    async function loadAndProcessCSV() {
        elements.loadingDisplay.classList.remove('hidden'); elements.questionSection.classList.add('hidden'); elements.feedbackSection.classList.add('hidden'); elements.gameOverSection.classList.add('hidden');
        try { const r = await fetch(csvFilePath); if (!r.ok) throw new Error(`CSV Load: ${r.status} ${r.statusText}`); const t = await r.text();
            Papa.parse(t, { header: true, skipEmptyLines: true,
                complete: (results) => {
                    if (results.errors.length > 0) console.warn("CSV Parse Warnings:", results.errors);
                    processQuizData(results.data);
                    if (availableLevels.length > 0) startGame();
                    else elements.loadingDisplay.innerHTML = "<p>Error: No valid quiz data levels found.</p>";
                },
                error: (err) => { console.error("CSV Parse Error:", err); elements.loadingDisplay.innerHTML = `<p>Fatal CSV Parse Error: ${err.message}</p>`; }
            });
        } catch (e) { console.error("CSV Fetch Error:", e); elements.loadingDisplay.innerHTML = `<p>Fatal CSV Load Error: ${e.message}</p>`; }
    }

    function processQuizData(rawData) {
        const tempQuizDataByLevel = {};
        rawData.forEach(row => {
            if (!row['単語']?.trim() || !row['レベル']?.trim() || !row['問題ID']?.trim()) return;
            const problemId = row['問題ID'].trim();
            const level = parseInt(row['レベル'], 10);
            if (isNaN(level)) return; // Skip if level is not a number

            if (!tempQuizDataByLevel[level]) tempQuizDataByLevel[level] = {};
            
            if (!tempQuizDataByLevel[level][problemId]) {
                tempQuizDataByLevel[level][problemId] = {
                    id: problemId, level: level, displayWords: new Set(), answers: new Set(),
                    meanings: new Set(), notes: new Set(), otherSpellingsFromColumn: new Set()
                };
            }
            const entry = tempQuizDataByLevel[level][problemId];
            entry.displayWords.add(row['単語'].trim());
            entry.answers.add(row['読み方']?.trim() || '');
            if (row['別解']?.trim()) row['別解'].trim().split(/[/／、。・\s]+/).forEach(a => { if (a) entry.answers.add(a.trim()); });
            if (row['意味']?.trim()) entry.meanings.add(row['意味'].trim());
            if (row['追記']?.trim()) entry.notes.add(row['追記'].trim());
            if (row['別表記']?.trim()) entry.otherSpellingsFromColumn.add(row['別表記'].trim());
        });

        quizDataByLevel = {};
        for (const level in tempQuizDataByLevel) {
            quizDataByLevel[level] = Object.values(tempQuizDataByLevel[level]).map(item => ({
                ...item,
                displayWords: Array.from(item.displayWords),
                answers: Array.from(item.answers).filter(Boolean),
                meanings: Array.from(item.meanings).join(' <br> '),
                notes: Array.from(item.notes).join(' <br> '),
                otherSpellingsFromColumn: Array.from(item.otherSpellingsFromColumn),
            }));
        }
        
        availableLevels = Object.keys(quizDataByLevel).map(Number).sort((a, b) => a - b);
        if (availableLevels.length > 0) {
            maxReachedLevel = availableLevels[availableLevels.length -1];
        }
        console.log("Processed Quiz Data by Level:", quizDataByLevel);
        console.log("Available Levels:", availableLevels);
    }
    
    function resetUnaskedQuestionsForLevel(level) {
        if (quizDataByLevel[level]) {
            unaskedQuestionsByLevel[level] = [...quizDataByLevel[level]]; // Create a mutable copy
        } else {
            unaskedQuestionsByLevel[level] = [];
        }
    }


    // --- Game Logic ---
    function startGame() {
        currentQuestionIndex = 0; // This might not be used in the same way anymore
        score = 0;
        currentGameLevel = availableLevels.length > 0 ? availableLevels[0] : 1; // Start at the lowest available level
        updateScoreDisplay();
        elements.currentLevelDisplay.textContent = currentGameLevel;
        elements.gameOverSection.classList.add('hidden');
        elements.feedbackSection.classList.add('hidden');
        elements.loadingDisplay.classList.add('hidden');
        elements.questionSection.classList.remove('hidden');
        enableGameControls();
        resetUnaskedQuestionsForLevel(currentGameLevel);
        displayNextQuestion();
    }

    function displayNextQuestion() {
        if (isChaosModeActive) return;

        let currentLevelPool = unaskedQuestionsByLevel[currentGameLevel];
        
        // If current level pool is exhausted, or doesn't exist, try to find next available level
        while (!currentLevelPool || currentLevelPool.length === 0) {
            const currentLevelIndexInAvailable = availableLevels.indexOf(currentGameLevel);
            if (currentLevelIndexInAvailable !== -1 && currentLevelIndexInAvailable < availableLevels.length - 1) {
                currentGameLevel = availableLevels[currentLevelIndexInAvailable + 1]; // Move to next actual level from CSV
                elements.currentLevelDisplay.textContent = currentGameLevel; // Update display
                resetUnaskedQuestionsForLevel(currentGameLevel);
                currentLevelPool = unaskedQuestionsByLevel[currentGameLevel];
            } else { // No more levels with questions or current level was not in availableLevels
                 if (availableLevels.length > 0 && quizDataByLevel[maxReachedLevel]?.length > 0) {
                    // All questions from all levels asked, or reached beyond max actual level.
                    // Default to re-playing questions from the highest actual level if stuck.
                    currentGameLevel = maxReachedLevel; // Reset to highest actual level for replay
                    elements.currentLevelDisplay.textContent = currentGameLevel + "+"; // Indicate replay or extension
                    resetUnaskedQuestionsForLevel(currentGameLevel);
                    currentLevelPool = unaskedQuestionsByLevel[currentGameLevel];
                    if (!currentLevelPool || currentLevelPool.length === 0) { // Still no questions, something is wrong
                        showGameOver("すべての問題を解き終えました！");
                        return;
                    }
                } else {
                    showGameOver("問題がありません！"); // No questions available at all
                    return;
                }
            }
        }


        const randomIndex = Math.floor(Math.random() * currentLevelPool.length);
        currentQuestion = currentLevelPool.splice(randomIndex, 1)[0]; // Get and remove question

        elements.feedbackSection.classList.add('hidden'); elements.infoDetailsArea.classList.add('hidden'); elements.nextButton.classList.add('hidden');
        
        const wordToShow = currentQuestion.displayWords[Math.floor(Math.random() * currentQuestion.displayWords.length)];
        elements.kanjiDisplay.textContent = wordToShow;
        elements.imageContainer.innerHTML = `<img src="${STONE_IMAGE_FILENAME}" alt="Stylized Stone">`;
        elements.answerInput.value = ''; elements.answerInput.disabled = false; elements.submitButton.disabled = false; elements.answerInput.focus();
    }

    function handleSubmit() {
        if(elements.answerInput.disabled && !isChaosModeActive) return;
        const userAnswer = elements.answerInput.value.trim();
        // currentQuestion should be set by displayNextQuestion
        if (!currentQuestion) { 
            console.error("Current question is null in handleSubmit"); 
            displayNextQuestion(); // Try to recover
            return; 
        }
        let isCorrect = false;

        if(!isChaosModeActive){
            const normalizedUserAnswer = normalizeAnswer(userAnswer);
            for(const correctAnswer of currentQuestion.answers){
                if(normalizeAnswer(correctAnswer) === normalizedUserAnswer){ isCorrect = true; break; }
            }
        }
        
        elements.feedbackSection.classList.remove('hidden');
        elements.infoDetailsArea.classList.remove('hidden');
        
        if(isCorrect){
            elements.feedbackMessage.textContent="正解！";
            elements.feedbackMessage.className='message-feedback correct';
            score+=10;
            currentGameLevel++; // ★ Level up on correct answer ★
            elements.currentLevelDisplay.textContent = currentGameLevel;
            elements.nextButton.classList.remove('hidden');
            // Prepare for next level's questions
            if (!unaskedQuestionsByLevel[currentGameLevel] && availableLevels.includes(currentGameLevel)) {
                resetUnaskedQuestionsForLevel(currentGameLevel);
            }

        } else {
            elements.feedbackMessage.innerHTML = `不正解！<br><span class="chaos-engage-text">真・無限<span class="emphasis-red">「なんでや」</span>カオス起動</span>`;
            elements.feedbackMessage.className='message-feedback incorrect';
            const correctAnswersText = currentQuestion.answers.join(' ／ ');
            elements.feedbackMessage.innerHTML += ` <span style="font-size:0.6em; color: var(--dim-text);">(正解: ${correctAnswersText})</span>`;
            
            if(!isChaosModeActive) activateChaosMode();
            elements.nextButton.classList.add('hidden');
        }
        elements.answerInput.disabled = true;
        elements.submitButton.disabled = true;

        elements.meaningText.innerHTML = currentQuestion.meanings || '－';
        if(currentQuestion.notes?.trim()){ elements.notesText.innerHTML = currentQuestion.notes; elements.notesContainer.classList.remove('hidden');}
        else elements.notesContainer.classList.add('hidden');
        const otherDisplayOptions = currentQuestion.displayWords.filter(w=>w!==elements.kanjiDisplay.textContent);
        const allOtherSpellings = new Set([...otherDisplayOptions, ...currentQuestion.otherSpellingsFromColumn]);
        if(allOtherSpellings.size > 0){ elements.otherSpellingsText.innerHTML = Array.from(allOtherSpellings).join('、 '); elements.otherSpellingsContainer.classList.remove('hidden');}
        else elements.otherSpellingsContainer.classList.add('hidden');
        
        updateScoreDisplay();
        // No currentQuestionIndex++ here, next question is based on new currentGameLevel
    }
    
    function normalizeAnswer(str) { if(!str)return"";return str.normalize('NFKC').toLowerCase().replace(/[\u30a1-\u30f6]/g,m=>String.fromCharCode(m.charCodeAt(0)-0x60)).replace(/\s+/g,''); }
    function updateScoreDisplay() { elements.currentScoreDisplay.textContent = score; }
    
    function showGameOver(message = "全レベル制覇！ (または問題切れ)") {
        if(isChaosModeActive)return;
        elements.questionSection.classList.add('hidden');
        elements.feedbackSection.classList.add('hidden');
        elements.gameOverSection.classList.remove('hidden');
        elements.gameOverSection.querySelector('h2').textContent = message; // Allow custom game over message
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

    // --- Perpetual, Sticky, Hardcore Chaos - Nandeya ONLY (LIGHTER VERSION) ---
    function activateChaosMode() {
        if (isChaosModeActive) return;
        isChaosModeActive = true;
        disableGameControls();
        elements.feedbackMessage.innerHTML = `不正解！<br><span class="chaos-engage-text">軽量版<span class="emphasis-red">「なんでや」</span>カオス起動…</span>`;
        
        triggerNandeyaElementsBatch(25); // ★ Reduced initial burst ★

        if (chaosIntervalId) clearInterval(chaosIntervalId);
        chaosIntervalId = setInterval(() => {
            triggerNandeyaElementsBatch(5 + Math.floor(Math.random() * 6)); // ★ Reduced continuous: 5-10 elements ★
        }, 1200); // ★ Slower interval: every 1.2 seconds ★
        requestAnimationFrame(updatePerformanceMonitorLoop);
    }

    function triggerNandeyaElementsBatch(numElements) {
        const DURATION_BASE = 12000; // Keep long duration for stickiness
        const DURATION_RANDOM_ADD = 8000;

        if (nandeyaPhrases.length === 0) {
            nandeyaPhrases.push({text: "「なんでや」がないねん！", isEmphasized: true});
        }

        for (let i = 0; i < numElements; i++) {
            const selectedPhraseObj = nandeyaPhrases[Math.floor(Math.random() * nandeyaPhrases.length)];
            const duration = DURATION_BASE + Math.random() * DURATION_RANDOM_ADD;
            setTimeout(() => {
                createNandeyaElement(selectedPhraseObj.text, selectedPhraseObj.isEmphasized, duration);
            }, i * (300 / numElements) );
        }
    }

    function createNandeyaElement(text, isEmphasized, duration) {
        const el = document.createElement('div');
        el.classList.add('flying-element', 'flying-text');
        flyingElementCount++;

        if (isEmphasized) {
            el.classList.add('nandeya-emphasis');
            el.style.fontSize = `${1.8 + Math.random() * 1.2}em`; // Reduced max size: 1.8em to 3.0em
            el.style.zIndex = (parseInt(el.style.zIndex || 5000) + 5).toString();
        } else {
            el.classList.add('general-rainbow-text');
            el.style.fontSize = `${0.9 + Math.random() * 0.8}em`; // Reduced max size: 0.9em to 1.7em
        }
        el.textContent = text;
        
        const currentHue = (flyingElementHueStart + Math.random() * 180) % 360;
        flyingElementHueStart = (flyingElementHueStart + 10) % 360; // Slower hue shift for overall palette

        el.style.setProperty('--base-hue', currentHue + 'deg');
        el.style.backgroundColor = `hsla(${currentHue}, 80%, ${10 + Math.random()*15}%, ${0.6 + Math.random()*0.2})`;
        el.style.border = `2px solid hsla(${(currentHue + 40) % 360}, 90%, ${50 + Math.random()*20}%, ${0.7 + Math.random()*0.1})`;
        // Text color and shadow are now primarily handled by CSS classes for nandeya-emphasis or general-rainbow-text

        document.body.appendChild(el); // Append to body

        const screenW = window.innerWidth;
        const screenH = window.innerHeight;
        const elRect = el.getBoundingClientRect();
        const elW = elRect.width;
        const elH = elRect.height;

        const animType = Math.random();
        let keyframes;
        let animDuration = duration * (0.7 + Math.random() * 0.6); // Slightly shorter, less variation
        let animEasing = `cubic-bezier(${Math.random()*0.25 + 0.1}, ${0.5 + Math.random()*0.4}, ${0.65 - Math.random()*0.25}, ${Math.random()*0.4 + 0.2})`;
        let iterations = Infinity;
        let direction = (Math.random() < 0.35 ? 'alternate' : 'normal');

        const startX = Math.random() * screenW - elW / 2;
        const startY = Math.random() * screenH - elH / 2;
        let endX, endY;

        const rotStart = Math.random() * 360 - 180; // Reduced rotation
        let rotEnd = rotStart + (Math.random() > 0.5 ? 1 : -1) * (360 + Math.random() * 360); // Reduced rotation

        if (animType < 0.2) { // Sticky
            endX = startX + (Math.random() * 40 - 20); endY = startY + (Math.random() * 40 - 20);
            rotEnd = rotStart + (Math.random() * 60 - 30); animDuration *= (1.5 + Math.random());
            animEasing = 'linear'; direction = 'alternate-reverse';
        } else if (animType < 0.5) { // Edge Drifter
            const edge = Math.floor(Math.random() * 4);
            if (edge === 0) { endX = Math.random()*screenW; endY = -elH * (0.3 + Math.random()*0.3); }
            else if (edge === 1) { endX = screenW + elW * (0.3 + Math.random()*0.3); endY = Math.random()*screenH; }
            else if (edge === 2) { endX = Math.random()*screenW; endY = screenH + elH * (0.3 + Math.random()*0.3); }
            else { endX = -elW * (0.3 + Math.random()*0.3); endY = Math.random()*screenH; }
            animDuration *= (1.2 + Math.random()*0.5);
            rotEnd = rotStart + (Math.random() * 120 - 60);
        } else { // Chaotic
            endX = Math.random() * screenW * 1.8 - screenW * 0.4; // Reduced travel
            endY = Math.random() * screenH * 1.8 - screenH * 0.4;
        }
        
        const initialScale = 0.1 + Math.random() * 0.2;
        const peakScale = isEmphasized ? (1.2 + Math.random() * 0.5) : (0.8 + Math.random() * 0.4); // Reduced peak scale
        const finalPersistScale = isEmphasized ? (0.6 + Math.random()*0.3) : (0.4 + Math.random()*0.3);

        keyframes = [
            { transform: `translate(${startX}px, ${startY}px) scale(${initialScale}) rotate(${rotStart}deg)`, opacity: 0, filter: 'blur(10px) brightness(0.5)'},
            { transform: `translate(${startX + (endX-startX)*0.1}px, ${startY + (endY-startY)*0.1}px) scale(${peakScale}) rotate(${rotStart + (rotEnd - rotStart)*0.1}deg)`, opacity: 1, filter: 'blur(0px) brightness(1.1)', offset: 0.1 },
            { transform: `translate(${startX + (endX-startX)*0.5}px, ${startY + (endY-startY)*0.5}px) scale(${(peakScale + finalPersistScale) / 2}) rotate(${rotStart + (rotEnd - rotStart)*0.5}deg)`, opacity: 0.9, filter: `brightness(1) hue-rotate(${Math.random()*40-20}deg)`, offset: 0.4 + Math.random()*0.2 },
            { transform: `translate(${endX}px, ${endY}px) scale(${finalPersistScale}) rotate(${rotEnd}deg)`, opacity: 0.75 + Math.random()*0.15, filter: `brightness(0.9) hue-rotate(${Math.random()*80-40}deg)` }
        ];
        const timing = { duration: animDuration, easing: animEasing, iterations: Infinity, direction: direction };
        
        try {
            const animation = el.animate(keyframes, timing);
            // No onfinish to remove element for perpetual effect
        } catch (e) {
            console.warn("Animation failed for an element, likely due to extreme parameters or browser limit.", e, el);
            el.remove(); // Remove if animation setup fails to prevent broken states
            flyingElementCount--;
        }
    }

    // --- Event Listeners ---
    elements.submitButton.addEventListener('click', handleSubmit);
    elements.answerInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSubmit(); });
    elements.nextButton.addEventListener('click', displayNextQuestion);
    elements.restartButton.addEventListener('click', () => {
        if (chaosIntervalId) clearInterval(chaosIntervalId); chaosIntervalId = null;
        isChaosModeActive = false;
        document.querySelectorAll('.flying-element').forEach(fe => fe.remove());
        flyingElementCount = 0;
        enableGameControls();
        loadAndProcessCSV();
    });

    // --- Initialization ---
    splitNandeyaText();
    loadAndProcessCSV();
});
