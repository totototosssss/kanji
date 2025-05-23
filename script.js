document.addEventListener('DOMContentLoaded', () => {
    // --- Game Configuration & User Text ---
    const LONG_NANDEYA_TEXT_CONTENT = '相当偏差値の高い高校（身の丈に合ってない）に通っています。高三なのですが未だにアルファベットが読めないことやadhdっぽいことに悩んで親に土下座してwais受けさせてもらいました。知覚推理144言語理解142ワーキングメモリ130処理速度84でした。　総合は覚えてないですが多分139とかだったはずです。ウィスクの年齢なのにウェイス受けさせられた。なんでや';
    let nandeyaPhrases = [];

    // --- HTML Element Cache ---
    // DOM要素を最初にまとめて取得し、存在確認を行う
    const elements = {
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

    // 必須要素の存在チェック
    for (const key in elements) {
        if (!elements[key]) {
            console.error(`致命的エラー: HTML要素 '${key}' (ID: ${key.replace(/([A-Z])/g, "-$1").toLowerCase().replace('elements.', '')}) が見つかりません。`);
            if (elements.loadingDisplay) { // loadingDisplayだけは存在していればエラー表示に使える
                 elements.loadingDisplay.innerHTML = `<p style="color:red;">初期化エラー: UI要素が見つかりません。HTMLを確認してください。</p>`;
            } else {
                alert("致命的エラー: UIコンポーネントの読み込みに失敗しました。");
            }
            return; // 処理中断
        }
    }

    // --- Game State ---
    let allQuizData = [];
    let currentQuestionIndex = 0;
    let score = 0;
    let currentProcessedLevel = -1;
    const csvFilePath = 'ankiDeck.csv'; // CSVファイル名

    // --- Nandeya Text Processing ---
    function splitNandeyaText() {
        const minLength = 7;
        const maxLength = 20;
        let remainingText = LONG_NANDEYA_TEXT_CONTENT;
        nandeyaPhrases = [];
        while (remainingText.length > 0) {
            let len = Math.floor(Math.random() * (maxLength - minLength + 1)) + minLength;
            let phrase = remainingText.substring(0, Math.min(len, remainingText.length));
            let lastCutPoint = -1;
            ['。', '、', ' ', '　', '！', '？', '（', '）', ')', '('].forEach(punc => {
                let idx = phrase.lastIndexOf(punc);
                if (idx > Math.max(0, phrase.length - 10) && idx > lastCutPoint) { // 区切り文字がフレーズの後方にある場合優先
                    lastCutPoint = idx;
                }
            });
            if (lastCutPoint !== -1 && remainingText.length > lastCutPoint + 1) {
                phrase = remainingText.substring(0, lastCutPoint + 1);
            } else if (remainingText.length <= maxLength) {
                phrase = remainingText;
            }
            nandeyaPhrases.push(phrase.trim());
            remainingText = remainingText.substring(phrase.length);
        }
        if (nandeyaPhrases.length === 0 && LONG_NANDEYA_TEXT_CONTENT) {
            nandeyaPhrases.push(LONG_NANDEYA_TEXT_CONTENT.substring(0, maxLength));
        }
    }

    // --- Data Loading & Processing ---
    async function loadAndProcessCSV() {
        elements.loadingDisplay.classList.remove('hidden');
        elements.questionSection.classList.add('hidden');
        elements.feedbackSection.classList.add('hidden');
        elements.gameOverSection.classList.add('hidden');

        try {
            const response = await fetch(csvFilePath);
            if (!response.ok) throw new Error(`CSV (${response.status} ${response.statusText})`);
            const csvText = await response.text();

            Papa.parse(csvText, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => {
                    if (results.errors.length > 0) {
                        console.warn("CSVパース時の軽微なエラー:", results.errors);
                    }
                    processQuizData(results.data);
                    if (allQuizData.length > 0) {
                        startGame();
                    } else {
                        elements.loadingDisplay.innerHTML = "<p>有効なクイズデータがありません。</p>";
                    }
                },
                error: (err) => {
                    console.error("CSVパースエラー:", err);
                    elements.loadingDisplay.innerHTML = `<p>クイズデータの解析に失敗: ${err.message}</p>`;
                }
            });
        } catch (error) {
            console.error("CSV読み込みエラー:", error);
            elements.loadingDisplay.innerHTML = `<p>クイズデータの読み込みに失敗しました: ${error.message}</p>`;
        }
    }

    function processQuizData(rawData) {
        const quizDataMap = new Map();
        rawData.forEach(row => {
            if (!row['単語']?.trim() || !row['レベル']?.trim() || !row['問題ID']?.trim()) return;
            const problemId = row['問題ID'].trim();
            if (!quizDataMap.has(problemId)) {
                quizDataMap.set(problemId, {
                    id: problemId, level: parseInt(row['レベル'], 10),
                    displayWords: new Set(), answers: new Set(), meanings: new Set(),
                    notes: new Set(), otherSpellingsFromColumn: new Set(),
                    images: new Set(), croppedImages: new Set()
                });
            }
            const entry = quizDataMap.get(problemId);
            entry.displayWords.add(row['単語'].trim());
            entry.answers.add(row['読み方']?.trim() || ''); // Ensure not null
            if (row['別解']?.trim()) {
                row['別解'].trim().split(/[/／、。・\s]+/).forEach(ans => { if(ans) entry.answers.add(ans.trim()); });
            }
            if (row['意味']?.trim()) entry.meanings.add(row['意味'].trim());
            if (row['追記']?.trim()) entry.notes.add(row['追記'].trim());
            if (row['別表記']?.trim()) entry.otherSpellingsFromColumn.add(row['別表記'].trim());
            if (row['画像']?.trim()) entry.images.add(row['画像'].trim());
            if (row['切り抜き画像']?.trim()) entry.croppedImages.add(row['切り抜き画像'].trim());
        });
        allQuizData = Array.from(quizDataMap.values()).map(item => ({
            ...item,
            displayWords: Array.from(item.displayWords), answers: Array.from(item.answers).filter(Boolean), // Filter out empty strings
            meanings: Array.from(item.meanings).join(' <br> '), notes: Array.from(item.notes).join(' <br> '),
            otherSpellingsFromColumn: Array.from(item.otherSpellingsFromColumn),
            images: Array.from(item.images), croppedImages: Array.from(item.croppedImages)
        }));
        allQuizData.sort((a, b) => a.level - b.level || a.id.localeCompare(b.id)); // レベル、IDでソート
    }

    // --- Game Logic ---
    function startGame() {
        currentQuestionIndex = 0;
        score = 0;
        currentProcessedLevel = -1; // Initialize to a value that won't match any level
        updateScoreDisplay();
        elements.gameOverSection.classList.add('hidden');
        elements.feedbackSection.classList.add('hidden');
        elements.loadingDisplay.classList.add('hidden'); // ローディングを隠す
        elements.questionSection.classList.remove('hidden');
        displayNextQuestion();
    }

    function displayNextQuestion() {
        if (currentQuestionIndex >= allQuizData.length) {
            showGameOver();
            return;
        }
        elements.feedbackSection.classList.add('hidden');
        elements.infoDetailsArea.classList.add('hidden'); // Ensure info is hidden initially
        elements.nextButton.classList.add('hidden');

        const currentQuestion = allQuizData[currentQuestionIndex];
        if (currentQuestion.level !== currentProcessedLevel) {
            currentProcessedLevel = currentQuestion.level;
            elements.currentLevelDisplay.textContent = currentProcessedLevel;
        }
        const wordToShow = currentQuestion.displayWords[Math.floor(Math.random() * currentQuestion.displayWords.length)];
        elements.kanjiDisplay.textContent = wordToShow;

        elements.imageContainer.innerHTML = '';
        if (currentQuestion.croppedImages.length > 0) {
            elements.imageContainer.innerHTML = currentQuestion.croppedImages[0];
        } else if (currentQuestion.images.length > 0) {
            elements.imageContainer.innerHTML = currentQuestion.images[0];
        }
        elements.answerInput.value = '';
        elements.answerInput.disabled = false;
        elements.submitButton.disabled = false;
        elements.answerInput.focus();
    }

    function handleSubmit() {
        if (elements.answerInput.disabled) return;
        const userAnswer = elements.answerInput.value.trim();
        const currentQuestion = allQuizData[currentQuestionIndex];
        let isCorrect = false;
        const normalizedUserAnswer = normalizeAnswer(userAnswer);

        for (const correctAnswer of currentQuestion.answers) {
            if (normalizeAnswer(correctAnswer) === normalizedUserAnswer) {
                isCorrect = true;
                break;
            }
        }
        
        elements.feedbackSection.classList.remove('hidden');
        elements.infoDetailsArea.classList.remove('hidden'); // Show info area along with feedback
        elements.nextButton.classList.remove('hidden');
        elements.answerInput.disabled = true;
        elements.submitButton.disabled = true;

        if (isCorrect) {
            elements.feedbackMessage.textContent = "正解！";
            elements.feedbackMessage.className = 'message-feedback correct';
            score += 10;
        } else {
            elements.feedbackMessage.textContent = "不正解...";
            elements.feedbackMessage.className = 'message-feedback incorrect';
            const correctAnswersText = currentQuestion.answers.join(' ／ ');
            elements.feedbackMessage.textContent += ` (正解: ${correctAnswersText})`;
            triggerFlyingElements(currentQuestion);
        }

        elements.meaningText.innerHTML = currentQuestion.meanings || '－';
        if (currentQuestion.notes?.trim()) {
            elements.notesText.innerHTML = currentQuestion.notes;
            elements.notesContainer.classList.remove('hidden');
        } else {
            elements.notesContainer.classList.add('hidden');
        }
        const otherDisplayOptions = currentQuestion.displayWords.filter(w => w !== elements.kanjiDisplay.textContent);
        const allOtherSpellings = new Set([...otherDisplayOptions, ...currentQuestion.otherSpellingsFromColumn]);
        if (allOtherSpellings.size > 0) {
            elements.otherSpellingsText.innerHTML = Array.from(allOtherSpellings).join('、 ');
            elements.otherSpellingsContainer.classList.remove('hidden');
        } else {
            elements.otherSpellingsContainer.classList.add('hidden');
        }
        updateScoreDisplay();
        currentQuestionIndex++;
    }
    
    function normalizeAnswer(str) {
        if (!str) return "";
        return str.normalize('NFKC').toLowerCase()
                  .replace(/[\u30a1-\u30f6]/g, match => String.fromCharCode(match.charCodeAt(0) - 0x60)) // Katakana to Hiragana
                  .replace(/\s+/g, ''); // Remove spaces
    }

    function updateScoreDisplay() {
        elements.currentScoreDisplay.textContent = score;
    }

    function showGameOver() {
        elements.questionSection.classList.add('hidden');
        elements.feedbackSection.classList.add('hidden');
        elements.gameOverSection.classList.remove('hidden');
        elements.finalScoreDisplay.textContent = score;
    }

    // --- Flying Elements (Enhanced for "Gekishiku" & "Senren") ---
    let flyingElementHueStart = Math.random() * 360;

    function triggerFlyingElements(questionData) {
        const TOTAL_FLYING_ELEMENTS = 30; // Increased for "激しさ"
        const DURATION_BASE = 3500;
        const DURATION_RANDOM_ADD = 2500;
        const candidates = [];

        questionData.displayWords.slice(0, 3).forEach(dw => candidates.push({ type: 'text', content: dw, size: 'large' }));
        questionData.answers.slice(0, 2).forEach(ans => candidates.push({ type: 'text', content: ans, size: 'medium' }));
        if (questionData.croppedImages.length > 0) {
            candidates.push({ type: 'image', content: questionData.croppedImages[0] });
        } else if (questionData.images.length > 0) {
            candidates.push({ type: 'image', content: questionData.images[0] });
        }
        nandeyaPhrases.slice(0, Math.min(8, nandeyaPhrases.length)).forEach(phrase => {
            candidates.push({type: 'text', content: phrase, size: (phrase.length > 10 ? 'medium' : 'small')});
        });
        ['×', '残念無念', '再挑戦！', 'WHY?', 'NOOOO', 'orz'].forEach(txt => candidates.push({type: 'text', content: txt, size: 'medium'}));

        for (let i = 0; i < TOTAL_FLYING_ELEMENTS; i++) {
            if (candidates.length === 0) break;
            const selectedItem = candidates[Math.floor(Math.random() * candidates.length)];
            const duration = DURATION_BASE + Math.random() * DURATION_RANDOM_ADD;
            setTimeout(() => {
                createFlyingElement(selectedItem.content, selectedItem.type, selectedItem.size, duration);
            }, Math.random() * 1200); // Stagger appearance
        }
    }

    function createFlyingElement(content, type, size, duration) {
        const el = document.createElement('div');
        el.classList.add('flying-element');

        const currentHue = (flyingElementHueStart + Math.random() * 90) % 360;
        flyingElementHueStart = (flyingElementHueStart + 15) % 360; // Shift start hue for next batch

        if (type === 'text') {
            el.classList.add('flying-text');
            el.textContent = content;
            el.style.fontSize = size === 'large' ? '2em' : (size === 'medium' ? '1.5em' : '1.1em');
            // Rainbow effect via JS
            let hue = currentHue;
            const intervalId = setInterval(() => {
                hue = (hue + 8) % 360; // Faster color shift
                el.style.color = `hsl(${hue}, 100%, 75%)`;
                el.style.textShadow = `0 0 3px hsl(${hue}, 100%, 75%), 0 0 8px hsl(${hue}, 100%, 50%), 0 0 15px black`;
                el.style.borderColor = `hsla(${hue}, 90%, 60%, 0.7)`;
            }, 40); // Update color faster
            setTimeout(() => clearInterval(intervalId), duration); // Clear interval when element is gone
            el.style.backgroundColor = `hsla(${currentHue}, 80%, 15%, 0.6)`; // Darker, vibrant background
            el.style.border = `2px solid hsla(${currentHue}, 90%, 60%, 0.7)`;
        } else if (type === 'image') {
            el.classList.add('flying-image');
            el.innerHTML = content;
            el.style.backgroundColor = `hsla(${currentHue}, 80%, 15%, 0.5)`;
            el.style.border = `3px solid hsla(${currentHue}, 90%, 70%, 0.8)`;
            el.style.padding = "3px";
        }

        document.body.appendChild(el);

        const screenW = window.innerWidth;
        const screenH = window.innerHeight;
        // Get size after content is set
        const elRect = el.getBoundingClientRect();
        const elW = elRect.width;
        const elH = elRect.height;


        // Animation using Web Animations API for more control and "gekisa"
        const startX = Math.random() * screenW;
        const startY = screenH * 0.2 + Math.random() * screenH * 0.6; // Start more centered vertically
        const endX = Math.random() * screenW * 1.6 - screenW * 0.3; // Wider spread
        const endY = Math.random() * screenH * 1.6 - screenH * 0.3;

        const initialRotation = Math.random() * 720 - 360;
        const endRotation = initialRotation + (Math.random() > 0.5 ? 1 : -1) * (720 + Math.random() * 720); // More rotations
        const initialScale = 0.1 + Math.random() * 0.3;
        const peakScale = 1.0 + Math.random() * 0.5; // Overshoot scale

        const keyframes = [
            { transform: `translate(${startX - elW/2}px, ${startY - elH/2}px) scale(${initialScale}) rotate(${initialRotation}deg)`, opacity: 0, filter: 'blur(8px)'},
            { transform: `translate(${startX - elW/2 + (endX-startX)*0.1}px, ${startY - elH/2 + (endY-startY)*0.1}px) scale(${peakScale}) rotate(${initialRotation + (endRotation - initialRotation)*0.1}deg)`, opacity: 1, filter: 'blur(0px)', offset: 0.15 },
            { transform: `translate(${startX - elW/2 + (endX-startX)*0.5}px, ${startY - elH/2 + (endY-startY)*0.5}px) scale(${0.8 + Math.random()*0.4}) rotate(${initialRotation + (endRotation - initialRotation)*0.5}deg)`, opacity: 0.9, offset: 0.5 }, // Mid-point chaos
            { transform: `translate(${endX - elW/2}px, ${endY - elH/2}px) scale(0.1) rotate(${endRotation}deg)`, opacity: 0, filter: 'blur(10px)'}
        ];
        const timing = {
            duration: duration,
            easing: `cubic-bezier(${Math.random()*0.4 + 0.1}, ${Math.random()*0.5 + 0.5}, ${Math.random()*0.4 + 0.1}, ${Math.random()*0.5 + 0.5})`, // Random bezier
            fill: 'forwards'
        };
        
        const animation = el.animate(keyframes, timing);
        animation.onfinish = () => {
            if (el.parentNode) el.parentNode.removeChild(el);
        };
    }


    // --- Event Listeners ---
    elements.submitButton.addEventListener('click', handleSubmit);
    elements.answerInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSubmit(); });
    elements.nextButton.addEventListener('click', displayNextQuestion);
    elements.restartButton.addEventListener('click', () => {
        // Clean up any remaining flying elements before restart
        document.querySelectorAll('.flying-element').forEach(fe => fe.remove());
        loadAndProcessCSV();
    });

    // --- Initialization ---
    splitNandeyaText();
    loadAndProcessCSV();
});
