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
    let quizDataByLevel = {};
    let availableLevels = [];
    let currentQuestion = null;
    let score = 0;
    let currentGameLevel = 1;
    let maxReachedCsvLevel = 0; // CSV内の最大レベルを追跡
    const csvFilePath = 'ankiDeck.csv';
    let chaosIntervalId = null;
    let isChaosModeActive = false;
    let flyingElementHueStart = Math.random() * 360;
    let flyingElementCount = 0;
    let unaskedQuestionsByLevel = {};

    // --- Performance Monitor ---
    let lastFrameTime = performance.now(); let frameCount = 0;
    function updatePerformanceMonitorLoop() {
        frameCount++; const now = performance.now();
        if (now - lastFrameTime >= 1000) {
            const fps = Math.round((frameCount * 1000) / (now - lastFrameTime));
            elements.performanceMonitor.textContent = `FPS: ${fps} | Chaos Elements: ${flyingElementCount} | Game Level: ${currentGameLevel}`;
            frameCount = 0; lastFrameTime = now;
        }
        requestAnimationFrame(updatePerformanceMonitorLoop); // Always run for FPS
    }
    requestAnimationFrame(updatePerformanceMonitorLoop);

    // --- Nandeya Text Processing (Improved "なんでや" handling) ---
    function splitNandeyaText() {
        const minL = 5; const maxL = 28; // Phrase length constraints
        const fullText = LONG_NANDEYA_TEXT_CONTENT;
        nandeyaPhrases = [];
        const emphasisKeyword = "なんでや";
        const sentences = fullText.split(/([。、！？　]+)/g); // Split by punctuation, keeping delimiters

        let currentPhrase = "";
        for (let i = 0; i < sentences.length; i++) {
            currentPhrase += sentences[i];
            if (sentences[i].match(/[。、！？　]/) || i === sentences.length - 1 || currentPhrase.length >= minL) {
                if (currentPhrase.trim().length >= minL) {
                    const trimmed = currentPhrase.trim();
                    const isEmphasized = trimmed.includes(emphasisKeyword);
                    // If emphasized, try to make the phrase meaningful around "なんでや"
                    if (isEmphasized) {
                        let emphasisIndex = trimmed.indexOf(emphasisKeyword);
                        let start = Math.max(0, emphasisIndex - Math.floor(Math.random() * 10 + 5)); // Include some context before
                        let end = Math.min(trimmed.length, emphasisIndex + emphasisKeyword.length + Math.floor(Math.random() * 10 + 5)); // And after
                        let phraseForEmphasis = trimmed.substring(start, end);
                        
                        // Ensure "なんでや" itself is not cut, and it's reasonably long
                        if (!phraseForEmphasis.includes(emphasisKeyword)) phraseForEmphasis = emphasisKeyword; // Fallback to just "なんでや"
                        else if (phraseForEmphasis.length < emphasisKeyword.length + 2 && trimmed.length > phraseForEmphasis.length) { // Too short, try to expand
                             let expandedStart = Math.max(0, trimmed.indexOf(emphasisKeyword) - 10);
                             let expandedEnd = Math.min(trimmed.length, trimmed.indexOf(emphasisKeyword) + emphasisKeyword.length + 10);
                             phraseForEmphasis = trimmed.substring(expandedStart, expandedEnd);
                        }
                        nandeyaPhrases.push({ text: phraseForEmphasis.trim(), isEmphasized: true});

                    } else if (trimmed.length <= maxL * 1.5) { // If not emphasized, and not too long
                         nandeyaPhrases.push({ text: trimmed, isEmphasized: false });
                    } else { // If too long and not emphasized, split further
                        let subTxt = trimmed;
                        while(subTxt.length > 0) {
                            let subLen = Math.floor(Math.random() * (maxL - minL +1)) + minL;
                            let finalSubPhrase = subTxt.substring(0, Math.min(subLen, subTxt.length));
                            if (finalSubPhrase.trim()) {
                                nandeyaPhrases.push({text: finalSubPhrase.trim(), isEmphasized: false});
                            }
                            subTxt = subTxt.substring(finalSubPhrase.length);
                             if (finalSubPhrase.length === 0 && subTxt.length > 0) { // Safety break
                                nandeyaPhrases.push({ text: subTxt.substring(0, Math.min(subTxt.length, maxL)), isEmphasized: false });
                                subTxt = "";
                            }
                        }
                    }
                }
                currentPhrase = "";
            }
        }
        if (nandeyaPhrases.length === 0 && LONG_NANDEYA_TEXT_CONTENT) { // Fallback
            const fp = LONG_NANDEYA_TEXT_CONTENT.substring(0, maxL);
            nandeyaPhrases.push({ text: fp.trim(), isEmphasized: fp.includes(emphasisKeyword) });
        }
        // Ensure at least one "なんでや" phrase if possible
        if (!nandeyaPhrases.some(p => p.isEmphasized) && LONG_NANDEYA_TEXT_CONTENT.includes(emphasisKeyword)) {
            nandeyaPhrases.push({ text: emphasisKeyword, isEmphasized: true });
        }
        console.log("Nandeya Phrases:", nandeyaPhrases);
    }


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
            if (isNaN(level)) return;

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
                displayWords: Array.from(item.displayWords), answers: Array.from(item.answers).filter(Boolean),
                meanings: Array.from(item.meanings).join(' <br> '), notes: Array.from(item.notes).join(' <br> '),
                otherSpellingsFromColumn: Array.from(item.otherSpellingsFromColumn),
            }));
        }
        availableLevels = Object.keys(quizDataByLevel).map(Number).sort((a, b) => a - b);
        if (availableLevels.length > 0) maxReachedCsvLevel = availableLevels[availableLevels.length -1];
    }
    
    function resetUnaskedQuestionsForLevel(levelKey) { // levelKey can be a number or string
        const actualLevelKey = String(levelKey); // Ensure string key for object
        if (quizDataByLevel[actualLevelKey]) {
            unaskedQuestionsByLevel[actualLevelKey] = [...quizDataByLevel[actualLevelKey]];
        } else {
             // If specific level has no questions (e.g. user advances beyond CSV max level)
             // Fallback to highest available CSV level if trying to access a non-existent higher level.
            if (levelKey > maxReachedCsvLevel && maxReachedCsvLevel > 0) {
                unaskedQuestionsByLevel[actualLevelKey] = [...(quizDataByLevel[String(maxReachedCsvLevel)] || [])];
            } else {
                unaskedQuestionsByLevel[actualLevelKey] = [];
            }
        }
    }

    // --- Game Logic ---
    function startGame() {
        currentQuestionIndex = 0; score = 0;
        currentGameLevel = availableLevels.length > 0 ? availableLevels[0] : 1;
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

        let currentLevelKey = String(currentGameLevel);
        // Ensure pool for current game level exists, or create from highest CSV level if beyond
        if (!unaskedQuestionsByLevel[currentLevelKey] || unaskedQuestionsByLevel[currentLevelKey].length === 0) {
            if (currentGameLevel > maxReachedCsvLevel && maxReachedCsvLevel > 0) {
                 // If current game level is beyond what's in CSV, use questions from highest CSV level
                currentLevelKey = String(maxReachedCsvLevel);
                if (!unaskedQuestionsByLevel[currentLevelKey] || unaskedQuestionsByLevel[currentLevelKey].length === 0) {
                    resetUnaskedQuestionsForLevel(maxReachedCsvLevel); // Refill from highest CSV level
                }
                 elements.currentLevelDisplay.textContent = `${currentGameLevel}(${maxReachedCsvLevel}相当)`; // Indicate actual content level
            } else {
                // Try to find next available actual CSV level if current has no more questions
                const currentLevelIndex = availableLevels.indexOf(parseInt(currentLevelKey));
                if (currentLevelIndex !== -1 && currentLevelIndex < availableLevels.length -1) {
                    currentGameLevel = availableLevels[currentLevelIndex + 1]; // This is an actual level increment
                    currentLevelKey = String(currentGameLevel);
                    elements.currentLevelDisplay.textContent = currentGameLevel;
                    resetUnaskedQuestionsForLevel(currentLevelKey);
                } else { // Truly no more questions anywhere or exhausted highest level
                    showGameOver("全問題クリア！または問題データが尽きました。"); return;
                }
            }
        }
        
        let pool = unaskedQuestionsByLevel[currentLevelKey];
        if (!pool || pool.length === 0) { // If after all checks, pool is still empty (e.g. highest level also exhausted)
            resetUnaskedQuestionsForLevel(currentLevelKey); // Try refilling one last time (allows repeating current level)
            pool = unaskedQuestionsByLevel[currentLevelKey];
            if(!pool || pool.length === 0) { // If STILL empty, then really no questions.
                 showGameOver(`レベル ${currentLevelKey} の問題がありません。`); return;
            }
        }


        const randomIndex = Math.floor(Math.random() * pool.length);
        currentQuestion = pool.splice(randomIndex, 1)[0];

        elements.feedbackSection.classList.add('hidden'); elements.infoDetailsArea.classList.add('hidden'); elements.nextButton.classList.add('hidden');
        
        const wordToShow = currentQuestion.displayWords[Math.floor(Math.random() * currentQuestion.displayWords.length)];
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
            currentGameLevel++; // ★ Level up display on correct answer ★
            elements.currentLevelDisplay.textContent = currentGameLevel;
            elements.nextButton.classList.remove('hidden');
            // Prepare for next game level's questions (actual CSV level may differ)
            let nextActualLevelKey = String(currentGameLevel);
            if (currentGameLevel > maxReachedCsvLevel && maxReachedCsvLevel > 0) {
                nextActualLevelKey = String(maxReachedCsvLevel); // Use highest CSV level if game level exceeds
            }
            if (!unaskedQuestionsByLevel[nextActualLevelKey] && quizDataByLevel[nextActualLevelKey]) {
                resetUnaskedQuestionsForLevel(nextActualLevelKey);
            }

        } else {
            elements.feedbackMessage.innerHTML = `不正解！<br><span class="chaos-engage-text">調整版<span class="emphasis-red">「なんでや」</span>カオス起動</span>`;
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
    function showGameOver(message = "全レベル制覇！ (または問題切れ)") {
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

    // --- Perpetual, Sticky, Hardcore Chaos - Nandeya ONLY (LIGHTER VERSION) ---
    function activateChaosMode() {
        if (isChaosModeActive) return; isChaosModeActive = true;
        disableGameControls();
        elements.feedbackMessage.innerHTML = `不正解！<br><span class="chaos-engage-text">調整版<span class="emphasis-red">「なんでや」</span>カオス、発動ッ！</span>`;
        
        triggerNandeyaElementsBatch(35); // ★ Moderate initial burst: 35 ★

        if (chaosIntervalId) clearInterval(chaosIntervalId);
        chaosIntervalId = setInterval(() => {
            triggerNandeyaElementsBatch(8 + Math.floor(Math.random() * 8)); // ★ Continuous: 8-15 elements ★
        }, 800); // ★ Slower interval: every 0.8 seconds ★
        requestAnimationFrame(updatePerformanceMonitorLoop);
    }

    function triggerNandeyaElementsBatch(numElements) {
        const DURATION_BASE = 15000; // Stickiness: long duration
        const DURATION_RANDOM_ADD = 10000;

        if (nandeyaPhrases.length === 0) nandeyaPhrases.push({text: "「なんでや」がないとは何でや！", isEmphasized: true});
        
        const emphasizedPhrases = nandeyaPhrases.filter(p => p.isEmphasized);
        const normalPhrases = nandeyaPhrases.filter(p => !p.isEmphasized);

        for (let i = 0; i < numElements; i++) {
            let selectedPhraseObj;
            // Ensure "なんでや" phrases appear more frequently and are prioritized
            const emphasizeRoll = Math.random();
            if (emphasizedPhrases.length > 0 && (emphasizeRoll < 0.6 || normalPhrases.length === 0)) { // 60% chance for emphasized if available
                selectedPhraseObj = emphasizedPhrases[Math.floor(Math.random() * emphasizedPhrases.length)];
            } else if (normalPhrases.length > 0) {
                selectedPhraseObj = normalPhrases[Math.floor(Math.random() * normalPhrases.length)];
            } else { // Fallback if only one type is exhausted or list is empty
                selectedPhraseObj = nandeyaPhrases[Math.floor(Math.random() * nandeyaPhrases.length)] || {text: "なんでや…？", isEmphasized: true};
            }

            const duration = DURATION_BASE + Math.random() * DURATION_RANDOM_ADD;
            setTimeout(() => {
                createNandeyaElement(selectedPhraseObj.text, selectedPhraseObj.isEmphasized, duration);
            }, i * (200 / numElements) ); // Stagger slightly
        }
    }

    function createNandeyaElement(text, isEmphasized, duration) {
        const el = document.createElement('div');
        el.classList.add('flying-element', 'flying-text');
        flyingElementCount++;

        if (isEmphasized) {
            el.classList.add('nandeya-emphasis');
            el.style.fontSize = `${2.0 + Math.random() * 2.0}em`; // Emphasized: 2.0em to 4.0em
            el.style.zIndex = (parseInt(el.style.zIndex || 5000) + 10).toString();
        } else {
            el.classList.add('general-rainbow-text');
            el.style.fontSize = `${1.0 + Math.random() * 1.0}em`; // Normal: 1.0em to 2.0em
        }
        el.textContent = text;
        
        const currentHue = (flyingElementHueStart + Math.random() * 150) % 360;
        flyingElementHueStart = (flyingElementHueStart + 7) % 360;

        el.style.setProperty('--base-hue', currentHue + 'deg'); // For potential CSS var use
        // Lighter CSS classes will handle primary rainbow, JS for dynamic BG/Border
        el.style.backgroundColor = `hsla(${currentHue}, 85%, ${8 + Math.random()*10}%, ${0.65 + Math.random()*0.2})`;
        el.style.border = `2px solid hsla(${(currentHue + Math.random()*50 -25) % 360}, 95%, ${50 + Math.random()*20}%, ${0.75 + Math.random()*0.1})`;
        // Text color for general-rainbow-text will be managed by its CSS animation primarily
        // For nandeya-emphasis, its CSS animation also handles color, but JS could override if needed.
        if (!isEmphasized) { // Ensure non-emphasized text is readable over its dynamic BG
            el.style.color = `hsl(${(currentHue + 180) % 360}, 100%, 85%)`;
            el.style.textShadow = `0 0 2px black, 0 0 4px black, 0 0 6px hsla(${(currentHue + 200)%360}, 100%, 55%, 0.7)`;
        }


        document.body.appendChild(el);

        const screenW = window.innerWidth; const screenH = window.innerHeight;
        const elRect = el.getBoundingClientRect(); const elW = elRect.width; const elH = elRect.height;

        const animType = Math.random();
        let keyframes;
        let animDuration = duration * (0.8 + Math.random() * 0.7); // Slightly faster base, more variation
        let animEasing = `cubic-bezier(${Math.random()*0.25 + 0.05}, ${0.45 + Math.random()*0.45}, ${0.55 - Math.random()*0.25}, ${Math.random()*0.45 + 0.15})`;
        let iterations = Infinity;
        let direction = (Math.random() < 0.4 ? 'alternate-reverse' : 'normal'); // More complex direction changes

        const startX = Math.random() * screenW - elW / 2;
        const startY = Math.random() * screenH - elH / 2;
        let endX, endY;

        const rotStart = Math.random() * 720 - 360;
        let rotEnd = rotStart + (Math.random() > 0.5 ? 1 : -1) * (720 + Math.random() * 1080); // Still lots of rotation

        // Adjusting movement patterns for better "こびりつき" and "派手さ" balance
        if (animType < 0.1) { // Super Sticky, almost no movement, but pulses/jitters
            endX = startX + (Math.random() * 20 - 10); endY = startY + (Math.random() * 20 - 10);
            rotEnd = rotStart + (Math.random() * 45 - 22.5); animDuration *= (2 + Math.random() * 1.5);
            animEasing = 'steps(5, end)'; direction = 'alternate';
        } else if (animType < 0.3) { // Slow Edge Crawler/Drifter
            const edge = Math.floor(Math.random() * 4);
            if (edge === 0) { endX = Math.random()*screenW; endY = -elH * (0.2 + Math.random()*0.2); }
            else if (edge === 1) { endX = screenW + elW * (0.2 + Math.random()*0.2); endY = Math.random()*screenH; }
            else if (edge === 2) { endX = Math.random()*screenW; endY = screenH + elH * (0.2 + Math.random()*0.2); }
            else { endX = -elW * (0.2 + Math.random()*0.2); endY = Math.random()*screenH; }
            animDuration *= (1.3 + Math.random()*0.7); rotEnd = rotStart + (Math.random() * 90 - 45);
        } else { // Dynamic Chaotic Movement
            endX = Math.random() * screenW * 2.0 - screenW * 0.5; // Moves far, ensuring visibility
            endY = Math.random() * screenH * 2.0 - screenH * 0.5;
        }
        
        const initialScale = 0.1 + Math.random() * 0.2;
        const peakScale = isEmphasized ? (1.5 + Math.random() * 0.8) : (0.9 + Math.random() * 0.5);
        const finalPersistScale = isEmphasized ? (0.75 + Math.random()*0.4) : (0.5 + Math.random()*0.35);

        keyframes = [
            { transform: `translate(${startX}px, ${startY}px) scale(${initialScale}) rotate(${rotStart}deg)`, opacity: 0, filter: 'blur(15px) brightness(0.3)'},
            { transform: `translate(${startX + (endX-startX)*0.1}px, ${startY + (endY-startY)*0.1}px) scale(${peakScale}) rotate(${rotStart + (rotEnd - rotStart)*0.1}deg)`, opacity: 1, filter: 'blur(0px) brightness(1.2)', offset: 0.08 },
            { transform: `translate(${startX + (endX-startX)*0.5}px, ${startY + (endY-startY)*0.5}px) scale(${(peakScale + finalPersistScale) / (isEmphasized?1.8:2.2)}) rotate(${rotStart + (rotEnd - rotStart)*0.5}deg)`, opacity: 0.95, filter: `brightness(1.05) hue-rotate(${Math.random()*30-15}deg)`, offset: 0.35 + Math.random()*0.25 },
            { transform: `translate(${endX}px, ${endY}px) scale(${finalPersistScale}) rotate(${rotEnd}deg)`, opacity: 0.85 + Math.random()*0.15, filter: `brightness(0.95) hue-rotate(${Math.random()*60-30}deg)` }
        ];
        const timing = { duration: animDuration, easing: animEasing, iterations: Infinity, direction: direction };
        
        try { el.animate(keyframes, timing); }
        catch (e) { console.warn("Anim fail:", e, el); el.remove(); flyingElementCount--; }
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
        loadAndProcessCSV(); // Reload and restart
    });

    // --- Initialization ---
    splitNandeyaText();
    loadAndProcessCSV();
});
