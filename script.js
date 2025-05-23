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
        answerLengthHint: document.getElementById('answer-length-hint-display'), // ★★★ ヒントエリア追加 ★★★
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
    let nandeyaBoostTimeoutId = null;
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

    // --- Nandeya Text Processing ---
    function splitNandeyaText() {
        nandeyaPhrases = []; const fullText = LONG_NANDEYA_TEXT_CONTENT;
        const emphasisKeyword = "なんでや"; const minL = 5; const maxL = 28;
        const sentences = fullText.split(new RegExp(`(${emphasisKeyword}[。、！？　…]*|[^${emphasisKeyword}。、！？　…]*[。、！？　…]+)`, 'g')).filter(Boolean);
        sentences.forEach(sentence => {
            let currentSentence = sentence.trim(); if (!currentSentence) return;
            const containsEmphasis = currentSentence.includes(emphasisKeyword);
            if (containsEmphasis && currentSentence.startsWith(emphasisKeyword)) {
                let emphasizedPhrase = currentSentence;
                if (emphasizedPhrase.length > maxL + emphasisKeyword.length) { const nandeyaIndex = emphasizedPhrase.indexOf(emphasisKeyword); emphasizedPhrase = emphasizedPhrase.substring(0, nandeyaIndex + emphasisKeyword.length + Math.floor(Math.random() * 10 + 5)).trim(); }
                if (emphasizedPhrase.length < minL && emphasizedPhrase !== emphasisKeyword) emphasizedPhrase = emphasisKeyword;
                nandeyaPhrases.push({ text: emphasizedPhrase, isEmphasized: true });
            } else {
                let remainingNormalText = currentSentence;
                while (remainingNormalText.length > 0) {
                    let phraseLength = Math.floor(Math.random() * (maxL - minL + 1)) + minL;
                    let currentNormalPhrase = remainingNormalText.substring(0, Math.min(phraseLength, remainingNormalText.length));
                    let cutPoint = -1; const punctuation = /[。、！？　…]/g; let match;
                    while ((match = punctuation.exec(currentNormalPhrase)) !== null) { if (match.index > minL / 2 && match.index < currentNormalPhrase.length -1) cutPoint = match.index; }
                    if (cutPoint !== -1) currentNormalPhrase = currentNormalPhrase.substring(0, cutPoint + 1);
                    const finalNormalPhrase = currentNormalPhrase.trim();
                    if (finalNormalPhrase) nandeyaPhrases.push({ text: finalNormalPhrase, isEmphasized: finalNormalPhrase.includes(emphasisKeyword) });
                    remainingNormalText = remainingNormalText.substring(currentNormalPhrase.length).trim();
                    if (currentNormalPhrase.length === 0 && remainingNormalText.length > 0) { const sp = remainingNormalText.substring(0, Math.min(remainingNormalText.length,maxL)); nandeyaPhrases.push({text:sp, isEmphasized: sp.includes(emphasisKeyword)}); remainingNormalText=""; }
                }
            }
        });
        if (nandeyaPhrases.length === 0 && LONG_NANDEYA_TEXT_CONTENT) { const fp = LONG_NANDEYA_TEXT_CONTENT.substring(0,maxL); nandeyaPhrases.push({ text: fp.trim(), isEmphasized: fp.includes(emphasisKeyword) }); }
        if (LONG_NANDEYA_TEXT_CONTENT.includes(emphasisKeyword) && !nandeyaPhrases.some(p => p.isEmphasized && p.text.includes(emphasisKeyword))) { nandeyaPhrases.push({ text: emphasisKeyword, isEmphasized: true }); }
    }

    // --- Data Loading & Processing ---
    async function loadAndProcessCSV() {
        elements.loadingDisplay.classList.remove('hidden'); elements.questionSection.classList.add('hidden'); elements.feedbackSection.classList.add('hidden'); elements.gameOverSection.classList.add('hidden');
        try { const r = await fetch(csvFilePath); if (!r.ok) throw new Error(`CSV Load: ${r.status} ${r.statusText}`); const t = await r.text();
            Papa.parse(t, { header: true, skipEmptyLines: true, complete: (results) => { if (results.errors.length > 0) console.warn("CSV Parse Warnings:", results.errors); processQuizData(results.data); if (availableCsvLevels.length > 0) startGame(); else elements.loadingDisplay.innerHTML = "<p>Error: No valid quiz data levels found.</p>"; }, error: (err) => { console.error("CSV Parse Error:", err); elements.loadingDisplay.innerHTML = `<p>Fatal CSV Parse Error: ${err.message}</p>`; } });
        } catch (e) { console.error("CSV Fetch Error:", e); elements.loadingDisplay.innerHTML = `<p>Fatal CSV Load Error: ${e.message}</p>`; }
    }

    function processQuizData(rawData) {
        const tempQuizDataByCsvLevel = {}; rawData.forEach(row => { if (!row['単語']?.trim() || !row['レベル']?.trim() || !row['問題ID']?.trim()) return; const problemId = row['問題ID'].trim(); const csvLevel = parseInt(row['レベル'], 10); if (isNaN(csvLevel)) return; if (!tempQuizDataByCsvLevel[csvLevel]) tempQuizDataByCsvLevel[csvLevel] = {}; if (!tempQuizDataByCsvLevel[csvLevel][problemId]) tempQuizDataByCsvLevel[csvLevel][problemId] = { id: problemId, csvLevel: csvLevel, displayWords: new Set(), answers: new Set(), meanings: new Set(), notes: new Set(), otherSpellingsFromColumn: new Set() }; const entry = tempQuizDataByCsvLevel[csvLevel][problemId]; entry.displayWords.add(row['単語'].trim()); entry.answers.add(row['読み方']?.trim()||''); if(row['別解']?.trim())row['別解'].trim().split(/[/／、。・\s]+/).forEach(a=>{if(a)entry.answers.add(a.trim());}); if(row['意味']?.trim())entry.meanings.add(row['意味'].trim()); if(row['追記']?.trim())entry.notes.add(row['追記'].trim()); if(row['別表記']?.trim())entry.otherSpellingsFromColumn.add(row['別表記'].trim()); });
        quizDataByCsvLevel={}; for(const level in tempQuizDataByCsvLevel)quizDataByCsvLevel[level]=Object.values(tempQuizDataByCsvLevel[level]).map(item=>({...item,displayWords:Array.from(item.displayWords),answers:Array.from(item.answers).filter(Boolean),meanings:Array.from(item.meanings).join(' <br> '),notes:Array.from(item.notes).join(' <br> '),otherSpellingsFromColumn:Array.from(item.otherSpellingsFromColumn)}));
        availableCsvLevels=Object.keys(quizDataByCsvLevel).map(Number).sort((a,b)=>a-b); if(availableCsvLevels.length>0)maxCsvLevel=availableCsvLevels[availableCsvLevels.length-1];
    }
    
    function resetUnaskedQuestionsForCsvLevel(csvLevel) { const levelKey=String(csvLevel); if(quizDataByCsvLevel[levelKey])unaskedQuestionsByCsvLevel[levelKey]=[...quizDataByCsvLevel[levelKey]]; else unaskedQuestionsByCsvLevel[levelKey]=[]; }

    // --- Game Logic ---
    function startGame() {
        score=0; currentGameDisplayLevel=1; if(availableCsvLevels.length>0&&!availableCsvLevels.includes(1))currentGameDisplayLevel=availableCsvLevels[0];
        elements.currentLevelDisplay.textContent=currentGameDisplayLevel; availableCsvLevels.forEach(level=>resetUnaskedQuestionsForCsvLevel(level));
        updateScoreDisplay(); elements.gameOverSection.classList.add('hidden'); elements.feedbackSection.classList.add('hidden');
        elements.loadingDisplay.classList.add('hidden'); elements.questionSection.classList.remove('hidden');
        enableGameControls(); displayNextQuestion();
    }

    function getActualCsvLevelToQuery(targetDisplayLevel) {
        if (quizDataByCsvLevel[String(targetDisplayLevel)] && quizDataByCsvLevel[String(targetDisplayLevel)].length > 0) {
            if (!unaskedQuestionsByCsvLevel[String(targetDisplayLevel)] || unaskedQuestionsByCsvLevel[String(targetDisplayLevel)].length === 0) resetUnaskedQuestionsForCsvLevel(targetDisplayLevel);
            if (unaskedQuestionsByCsvLevel[String(targetDisplayLevel)].length > 0) return targetDisplayLevel;
        }
        for (let i=targetDisplayLevel; i>=1; i--) { if (availableCsvLevels.includes(i) && quizDataByCsvLevel[String(i)] && quizDataByCsvLevel[String(i)].length > 0) { if (!unaskedQuestionsByCsvLevel[String(i)] || unaskedQuestionsByCsvLevel[String(i)].length === 0) resetUnaskedQuestionsForCsvLevel(i); if (unaskedQuestionsByCsvLevel[String(i)].length > 0) return i; }}
        return availableCsvLevels.length > 0 ? availableCsvLevels[0] : -1;
    }

    function displayNextQuestion() {
        if (isChaosModeActive) return;
        let actualCsvLevelForQuery = getActualCsvLevelToQuery(currentGameDisplayLevel);
        let csvLevelKey = String(actualCsvLevelForQuery);
        elements.currentLevelDisplay.textContent = currentGameDisplayLevel;
        if (actualCsvLevelForQuery !== -1 && actualCsvLevelForQuery !== currentGameDisplayLevel) elements.currentLevelDisplay.textContent = `${currentGameDisplayLevel} (問題Lv: ${actualCsvLevelForQuery})`;
        if (actualCsvLevelForQuery === -1 || !quizDataByCsvLevel[csvLevelKey]) { showGameOver("適切な問題レベルが見つかりません。"); return; }
        if (!unaskedQuestionsByCsvLevel[csvLevelKey] || unaskedQuestionsByCsvLevel[csvLevelKey].length === 0) resetUnaskedQuestionsForCsvLevel(actualCsvLevelForQuery);
        let pool = unaskedQuestionsByCsvLevel[csvLevelKey];
        if (!pool || pool.length === 0) { if (maxCsvLevel > 0 && quizDataByCsvLevel[String(maxCsvLevel)]?.length > 0) { actualCsvLevelForQuery = maxCsvLevel; csvLevelKey = String(actualCsvLevelForQuery); resetUnaskedQuestionsForCsvLevel(actualCsvLevelForQuery); pool = unaskedQuestionsByCsvLevel[csvLevelKey]; elements.currentLevelDisplay.textContent = `${currentGameDisplayLevel} (問題Lv: ${actualCsvLevelForQuery} 再)`; } if (!pool || pool.length === 0) { showGameOver("問題データ枯渇。"); return; }}
        const randomIndex = Math.floor(Math.random()*pool.length); currentQuestion = pool.splice(randomIndex,1)[0];
        elements.feedbackSection.classList.add('hidden'); elements.infoDetailsArea.classList.add('hidden'); elements.nextButton.classList.add('hidden');
        const wordToShow = currentQuestion.displayWords[Math.floor(Math.random()*currentQuestion.displayWords.length)];
        elements.kanjiDisplay.textContent = wordToShow;
        elements.imageContainer.innerHTML = `<img src="${STONE_IMAGE_FILENAME}" alt="Stylized Stone">`;
        
        // ★★★ 文字数ヒント表示ロジック ★★★
        let hintText = "";
        elements.answerLengthHint.classList.add('hidden'); // Hide initially
        if (currentQuestion.answers && currentQuestion.answers.length > 0) {
            const normalizedAnswers = currentQuestion.answers.map(ans => normalizeAnswer(ans)).filter(ans => ans.length > 0);
            if (normalizedAnswers.length > 0) {
                let lengthForHint = normalizedAnswers.reduce((min, ans) => Math.min(min, ans.length), Infinity);
                if (lengthForHint === Infinity) lengthForHint = 0; // Should not happen if normalizedAnswers not empty
                
                for (let i = 0; i < lengthForHint; i++) {
                    hintText += "〇";
                }
                elements.answerLengthHint.textContent = hintText;
                if (hintText) elements.answerLengthHint.classList.remove('hidden');
            }
        }
        // ★★★ ここまでヒント表示ロジック ★★★

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
        elements.answerLengthHint.classList.add('hidden'); // Hide hint after answer

        if(isCorrect){
            elements.feedbackMessage.textContent="正解！"; elements.feedbackMessage.className='message-feedback correct';
            score+=10; currentGameDisplayLevel++; elements.currentLevelDisplay.textContent = currentGameDisplayLevel;
            elements.nextButton.classList.remove('hidden');
            const nextQueryLevel = getActualCsvLevelToQuery(currentGameDisplayLevel);
            if (quizDataByCsvLevel[String(nextQueryLevel)] && (!unaskedQuestionsByCsvLevel[String(nextQueryLevel)] || unaskedQuestionsByCsvLevel[String(nextQueryLevel)].length === 0)) {
                resetUnaskedQuestionsForCsvLevel(nextQueryLevel);
            }
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
    function showGameOver(message = "ゲームオーバー") { if(isChaosModeActive)return; elements.questionSection.classList.add('hidden');elements.feedbackSection.classList.add('hidden'); elements.gameOverSection.classList.remove('hidden'); elements.gameOverSection.querySelector('h2').textContent = message; elements.finalScoreDisplay.textContent=score; }
    
    function disableGameControls() {
        elements.answerInput.disabled = true; elements.submitButton.disabled = true;
        elements.nextButton.disabled = true; elements.restartButton.disabled = true;
        let overlay = document.getElementById('chaos-active-overlay');
        if (!overlay) { overlay = document.createElement('div'); overlay.id = 'chaos-active-overlay'; overlay.classList.add('chaos-active-overlay'); document.body.appendChild(overlay); }
        overlay.classList.remove('hidden');
    }
    function enableGameControls() {
        elements.answerInput.disabled=false;elements.submitButton.disabled=false;
        elements.nextButton.classList.add('hidden'); elements.restartButton.disabled=false;
        const overlay = document.getElementById('chaos-active-overlay');
        if (overlay) overlay.classList.add('hidden');
    }

    // --- Perpetual, Sticky, Hardcore Chaos - Nandeya ONLY (Adjusted for phrase balance & 15s Boost) ---
    function activateChaosMode() {
        if (isChaosModeActive) return; isChaosModeActive = true;
        disableGameControls();
        elements.feedbackMessage.innerHTML = `不正解…！<br><span class="chaos-engage-text">「なんでや」<span class="emphasis-red">永久</span>カオス開始！ (15秒後にブースト)</span>`;
        
        triggerNandeyaElementsBatch(30); // Initial burst: 30 (Balanced)

        if (chaosIntervalId) clearInterval(chaosIntervalId);
        chaosIntervalId = setInterval(() => {
            triggerNandeyaElementsBatch(10 + Math.floor(Math.random() * 11)); // Continuous: 10-20 elements
        }, 800); // Interval: every 0.8 seconds (Balanced)

        if (nandeyaBoostTimeoutId) clearTimeout(nandeyaBoostTimeoutId);
        nandeyaBoostTimeoutId = setTimeout(() => {
            if (isChaosModeActive) {
                console.log("Executing 15-second Nandeya EMPHASIS Boost!");
                elements.feedbackMessage.innerHTML += `<br><span style="color:var(--tertiary-accent); animation: pulseCorrect 0.8s infinite ease-in-out;">「なんでや」ブースト執行ッ！！</span>`;
                triggerNandeyaElementsBatch(35 + Math.floor(Math.random() * 16), true); // Add 35-50 EXCLUSIVELY emphasized Nandeya phrases
            }
        }, 15000);

        requestAnimationFrame(updatePerformanceMonitorLoop);
    }

    function triggerNandeyaElementsBatch(numElements, emphasizedOnly = false) {
        const DURATION_BASE = 15000; const DURATION_RANDOM_ADD = 10000;
        if (nandeyaPhrases.length === 0) nandeyaPhrases.push({text: "「なんでや」データ不足！", isEmphasized: true});
        
        const emphasizedAvailable = nandeyaPhrases.filter(p => p.isEmphasized);
        const normalAvailable = nandeyaPhrases.filter(p => !p.isEmphasized);

        for (let i = 0; i < numElements; i++) {
            let selectedPhraseObj;
            if (emphasizedOnly) { // For the 15-second boost
                if (emphasizedAvailable.length > 0) selectedPhraseObj = emphasizedAvailable[Math.floor(Math.random() * emphasizedAvailable.length)];
                else selectedPhraseObj = {text: "なんでやブースト！", isEmphasized: true}; // Fallback for boost
            } else { // Normal batch generation logic
                const emphasizeRoll = Math.random();
                // ★ "なんでや" 強調フレーズの出現率 約40% (ブーストがあるので通常時は少し抑えめ) ★
                if (emphasizedAvailable.length > 0 && (emphasizeRoll < 0.4 || normalAvailable.length === 0)) {
                    selectedPhraseObj = emphasizedAvailable[Math.floor(Math.random() * emphasizedAvailable.length)];
                } else if (normalAvailable.length > 0) {
                    selectedPhraseObj = normalAvailable[Math.floor(Math.random() * normalAvailable.length)];
                } else if (emphasizedAvailable.length > 0) { // Fallback if normal exhausted
                    selectedPhraseObj = emphasizedAvailable[Math.floor(Math.random() * emphasizedAvailable.length)];
                } else {
                    selectedPhraseObj = {text: "何故？…なんでや…", isEmphasized: true};
                }
            }

            const duration = DURATION_BASE + Math.random() * DURATION_RANDOM_ADD;
            setTimeout(() => {
                createNandeyaElement(selectedPhraseObj.text, selectedPhraseObj.isEmphasized, duration);
            }, i * (180 / numElements) );
        }
    }

    function createNandeyaElement(text, isEmphasized, duration) {
        const el = document.createElement('div');
        el.classList.add('flying-element', 'flying-text');
        flyingElementCount++;

        if (isEmphasized) {
            el.classList.add('nandeya-emphasis');
            el.style.fontSize = `${2.2 + Math.random() * 2.5}em`; // Emphasized: 2.2em to 4.7em
            el.style.zIndex = (parseInt(el.style.zIndex || 5000) + Math.floor(12 + Math.random()*12)).toString();
        } else {
            el.classList.add('general-rainbow-text');
            // ★ 通常フレーズのフォントサイズを確保 ★
            el.style.fontSize = `${1.3 + Math.random() * 1.0}em`; // Normal: 1.3em to 2.3em
        }
        el.textContent = text;
        
        const currentHue = (flyingElementHueStart + Math.random() * 160) % 360;
        flyingElementHueStart = (flyingElementHueStart + 6) % 360;

        el.style.setProperty('--base-hue', currentHue + 'deg');
        el.style.backgroundColor = `hsla(${currentHue}, 88%, ${9 + Math.random()*11}%, ${0.7 + Math.random()*0.23})`;
        el.style.border = `2px solid hsla(${(currentHue + Math.random()*48 -24) % 360}, 98%, ${53 + Math.random()*21}%, ${0.8 + Math.random()*0.16})`;
        
        // Text color & shadow for nandeya-emphasis is handled by its CSS class.
        // For general-rainbow-text, CSS handles hue-rotate, but we can set a base readable color.
        if (!isEmphasized) {
            el.style.color = `hsl(${(currentHue + 180) % 360}, 100%, 87%)`;
            el.style.textShadow = `0 0 1.5px black, 0 0 3px black, 0 0 5.5px hsla(${(currentHue + 195)%360}, 100%, 63%, 0.78)`;
        }

        document.body.appendChild(el);

        const screenW = window.innerWidth; const screenH = window.innerHeight;
        const elRect = el.getBoundingClientRect(); const elW = elRect.width; const elH = elRect.height;

        const animType = Math.random(); let keyframes;
        let animDuration = duration * (0.8 + Math.random() * 0.45);
        let animEasing = `cubic-bezier(${Math.random()*0.28}, ${0.41 + Math.random()*0.49}, ${0.72 - Math.random()*0.28}, ${Math.random()*0.49 + 0.11})`;
        let iterations = Infinity; let direction = (Math.random() < 0.43 ? 'alternate-reverse' : 'normal');

        const startX = Math.random() * screenW - elW / 2; const startY = Math.random() * screenH - elH / 2;
        let endX, endY;
        const rotStart = Math.random() * 630 - 315; let rotEnd = rotStart + (Math.random() > 0.5 ? 1:-1) * (630 + Math.random()*750);

        if (animType < 0.1) { // Super Sticky
            endX = startX + (Math.random()*20-10); endY = startY + (Math.random()*20-10); rotEnd = rotStart + (Math.random()*28-14); animDuration*=(1.8+Math.random()*1.0); animEasing='steps(3,end)'; direction='alternate';
        } else if (animType < 0.36) { // Edge Loiterer
            const edge=Math.floor(Math.random()*4);
            if(edge===0){endX=Math.random()*screenW;endY=Math.random()*elH*0.25-elH*0.1;} else if(edge===1){endX=screenW-Math.random()*elW*0.25+elW*0.1;endY=Math.random()*screenH;} else if(edge===2){endX=Math.random()*screenW;endY=screenH-Math.random()*elH*0.25+elH*0.1;} else{endX=Math.random()*elW*0.25-elW*0.1;endY=Math.random()*screenH;}
            animDuration*=(1.3+Math.random()*0.65); rotEnd=rotStart+(Math.random()*48-24);
        } else { // Dynamic Chaos
            endX = Math.random()*screenW*1.85-screenW*0.42; endY = Math.random()*screenH*1.85-screenH*0.42;
        }
        
        const initialScale = 0.17 + Math.random()*0.23;
        const peakScale = isEmphasized ? (1.45 + Math.random()*0.7) : (0.92 + Math.random()*0.42);
        const finalPersistScale = isEmphasized ? (0.76 + Math.random()*0.42) : (0.51 + Math.random()*0.31);

        keyframes = [
            { transform: `translate(${startX}px, ${startY}px) scale(${initialScale}) rotate(${rotStart}deg)`, opacity: 0, filter: 'blur(12px) brightness(0.45)'},
            { transform: `translate(${startX + (endX-startX)*0.09}px, ${startY + (endY-startY)*0.09}px) scale(${peakScale}) rotate(${rotStart + (rotEnd - rotStart)*0.09}deg)`, opacity: 1, filter: 'blur(0px) brightness(1.16) saturate(1.65)', offset: 0.095 },
            { transform: `translate(${startX + (endX-startX)*0.5}px, ${startY + (endY-startY)*0.5}px) scale(${(peakScale + finalPersistScale) / (isEmphasized?1.68:2.08)}) rotate(${rotStart + (rotEnd - rotStart)*0.5}deg)`, opacity: 0.955, filter: `brightness(1.01) saturate(1.32) hue-rotate(${Math.random()*24-12}deg)`, offset: 0.36 + Math.random()*0.23 },
            { transform: `translate(${endX}px, ${endY}px) scale(${finalPersistScale}) rotate(${rotEnd}deg)`, opacity: 0.89 + Math.random()*0.11, filter: `brightness(0.93) saturate(1.16) hue-rotate(${Math.random()*48-24}deg)` }
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
