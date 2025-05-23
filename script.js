document.addEventListener('DOMContentLoaded', () => {
    // --- Game Configuration & User Text ---
    const LONG_NANDEYA_TEXT_CONTENT = '相当偏差値の高い高校（身の丈に合ってない）に通っています。高三なのですが未だにアルファベットが読めないことやadhdっぽいことに悩んで親に土下座してwais受けさせてもらいました。知覚推理144言語理解142ワーキングメモリ130処理速度84でした。　総合は覚えてないですが多分139とかだったはずです。ウィスクの年齢なのにウェイス受けさせられた。なんでや';
    let nandeyaPhrases = []; // Array of objects: { text: "phrase", isEmphasized: boolean }
    const STONE_IMAGE_FILENAME = 'stone.png'; // All images will be this

    // --- HTML Element Cache & Validation ---
    const elements = {
        performanceMonitor: document.getElementById('performance-monitor'), // For FPS and element count
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
        currentLevelDisplay: document.getElementById('current-level'),
        currentScoreDisplay: document.getElementById('current-score'),
        finalScoreDisplay: document.getElementById('final-score-value')
    };
    for (const key in elements) { if (!elements[key]) { const e=`FATAL ERROR: UI Element '${key}' not found. Check HTML IDs.`; console.error(e); if(document.body)document.body.innerHTML=`<p style="color:red;font-size:24px;padding:30px; text-align:center;">${e}</p>`; return; }}

    // --- Game State & Chaos Control ---
    let allQuizData = [];
    let currentQuestionIndex = 0;
    let score = 0;
    let currentProcessedLevel = -1;
    const csvFilePath = 'ankiDeck.csv';
    let chaosIntervalId = null;
    let isChaosModeActive = false;
    let flyingElementHueStart = Math.random() * 360;
    let flyingElementCount = 0; // For performance monitor

    // --- Performance Monitor (Simple FPS and Element Count) ---
    let lastFrameTime = performance.now();
    let frameCount = 0;
    function updatePerformanceMonitor() {
        frameCount++;
        const now = performance.now();
        if (now - lastFrameTime >= 1000) {
            const fps = Math.round((frameCount * 1000) / (now - lastFrameTime));
            elements.performanceMonitor.textContent = `FPS: ${fps} | Elements: ${flyingElementCount}`;
            frameCount = 0;
            lastFrameTime = now;
        }
        if (isChaosModeActive || document.querySelectorAll('.flying-element').length > 0) { // Only request if active elements
            requestAnimationFrame(updatePerformanceMonitor);
        }
    }
    requestAnimationFrame(updatePerformanceMonitor); // Start monitoring


    // --- Nandeya Text Processing (with emphasis flag) ---
    function splitNandeyaText() {
        const minL = 6; const maxL = 30; let txt = LONG_NANDEYA_TEXT_CONTENT; nandeyaPhrases = [];
        const emphasisKeyword = "なんでや";
        const emphasisRegex = new RegExp(emphasisKeyword, "g");

        while (txt.length > 0) {
            let len = Math.floor(Math.random() * (maxL - minL + 1)) + minL;
            let p = txt.substring(0, Math.min(len, txt.length));
            let cut = -1;
            ['。', '、', ' ', '　', '！', '？', '（', '）', ')', '(', '「', '」', '・', '…'].forEach(char => {
                let i = p.lastIndexOf(char);
                if (i > p.length / 2.5 && i > cut) cut = i; // Prefer cuts towards end
            });

            if (cut !== -1 && txt.length > cut + 1) p = txt.substring(0, cut + 1);
            else if (txt.length <= maxL * 1.3) p = txt;
            
            const trimmedPhrase = p.trim();
            if (trimmedPhrase) {
                nandeyaPhrases.push({
                    text: trimmedPhrase,
                    isEmphasized: emphasisRegex.test(trimmedPhrase) // Check if "なんでや" is present
                });
            }
            txt = txt.substring(p.length);
            if (p.length === 0 && txt.length > 0) {
                const safetyPhrase = txt.substring(0, Math.min(txt.length, maxL));
                nandeyaPhrases.push({ text: safetyPhrase.trim(), isEmphasized: emphasisRegex.test(safetyPhrase) });
                txt = ""; // Break infinite loop
            }
        }
        if (nandeyaPhrases.length === 0 && LONG_NANDEYA_TEXT_CONTENT) { // Fallback
            const fallbackPhrase = LONG_NANDEYA_TEXT_CONTENT.substring(0, maxL);
            nandeyaPhrases.push({ text: fallbackPhrase.trim(), isEmphasized: emphasisRegex.test(fallbackPhrase) });
        }
    }

    // --- Data Loading & Processing ---
    async function loadAndProcessCSV() {
        elements.loadingDisplay.classList.remove('hidden'); elements.questionSection.classList.add('hidden'); elements.feedbackSection.classList.add('hidden'); elements.gameOverSection.classList.add('hidden');
        try { const r = await fetch(csvFilePath); if (!r.ok) throw new Error(`CSV File Load Error: ${r.status} ${r.statusText}`); const t = await r.text();
            Papa.parse(t, { header: true, skipEmptyLines: true, complete: (res) => { if (res.errors.length > 0) { console.warn("CSV Parsing Warnings:", res.errors); } processQuizData(res.data); if (allQuizData.length > 0) { startGame(); } else { elements.loadingDisplay.innerHTML = "<p>Error: No valid quiz data found in CSV.</p>"; } }, error: (err) => { console.error("CSV Parsing Error:", err); elements.loadingDisplay.innerHTML = `<p>Fatal Error Parsing CSV: ${err.message}</p>`; } });
        } catch (e) { console.error("CSV Fetch Error:", e); elements.loadingDisplay.innerHTML = `<p>Fatal Error Loading CSV: ${e.message}</p>`; }
    }

    function processQuizData(rawData) {
        const map=new Map(); rawData.forEach(r=>{if(!r['単語']?.trim()||!r['レベル']?.trim()||!r['問題ID']?.trim())return;const id=r['問題ID'].trim();if(!map.has(id))map.set(id,{id,level:parseInt(r['レベル'],10),displayWords:new Set(),answers:new Set(),meanings:new Set(),notes:new Set(),otherSpellingsFromColumn:new Set()});const e=map.get(id);e.displayWords.add(r['単語'].trim());e.answers.add(r['読み方']?.trim()||'');if(r['別解']?.trim())r['別解'].trim().split(/[/／、。・\s]+/).forEach(a=>{if(a)e.answers.add(a.trim());});if(r['意味']?.trim())e.meanings.add(r['意味'].trim());if(r['追記']?.trim())e.notes.add(r['追記'].trim());if(r['別表記']?.trim())e.otherSpellingsFromColumn.add(r['別表記'].trim());});
        allQuizData=Array.from(map.values()).map(i=>({...i,displayWords:Array.from(i.displayWords),answers:Array.from(i.answers).filter(Boolean),meanings:Array.from(i.meanings).join(' <br> '),notes:Array.from(i.notes).join(' <br> '),otherSpellingsFromColumn:Array.from(i.otherSpellingsFromColumn)}));
        allQuizData.sort((a,b)=>a.level-b.level||a.id.localeCompare(b.id));
    }

    // --- Game Logic ---
    function startGame() {
        currentQuestionIndex=0;score=0;currentProcessedLevel=-1;updateScoreDisplay();elements.gameOverSection.classList.add('hidden');elements.feedbackSection.classList.add('hidden');elements.loadingDisplay.classList.add('hidden');elements.questionSection.classList.remove('hidden');enableGameControls();displayNextQuestion();
    }

    function displayNextQuestion() {
        if (isChaosModeActive) return; // Chaos mode active, no more questions
        if (currentQuestionIndex >= allQuizData.length) { showGameOver(); return; }
        elements.feedbackSection.classList.add('hidden'); elements.infoDetailsArea.classList.add('hidden'); elements.nextButton.classList.add('hidden');
        const q = allQuizData[currentQuestionIndex];
        if (q.level !== currentProcessedLevel) { currentProcessedLevel = q.level; elements.currentLevelDisplay.textContent = currentProcessedLevel; }
        const word = q.displayWords[Math.floor(Math.random() * q.displayWords.length)];
        elements.kanjiDisplay.textContent = word;
        elements.imageContainer.innerHTML = `<img src="${STONE_IMAGE_FILENAME}" alt="Stylized Stone">`; // ALWAYS stone.png
        elements.answerInput.value = ''; elements.answerInput.disabled = false; elements.submitButton.disabled = false; elements.answerInput.focus();
    }

    function handleSubmit() {
        if(elements.answerInput.disabled && !isChaosModeActive) return;
        const userAnswer = elements.answerInput.value.trim();
        const currentQuestion = allQuizData[currentQuestionIndex];
        let isCorrect = false;

        if(!isChaosModeActive){ // Only check answer if not in chaos mode
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
            elements.nextButton.classList.remove('hidden');
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
        if(isCorrect && !isChaosModeActive) currentQuestionIndex++; // Only advance if correct and not in chaos
    }
    
    function normalizeAnswer(str) { if(!str)return"";return str.normalize('NFKC').toLowerCase().replace(/[\u30a1-\u30f6]/g,m=>String.fromCharCode(m.charCodeAt(0)-0x60)).replace(/\s+/g,''); }
    function updateScoreDisplay() { elements.currentScoreDisplay.textContent = score; }
    function showGameOver() { if(isChaosModeActive)return; elements.questionSection.classList.add('hidden');elements.feedbackSection.classList.add('hidden');elements.gameOverSection.classList.remove('hidden');elements.finalScoreDisplay.textContent=score; }
    
    function disableGameControls() {
        elements.answerInput.disabled = true;
        elements.submitButton.disabled = true;
        elements.nextButton.disabled = true;
        elements.restartButton.disabled = true;
        let overlay = document.getElementById('chaos-active-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'chaos-active-overlay';
            overlay.classList.add('chaos-active-overlay');
            document.body.appendChild(overlay); // Append to body to ensure it covers everything
        }
        overlay.classList.remove('hidden'); // Make sure it's visible
    }
    function enableGameControls() {
        elements.answerInput.disabled=false;elements.submitButton.disabled=false;elements.nextButton.classList.add('hidden');elements.restartButton.disabled=false;
        const overlay = document.getElementById('chaos-active-overlay');
        if (overlay) overlay.classList.add('hidden'); // Hide instead of remove, to reuse
    }

    // --- Perpetual, Sticky, Hardcore Chaos - Nandeya ONLY ---
    function activateChaosMode() {
        if (isChaosModeActive) return;
        isChaosModeActive = true;
        disableGameControls();
        
        triggerNandeyaElementsBatch(100); // ★★★ EVEN MORE MASSIVE initial burst ★★★

        if (chaosIntervalId) clearInterval(chaosIntervalId);
        chaosIntervalId = setInterval(() => {
            triggerNandeyaElementsBatch(30 + Math.floor(Math.random() * 30)); // Continuously add 30-59 more
        }, 350); // ★★★ Add new batch every 0.35 seconds - INSANELY AGGRESSIVE ★★★
        requestAnimationFrame(updatePerformanceMonitor); // Restart FPS counter if it stopped
    }

    function triggerNandeyaElementsBatch(numElements) {
        const DURATION_BASE = 20000; // Longer base for extreme stickiness
        const DURATION_RANDOM_ADD = 15000;

        if (nandeyaPhrases.length === 0) {
            nandeyaPhrases.push({text: "「なんでや」の準備がまだや！", isEmphasized: true});
        }

        for (let i = 0; i < numElements; i++) {
            const selectedPhraseObj = nandeyaPhrases[Math.floor(Math.random() * nandeyaPhrases.length)];
            const duration = DURATION_BASE + Math.random() * DURATION_RANDOM_ADD;
            setTimeout(() => {
                createNandeyaElement(selectedPhraseObj.text, selectedPhraseObj.isEmphasized, duration);
            }, i * (100 / numElements) ); // Spread out creation over 0.1s for a batch
        }
    }

    function createNandeyaElement(text, isEmphasized, duration) {
        const el = document.createElement('div');
        el.classList.add('flying-element', 'flying-text');
        flyingElementCount++; // Increment for monitor

        if (isEmphasized) {
            el.classList.add('nandeya-emphasis');
            el.style.fontSize = `${2.2 + Math.random() * 3.3}em`; // 2.2em to 5.5em - VERY LARGE
            el.style.zIndex = (parseInt(el.style.zIndex || 50000) + 10).toString(); // Emphasized on top of others
        } else {
            el.classList.add('general-rainbow-text');
            el.style.fontSize = `${1.0 + Math.random() * 1.5}em`; // 1.0em to 2.5em - Readable but varied
        }
        el.textContent = text;
        
        const currentHue = (flyingElementHueStart + Math.random() * 220) % 360;
        flyingElementHueStart = (flyingElementHueStart + 2.5) % 360; // Slower overall shift for more variety

        el.style.setProperty('--base-hue', currentHue + 'deg'); // For CSS var use if any
        el.style.backgroundColor = `hsla(${currentHue}, 90%, ${5 + Math.random()*10}%, ${0.6 + Math.random()*0.3})`;
        el.style.border = `2px solid hsla(${(currentHue + Math.random()*60 -30) % 360}, 100%, ${55 + Math.random()*25}%, ${0.7 + Math.random()*0.2})`;
        el.style.color = `hsl(${(currentHue + 180 + Math.random()*60-30) % 360}, 100%, ${80 + Math.random()*10}%)`;
        el.style.textShadow = `0 0 1px black, 0 0 3px black, 0 0 5px hsla(${(currentHue + 200)%360}, 100%, 60%, 0.9), 0 0 10px hsla(${(currentHue + 200)%360}, 100%, 60%, 0.6)`;

        document.body.appendChild(el); // Append to body to fly over everything

        const screenW = window.innerWidth;
        const screenH = window.innerHeight;
        const elRect = el.getBoundingClientRect(); // Get size after appending and styling
        const elW = elRect.width;
        const elH = elRect.height;

        // "ねちっこくハードでこびりつく" - More varied and sticky movements
        const animType = Math.random();
        let keyframes;
        let animDuration = duration * (0.8 + Math.random() * 1.2); // Vary duration significantly
        let animEasing = `cubic-bezier(${Math.random()*0.3}, ${0.4 + Math.random()*0.6}, ${0.7 - Math.random()*0.3}, ${Math.random()*0.5 + 0.1})`;
        let iterations = Infinity;
        let direction = (Math.random() < 0.4 ? 'alternate' : 'normal');

        const startX = Math.random() * screenW - elW / 2;
        const startY = Math.random() * screenH - elH / 2;
        let endX, endY;

        const rotStart = Math.random() * 1080 - 540; // Extreme start rotation
        let rotEnd = rotStart + (Math.random() > 0.5 ? 1 : -1) * (1080 + Math.random() * 2160); // Extreme end rotation

        if (animType < 0.15) { // Type 1: Super Slow, "Jittery Sticky" - こびりつく
            endX = startX + (Math.random() * 60 - 30);
            endY = startY + (Math.random() * 60 - 30);
            rotEnd = rotStart + (Math.random() * 90 - 45);
            animDuration *= (2.5 + Math.random() * 2); // Much slower
            animEasing = 'steps(10, end)'; // Jittery
            direction = 'alternate-reverse';
        } else if (animType < 0.35) { // Type 2: "Edge Drifter" - こびりつく
            const edge = Math.floor(Math.random() * 4); // 0:top, 1:right, 2:bottom, 3:left
            if (edge === 0) { endX = Math.random()*screenW; endY = -elH * (0.5 + Math.random()*0.5); } // Drift off top
            else if (edge === 1) { endX = screenW + elW * (0.5 + Math.random()*0.5); endY = Math.random()*screenH; } // Drift off right
            else if (edge === 2) { endX = Math.random()*screenW; endY = screenH + elH * (0.5 + Math.random()*0.5); } // Drift off bottom
            else { endX = -elW * (0.5 + Math.random()*0.5); endY = Math.random()*screenH; } // Drift off left
            animDuration *= (1.5 + Math.random());
            rotEnd = rotStart + (Math.random() * 180 - 90);
        } else { // Type 3: "Hardcore Chaotic" - ハード
            endX = Math.random() * screenW * 3 - screenW; // Moves far off screen
            endY = Math.random() * screenH * 3 - screenH;
        }
        
        const initialScale = 0.01 + Math.random() * 0.1;
        const peakScale = isEmphasized ? (1.8 + Math.random() * 1.2) : (1.0 + Math.random() * 0.6);
        const finalPersistScale = isEmphasized ? (0.7 + Math.random()*0.6) : (0.4 + Math.random()*0.5); // Never fully disappears

        keyframes = [
            { transform: `translate(${startX}px, ${startY}px) scale(${initialScale}) rotate(${rotStart}deg)`, opacity: 0, filter: 'blur(25px) brightness(0.2) saturate(0)', offset: 0 },
            { transform: `translate(${startX + (endX-startX)*0.05}px, ${startY + (endY-startY)*0.05}px) scale(${peakScale}) rotate(${rotStart + (rotEnd - rotStart)*0.05}deg)`, opacity: 1, filter: 'blur(0px) brightness(1.3) saturate(1.8)', offset: 0.07 }, // Quick appearance
            { transform: `translate(${startX + (endX-startX)*0.5}px, ${startY + (endY-startY)*0.5}px) scale(${(peakScale + finalPersistScale) / 2}) rotate(${rotStart + (rotEnd - rotStart)*0.5}deg)`, opacity: 0.95, filter: `brightness(1.1) saturate(1.5) hue-rotate(${Math.random()*60-30}deg)`, offset: 0.4 + Math.random()*0.2 }, // Mid-point chaos
            { transform: `translate(${endX}px, ${endY}px) scale(${finalPersistScale}) rotate(${rotEnd}deg)`, opacity: 0.8 + Math.random()*0.2, filter: `brightness(1) saturate(1.2) hue-rotate(${Math.random()*120-60}deg)` } // Persists, does not fade out completely
        ];
        const timing = {
            duration: animDuration,
            easing: animEasing,
            iterations: Infinity, // ★★★ PERPETUAL ANIMATION ★★★
            direction: direction
        };
        
        el.animate(keyframes, timing);
        // Element is never removed from DOM
    }

    // --- Event Listeners ---
    elements.submitButton.addEventListener('click', handleSubmit);
    elements.answerInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSubmit(); });
    elements.nextButton.addEventListener('click', displayNextQuestion);
    elements.restartButton.addEventListener('click', () => {
        if (chaosIntervalId) clearInterval(chaosIntervalId);
        chaosIntervalId = null;
        isChaosModeActive = false;
        document.querySelectorAll('.flying-element').forEach(fe => fe.remove());
        flyingElementCount = 0; // Reset counter
        enableGameControls();
        loadAndProcessCSV(); // Reload and restart game
    });

    // --- Initialization ---
    splitNandeyaText();
    loadAndProcessCSV();
});
