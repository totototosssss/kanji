document.addEventListener('DOMContentLoaded', () => {
    // --- Game Configuration & User Text ---
    const LONG_NANDEYA_TEXT_CONTENT = '相当偏差値の高い高校（身の丈に合ってない）に通っています。高三なのですが未だにアルファベットが読めないことやadhdっぽいことに悩んで親に土下座してwais受けさせてもらいました。知覚推理144言語理解142ワーキングメモリ130処理速度84でした。　総合は覚えてないですが多分139とかだったはずです。ウィスクの年齢なのにウェイス受けさせられた。なんでや';
    let nandeyaPhrases = [];
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
    let quizDataByCsvLevel = {}; // Stores questions grouped by their CSV level: { "1": [q1, q2], "2": [q3] }
    let availableCsvLevels = []; // Sorted list of levels that actually exist in CSV data
    let currentQuestion = null;
    let score = 0;
    let currentGameDisplayLevel = 1; // This is the level displayed to the user, starts at 1
    let maxCsvLevel = 0; // Highest level found in CSV data
    const csvFilePath = 'ankiDeck.csv';
    let chaosIntervalId = null;
    let isChaosModeActive = false;
    let flyingElementHueStart = Math.random() * 360;
    let flyingElementCount = 0;
    let unaskedQuestionsByCsvLevel = {}; // Tracks unasked questions for each CSV level

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


    // --- Nandeya Text Processing (with emphasis flag) ---
    function splitNandeyaText() {
        const minL=5; const maxL=28; let txt=LONG_NANDEYA_TEXT_CONTENT; nandeyaPhrases=[];
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
            const problemId = row['問題ID'].trim();
            const csvLevel = parseInt(row['レベル'], 10);
            if (isNaN(csvLevel)) return;

            if (!tempQuizDataByCsvLevel[csvLevel]) tempQuizDataByCsvLevel[csvLevel] = {};
            if (!tempQuizDataByCsvLevel[csvLevel][problemId]) {
                tempQuizDataByCsvLevel[csvLevel][problemId] = {
                    id: problemId, csvLevel: csvLevel, // Store original CSV level
                    displayWords: new Set(), answers: new Set(), meanings: new Set(),
                    notes: new Set(), otherSpellingsFromColumn: new Set()
                };
            }
            const entry = tempQuizDataByCsvLevel[csvLevel][problemId];
            entry.displayWords.add(row['単語'].trim());
            entry.answers.add(row['読み方']?.trim() || '');
            if (row['別解']?.trim()) row['別解'].trim().split(/[/／、。・\s]+/).forEach(a => { if (a) entry.answers.add(a.trim()); });
            if (row['意味']?.trim()) entry.meanings.add(row['意味'].trim());
            if (row['追記']?.trim()) entry.notes.add(row['追記'].trim());
            if (row['別表記']?.trim()) entry.otherSpellingsFromColumn.add(row['別表記'].trim());
        });

        quizDataByCsvLevel = {};
        for (const level in tempQuizDataByCsvLevel) {
            quizDataByCsvLevel[level] = Object.values(tempQuizDataByCsvLevel[level]).map(item => ({
                ...item,
                displayWords: Array.from(item.displayWords), answers: Array.from(item.answers).filter(Boolean),
                meanings: Array.from(item.meanings).join(' <br> '), notes: Array.from(item.notes).join(' <br> '),
                otherSpellingsFromColumn: Array.from(item.otherSpellingsFromColumn),
            }));
        }
        
        availableCsvLevels = Object.keys(quizDataByCsvLevel).map(Number).sort((a, b) => a - b);
        if (availableCsvLevels.length > 0) maxCsvLevel = availableCsvLevels[availableCsvLevels.length -1];
        
        console.log("Processed Quiz Data by CSV Level:", quizDataByCsvLevel);
        console.log("Available CSV Levels:", availableCsvLevels);
    }
    
    function resetUnaskedQuestionsForCsvLevel(csvLevel) {
        const levelKey = String(csvLevel);
        if (quizDataByCsvLevel[levelKey]) {
            unaskedQuestionsByCsvLevel[levelKey] = [...quizDataByCsvLevel[levelKey]];
        } else {
            unaskedQuestionsByCsvLevel[levelKey] = [];
        }
    }

    // --- Game Logic ---
    function startGame() {
        score = 0;
        // Start game display level at 1. Determine the initial CSV level to pick questions from.
        currentGameDisplayLevel = 1; 
        elements.currentLevelDisplay.textContent = currentGameDisplayLevel;
        
        // Initialize unasked questions for all available CSV levels
        availableCsvLevels.forEach(level => resetUnaskedQuestionsForCsvLevel(level));

        updateScoreDisplay();
        elements.gameOverSection.classList.add('hidden');
        elements.feedbackSection.classList.add('hidden');
        elements.loadingDisplay.classList.add('hidden');
        elements.questionSection.classList.remove('hidden');
        enableGameControls();
        displayNextQuestion();
    }

    function getActualCsvLevelToQuery(targetDisplayLevel) {
        // Try to match display level with an actual CSV level
        if (quizDataByCsvLevel[String(targetDisplayLevel)] && quizDataByCsvLevel[String(targetDisplayLevel)].length > 0) {
            return targetDisplayLevel;
        }
        // If exact match not found, find the closest available CSV level that is <= targetDisplayLevel
        let closestCsvLevel = -1;
        for (let i = availableCsvLevels.length - 1; i >= 0; i--) {
            if (availableCsvLevels[i] <= targetDisplayLevel) {
                closestCsvLevel = availableCsvLevels[i];
                break;
            }
        }
        // If no CSV level is <= targetDisplayLevel (e.g. targetDisplayLevel is 1 but CSV starts at 5), use lowest available.
        if (closestCsvLevel === -1 && availableCsvLevels.length > 0) {
            closestCsvLevel = availableCsvLevels[0];
        }
        // If targetDisplayLevel is beyond maxCsvLevel, cap at maxCsvLevel
        if (targetDisplayLevel > maxCsvLevel && maxCsvLevel > 0) {
            closestCsvLevel = maxCsvLevel;
        }
        return closestCsvLevel > 0 ? closestCsvLevel : (availableCsvLevels.length > 0 ? availableCsvLevels[0] : -1);
    }


    function displayNextQuestion() {
        if (isChaosModeActive) return;

        let actualCsvLevel = getActualCsvLevelToQuery(currentGameDisplayLevel);
        let csvLevelKey = String(actualCsvLevel);

        // If pool for this actualCsvLevel is exhausted or doesn't exist, reset it.
        // This means if we query level 5, and its empty, we refill level 5.
        if (!unaskedQuestionsByCsvLevel[csvLevelKey] || unaskedQuestionsByCsvLevel[csvLevelKey].length === 0) {
            if (quizDataByCsvLevel[csvLevelKey] && quizDataByCsvLevel[csvLevelKey].length > 0) {
                 resetUnaskedQuestionsForCsvLevel(actualCsvLevel); // Refill the pool for this CSV level
            } else {
                // This CSV level has no questions at all (should not happen if getActualCsvLevelToQuery is correct and data exists)
                // Or, all questions from all levels might have been exhausted in a very long game.
                // Try to find the *next* available CSV level with questions
                let foundNext = false;
                for (let i = 0; i < availableCsvLevels.length; i++) {
                    if (availableCsvLevels[i] > actualCsvLevel) {
                        const nextLevelWithQuestions = String(availableCsvLevels[i]);
                        if(quizDataByCsvLevel[nextLevelWithQuestions] && quizDataByCsvLevel[nextLevelWithQuestions].length > 0) {
                            actualCsvLevel = availableCsvLevels[i];
                            csvLevelKey = String(actualCsvLevel);
                            resetUnaskedQuestionsForCsvLevel(actualCsvLevel);
                            foundNext = true;
                            break;
                        }
                    }
                }
                if (!foundNext) { // No more questions in any higher CSV level, or no higher levels exist
                    if (maxCsvLevel > 0 && quizDataByCsvLevel[String(maxCsvLevel)]?.length > 0) {
                        // Fallback to highest CSV level and allow repeats.
                        actualCsvLevel = maxCsvLevel;
                        csvLevelKey = String(actualCsvLevel);
                        resetUnaskedQuestionsForCsvLevel(actualCsvLevel); // Refill highest
                        elements.currentLevelDisplay.textContent = `${currentGameDisplayLevel} (${actualCsvLevel}再)`;
                    } else {
                        showGameOver("全ての有効な問題が終了しました。"); return;
                    }
                }
            }
        }
        
        let pool = unaskedQuestionsByCsvLevel[csvLevelKey];
        if (!pool || pool.length === 0) { // If pool is still empty after trying to refill/find next
            showGameOver(`レベル ${csvLevelKey} の問題が取得できませんでした。`); return;
        }

        const randomIndex = Math.floor(Math.random() * pool.length);
        currentQuestion = pool.splice(randomIndex, 1)[0]; // Get and remove question

        elements.feedbackSection.classList.add('hidden'); elements.infoDetailsArea.classList.add('hidden'); elements.nextButton.classList.add('hidden');
        
        const wordToShow = currentQuestion.displayWords[Math.floor(Math.random() * currentQuestion.displayWords.length)];
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
            currentGameDisplayLevel++; // ★ Display Level up on correct answer ★
            elements.currentLevelDisplay.textContent = currentGameDisplayLevel; // Update display level
            elements.nextButton.classList.remove('hidden');
            
            // Prepare for next display level's questions; actual CSV level will be determined in displayNextQuestion
            const nextQueryLevel = getActualCsvLevelToQuery(currentGameDisplayLevel);
            if (quizDataByCsvLevel[String(nextQueryLevel)] && (!unaskedQuestionsByCsvLevel[String(nextQueryLevel)] || unaskedQuestionsByCsvLevel[String(nextQueryLevel)].length === 0)) {
                resetUnaskedQuestionsForCsvLevel(nextQueryLevel);
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

    // --- Perpetual, Sticky, Hardcore Chaos - Nandeya ONLY (LIGHTER VERSION from previous) ---
    function activateChaosMode() {
        if (isChaosModeActive) return; isChaosModeActive = true;
        disableGameControls();
        elements.feedbackMessage.innerHTML = `不正解！<br><span class="chaos-engage-text">調整版<span class="emphasis-red">「なんでや」</span>カオス、発動ッ！</span>`;
        
        triggerNandeyaElementsBatch(30); // Initial burst: 30 (Adjusted)

        if (chaosIntervalId) clearInterval(chaosIntervalId);
        chaosIntervalId = setInterval(() => {
            triggerNandeyaElementsBatch(10 + Math.floor(Math.random() * 10)); // Continuous: 10-19 elements (Adjusted)
        }, 1000); // Interval: every 1 second (Adjusted)
        requestAnimationFrame(updatePerformanceMonitorLoop);
    }

    function triggerNandeyaElementsBatch(numElements) {
        const DURATION_BASE = 14000; // Stickiness: long duration
        const DURATION_RANDOM_ADD = 9000;

        if (nandeyaPhrases.length === 0) nandeyaPhrases.push({text: "「なんでや」がないぞ！ゴルァ！", isEmphasized: true});
        
        const emphasizedPhrases = nandeyaPhrases.filter(p => p.isEmphasized);
        const normalPhrases = nandeyaPhrases.filter(p => !p.isEmphasized);

        for (let i = 0; i < numElements; i++) {
            let selectedPhraseObj;
            const emphasizeRoll = Math.random();
            // ★ "なんでや" 強調フレーズの出現率をさらに上げる (例: 70% chance) ★
            if (emphasizedPhrases.length > 0 && (emphasizeRoll < 0.7 || normalPhrases.length === 0)) {
                selectedPhraseObj = emphasizedPhrases[Math.floor(Math.random() * emphasizedPhrases.length)];
            } else if (normalPhrases.length > 0) {
                selectedPhraseObj = normalPhrases[Math.floor(Math.random() * normalPhrases.length)];
            } else {
                selectedPhraseObj = nandeyaPhrases[Math.floor(Math.random() * nandeyaPhrases.length)] || {text: "何故なんだ…", isEmphasized: true};
            }

            const duration = DURATION_BASE + Math.random() * DURATION_RANDOM_ADD;
            setTimeout(() => {
                createNandeyaElement(selectedPhraseObj.text, selectedPhraseObj.isEmphasized, duration);
            }, i * (250 / numElements) );
        }
    }

    function createNandeyaElement(text, isEmphasized, duration) {
        const el = document.createElement('div');
        el.classList.add('flying-element', 'flying-text');
        flyingElementCount++;

        if (isEmphasized) {
            el.classList.add('nandeya-emphasis');
             // ★ フォントサイズをより大きく、目立つように ★
            el.style.fontSize = `${2.5 + Math.random() * 2.5}em`; // Emphasized: 2.5em to 5.0em
            el.style.zIndex = (parseInt(el.style.zIndex || 5000) + 20).toString(); // Ensure truly on top
        } else {
            el.classList.add('general-rainbow-text');
            el.style.fontSize = `${1.0 + Math.random() * 1.2}em`; // Normal: 1.0em to 2.2em
        }
        el.textContent = text;
        
        const currentHue = (flyingElementHueStart + Math.random() * 120) % 360;
        flyingElementHueStart = (flyingElementHueStart + 8) % 360;

        el.style.setProperty('--base-hue', currentHue + 'deg');
        el.style.backgroundColor = `hsla(${currentHue}, 88%, ${10 + Math.random()*12}%, ${0.7 + Math.random()*0.25})`;
        el.style.border = `2px solid hsla(${(currentHue + Math.random()*45 -22.5) % 360}, 98%, ${55 + Math.random()*22}%, ${0.8 + Math.random()*0.18})`;
        
        if (!isEmphasized) {
            el.style.color = `hsl(${(currentHue + 180) % 360}, 100%, 88%)`;
            el.style.textShadow = `0 0 2px black, 0 0 4px black, 0 0 7px hsla(${(currentHue + 200)%360}, 100%, 65%, 0.8)`;
        } // Emphasized text color/shadow is handled by its CSS class

        document.body.appendChild(el);

        const screenW = window.innerWidth; const screenH = window.innerHeight;
        const elRect = el.getBoundingClientRect(); const elW = elRect.width; const elH = elRect.height;

        const animType = Math.random(); let keyframes;
        let animDuration = duration * (0.75 + Math.random() * 0.5); // Slightly shorter overall for more "active" feel
        let animEasing = `cubic-bezier(${Math.random()*0.3}, ${0.4 + Math.random()*0.5}, ${0.7 - Math.random()*0.3}, ${Math.random()*0.5 + 0.15})`;
        let iterations = Infinity; let direction = (Math.random() < 0.45 ? 'alternate-reverse' : 'normal');

        const startX = Math.random() * screenW - elW / 2;
        const startY = Math.random() * screenH - elH / 2;
        let endX, endY;

        const rotStart = Math.random() * 540 - 270; // More initial spin range
        let rotEnd = rotStart + (Math.random() > 0.5 ? 1 : -1) * (540 + Math.random() * 720); // More moderate total rotation

        // Movement patterns focused on "派手さ" and "こびりつき"
        if (animType < 0.1) { // Super Sticky, minimal movement, strong pulse/glitch from CSS
            endX = startX + (Math.random() * 15 - 7.5); endY = startY + (Math.random() * 15 - 7.5);
            rotEnd = rotStart + (Math.random() * 30 - 15); animDuration *= (2.0 + Math.random()); // Very slow
            animEasing = 'steps(3, jump-end)'; direction = 'alternate';
        } else if (animType < 0.35) { // Edge "Magnet" - Attracted to edges, then drifts slowly
            const edgeTargetRoll = Math.random();
            if(edgeTargetRoll < 0.25) { endX = Math.random() * elW - elW/2; endY = Math.random() * screenH; } // Left edge
            else if (edgeTargetRoll < 0.5) { endX = screenW - Math.random() * elW + elW/2; endY = Math.random() * screenH; } // Right edge
            else if (edgeTargetRoll < 0.75) { endX = Math.random() * screenW; endY = Math.random() * elH - elH/2; } // Top edge
            else { endX = Math.random() * screenW; endY = screenH - Math.random() * elH + elH/2; } // Bottom edge
            animDuration *= (1.4 + Math.random()*0.8); rotEnd = rotStart + (Math.random() * 60 - 30);
        } else { // Hyper Dynamic Chaos
            endX = Math.random() * screenW * 2.2 - screenW * 0.6; // Wider travel
            endY = Math.random() * screenH * 2.2 - screenH * 0.6;
        }
        
        const initialScale = 0.15 + Math.random() * 0.25; // Slightly larger initial for visibility
        const peakScale = isEmphasized ? (1.6 + Math.random() * 0.9) : (1.0 + Math.random() * 0.5);
        const finalPersistScale = isEmphasized ? (0.8 + Math.random()*0.5) : (0.55 + Math.random()*0.4);

        keyframes = [
            { transform: `translate(${startX}px, ${startY}px) scale(${initialScale}) rotate(${rotStart}deg)`, opacity: 0, filter: 'blur(12px) brightness(0.4)'},
            { transform: `translate(${startX + (endX-startX)*0.1}px, ${startY + (endY-startY)*0.1}px) scale(${peakScale}) rotate(${rotStart + (rotEnd - rotStart)*0.1}deg)`, opacity: 1, filter: 'blur(0px) brightness(1.15) saturate(1.6)', offset: 0.1 },
            { transform: `translate(${startX + (endX-startX)*0.5}px, ${startY + (endY-startY)*0.5}px) scale(${(peakScale + finalPersistScale) / (isEmphasized?1.7:2.1)}) rotate(${rotStart + (rotEnd - rotStart)*0.5}deg)`, opacity: 0.95, filter: `brightness(1.0) saturate(1.3) hue-rotate(${Math.random()*20-10}deg)`, offset: 0.3 + Math.random()*0.3 },
            { transform: `translate(${endX}px, ${endY}px) scale(${finalPersistScale}) rotate(${rotEnd}deg)`, opacity: 0.9 + Math.random()*0.1, filter: `brightness(0.9) saturate(1.1) hue-rotate(${Math.random()*40-20}deg)` }
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
        isChaosModeActive = false;
        document.querySelectorAll('.flying-element').forEach(fe => fe.remove());
        flyingElementCount = 0;
        enableGameControls();
        loadAndProcessCSV();
    });
    splitNandeyaText();
    loadAndProcessCSV();
});
