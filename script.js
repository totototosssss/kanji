document.addEventListener('DOMContentLoaded', () => {
    // --- Game Configuration & User Text ---
    // ↓↓↓ ユーザー指定の長い文字列 (必ずこのあたりに定義してください) ↓↓↓
    const LONG_NANDEYA_TEXT_CONTENT = '相当偏差値の高い高校（身の丈に合ってない）に通っています。高三なのですが未だにアルファベットが読めないことやadhdっぽいことに悩んで親に土下座してwais受けさせてもらいました。知覚推理144言語理解142ワーキングメモリ130処理速度84でした。　総合は覚えてないですが多分139とかだったはずです。ウィスクの年齢なのにウェイス受けさせられた。なんでや';
    let nandeyaPhrases = [];

    // HTML要素の取得 (前回と同様)
    const loadingArea = document.getElementById('loading-area');
    const questionContainer = document.getElementById('question-container');
    const kanjiDisplay = document.getElementById('kanji-display');
    const imageDisplay = document.getElementById('image-display');
    const answerInput = document.getElementById('answer-input');
    const submitButton = document.getElementById('submit-button');
    const feedbackArea = document.getElementById('feedback-area');
    const feedbackText = document.getElementById('feedback-text');
    const infoArea = document.getElementById('info-area');
    const meaningText = document.getElementById('meaning-text');
    const notesContainer = document.getElementById('notes-container');
    const notesText = document.getElementById('notes-text');
    const otherSpellingsContainer = document.getElementById('other-spellings-container');
    const otherSpellingsText = document.getElementById('other-spellings-text');
    const nextButton = document.getElementById('next-button');
    const gameOverArea = document.getElementById('game-over-area');
    const restartButton = document.getElementById('restart-button');
    const currentLevelDisplay = document.getElementById('current-level');
    const currentScoreDisplay = document.getElementById('current-score');
    const finalScoreDisplay = document.getElementById('final-score');

    let allQuizData = [];
    let currentQuestionIndex = 0;
    let score = 0;
    let currentProcessedLevel = -1;

    const csvFilePath = 'ankiDeck.csv';

    // --- Nandeya Text Processing ---
    function splitNandeyaText() {
        const minLength = 5; // フレーズの最小長
        const maxLength = 15; // フレーズの最大長
        let remainingText = LONG_NANDEYA_TEXT_CONTENT;
        nandeyaPhrases = [];

        while (remainingText.length > 0) {
            let len = Math.floor(Math.random() * (maxLength - minLength + 1)) + minLength;
            if (len > remainingText.length) {
                len = remainingText.length;
            }
            // 句読点やスペースで区切ることを試みる (より自然な区切り)
            let phrase = remainingText.substring(0, len);
            let cutPoint = -1;
            ['。', '、', ' ', '　', '！', '？'].forEach(punc => {
                let idx = phrase.lastIndexOf(punc);
                if (idx > minLength / 2 && idx > cutPoint) { // ある程度長さがあり、より後ろの区切りを優先
                    cutPoint = idx;
                }
            });

            if (cutPoint !== -1 && remainingText.length > cutPoint + 1) { // 区切りが見つかり、かつそれで切っても残りのテキストがある場合
                 phrase = remainingText.substring(0, cutPoint + 1);
                 len = phrase.length;
            } else if (remainingText.length <= maxLength) { // 残り全てが最大長以下なら全部取る
                 phrase = remainingText;
                 len = remainingText.length;
            }


            if (phrase.trim()) {
                 nandeyaPhrases.push(phrase.trim());
            }
            remainingText = remainingText.substring(len);
        }
        if (nandeyaPhrases.length === 0 && LONG_NANDEYA_TEXT_CONTENT.length > 0) { // 万が一分割できなかった場合
            nandeyaPhrases.push(LONG_NANDEYA_TEXT_CONTENT.substring(0, Math.min(LONG_NANDEYA_TEXT_CONTENT.length, maxLength)));
        }
    }


    // --- データ処理 (CSV) ---
    async function loadAndProcessCSV() {
        loadingArea.classList.remove('hidden');
        questionContainer.classList.add('hidden');
        feedbackArea.classList.add('hidden');
        gameOverArea.classList.add('hidden');

        try {
            const response = await fetch(csvFilePath);
            if (!response.ok) throw new Error(`CSV読み込み失敗: ${response.statusText}`);
            const csvText = await response.text();

            Papa.parse(csvText, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => {
                    processQuizData(results.data);
                    if (allQuizData.length > 0) {
                        startGame();
                    } else {
                        loadingArea.innerHTML = "<p>有効なクイズデータが見つかりませんでした。</p>";
                    }
                },
                error: (err) => {
                    console.error("CSVパースエラー:", err);
                    loadingArea.innerHTML = "<p>クイズデータの解析に失敗しました。</p>";
                }
            });
        } catch (error) {
            console.error("CSV読み込みエラー:", error);
            loadingArea.innerHTML = `<p>クイズデータの読み込みに失敗しました。(${error.message})</p>`;
        }
    }
    
    function processQuizData(rawData) { // 前回とほぼ同じロジック
        const quizDataMap = new Map();
        rawData.forEach(row => {
            if (!row['単語'] || !row['単語'].trim() || !row['レベル'] || !row['レベル'].trim()) return;
            const problemId = row['問題ID'];
            if (!problemId) return;

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
            entry.answers.add(row['読み方'].trim());
            if (row['別解'] && row['別解'].trim()) {
                row['別解'].trim().split(/[/／、。・\s]+/).forEach(ans => { if(ans) entry.answers.add(ans.trim()); });
            }
            if (row['意味'] && row['意味'].trim()) entry.meanings.add(row['意味'].trim());
            if (row['追記'] && row['追記'].trim()) entry.notes.add(row['追記'].trim());
            if (row['別表記'] && row['別表記'].trim()) entry.otherSpellingsFromColumn.add(row['別表記'].trim());
            if (row['画像'] && row['画像'].trim()) entry.images.add(row['画像'].trim());
            if (row['切り抜き画像'] && row['切り抜き画像'].trim()) entry.croppedImages.add(row['切り抜き画像'].trim());
        });
        allQuizData = Array.from(quizDataMap.values()).map(item => ({
            ...item,
            displayWords: Array.from(item.displayWords), answers: Array.from(item.answers),
            meanings: Array.from(item.meanings).join(' <br> '), notes: Array.from(item.notes).join(' <br> '),
            otherSpellingsFromColumn: Array.from(item.otherSpellingsFromColumn),
            images: Array.from(item.images), croppedImages: Array.from(item.croppedImages)
        }));
        allQuizData.sort((a, b) => a.level - b.level);
    }

    // --- ゲームロジック ---
    function startGame() {
        currentQuestionIndex = 0;
        score = 0;
        currentProcessedLevel = -1;
        updateScoreDisplay();
        gameOverArea.classList.add('hidden');
        feedbackArea.classList.add('hidden');
        loadingArea.classList.add('hidden');
        questionContainer.classList.remove('hidden');
        displayNextQuestion();
    }

    function displayNextQuestion() {
        if (currentQuestionIndex >= allQuizData.length) {
            showGameOver();
            return;
        }
        feedbackArea.classList.add('hidden');
        infoArea.classList.add('hidden');
        nextButton.classList.add('hidden');

        const currentQuestion = allQuizData[currentQuestionIndex];
        if (currentQuestion.level !== currentProcessedLevel) {
            currentProcessedLevel = currentQuestion.level;
            currentLevelDisplay.textContent = currentProcessedLevel;
        }
        const wordToShow = currentQuestion.displayWords[Math.floor(Math.random() * currentQuestion.displayWords.length)];
        kanjiDisplay.textContent = wordToShow;

        imageDisplay.innerHTML = '';
        if (currentQuestion.croppedImages.length > 0) {
            imageDisplay.innerHTML = currentQuestion.croppedImages[0];
        } else if (currentQuestion.images.length > 0) {
            imageDisplay.innerHTML = currentQuestion.images[0];
        }
        answerInput.value = '';
        answerInput.disabled = false;
        submitButton.disabled = false;
        answerInput.focus();
    }

    function handleSubmit() {
        if (answerInput.disabled) return;
        const userAnswer = answerInput.value.trim();
        const currentQuestion = allQuizData[currentQuestionIndex];
        let isCorrect = false;
        const normalizedUserAnswer = normalizeAnswer(userAnswer);

        for (const correctAnswer of currentQuestion.answers) {
            if (normalizeAnswer(correctAnswer) === normalizedUserAnswer) {
                isCorrect = true;
                break;
            }
        }
        
        feedbackArea.classList.remove('hidden');
        infoArea.classList.remove('hidden');
        nextButton.classList.remove('hidden');
        answerInput.disabled = true;
        submitButton.disabled = true;

        if (isCorrect) {
            feedbackText.textContent = "正解！";
            feedbackText.className = 'correct';
            score += 10;
        } else {
            feedbackText.textContent = "不正解...";
            feedbackText.className = 'incorrect';
            const correctAnswersText = currentQuestion.answers.join(' / ');
            feedbackText.textContent += ` (正解: ${correctAnswersText})`;
            triggerFlyingElements(currentQuestion); // ★不正解エフェクト発動★
        }

        meaningText.innerHTML = currentQuestion.meanings || '－';
        if (currentQuestion.notes && currentQuestion.notes.trim() !== "") {
            notesText.innerHTML = currentQuestion.notes;
            notesContainer.classList.remove('hidden');
        } else {
            notesContainer.classList.add('hidden');
        }
        const otherDisplayOptions = currentQuestion.displayWords.filter(w => w !== kanjiDisplay.textContent);
        const allOtherSpellings = new Set([...otherDisplayOptions, ...currentQuestion.otherSpellingsFromColumn]);
        if (allOtherSpellings.size > 0) {
            otherSpellingsText.innerHTML = Array.from(allOtherSpellings).join(', ');
            otherSpellingsContainer.classList.remove('hidden');
        } else {
            otherSpellingsContainer.classList.add('hidden');
        }
        updateScoreDisplay();
        currentQuestionIndex++;
    }
    
    function normalizeAnswer(str) { // 前回と同様
        if (!str) return "";
        return str.normalize('NFKC').toLowerCase()
                  .replace(/[\u30a1-\u30f6]/g, match => String.fromCharCode(match.charCodeAt(0) - 0x60))
                  .replace(/\s+/g, '');
    }

    function updateScoreDisplay() {
        currentScoreDisplay.textContent = score;
    }

    function showGameOver() {
        questionContainer.classList.add('hidden');
        feedbackArea.classList.add('hidden');
        gameOverArea.classList.remove('hidden');
        finalScoreDisplay.textContent = score;
    }

    // --- ★★★ 飛び交うエフェクト生成関数 (大幅強化) ★★★ ---
    function triggerFlyingElements(questionData) {
        const elementsToFlyConfig = [];
        const DURATION_BASE = 3000; // ms, エフェクトの基本持続時間
        const DURATION_RANDOM_ADD = 2000; // ms, 持続時間のランダム追加分
        const TOTAL_ELEMENTS = 25; // 飛び交う総数 (激しく！)

        // 要素の候補リストを作成
        const candidates = [];
        // 1. 問題の漢字 (最大3つ)
        questionData.displayWords.slice(0, 3).forEach(dw => candidates.push({ type: 'text', content: dw, category: 'kanji' }));
        // 2. 正しい読み (最大3つ)
        questionData.answers.slice(0, 3).forEach(ans => candidates.push({ type: 'text', content: ans, category: 'yomi' }));
        // 3. 画像 (あれば1つ)
        if (questionData.croppedImages.length > 0) {
            candidates.push({ type: 'image', content: questionData.croppedImages[0], category: 'image' });
        } else if (questionData.images.length > 0) {
            candidates.push({ type: 'image', content: questionData.images[0], category: 'image' });
        }
        // 4. Nandeyaフレーズ (最大5つ)
        if (nandeyaPhrases.length > 0) {
            for (let i = 0; i < Math.min(5, nandeyaPhrases.length); i++) {
                 candidates.push({ type: 'text', content: nandeyaPhrases[Math.floor(Math.random() * nandeyaPhrases.length)], category: 'nandeya' });
            }
        }
        // 5. シンプルな「×」や「残念」 (数合わせ用)
        ['×', '残念', '無念', 'Retry?', 'なんでやねん！'].forEach(txt => candidates.push({type: 'text', content: txt, category: 'filler'}));


        // candidates リストからランダムに TOTAL_ELEMENTS 個選んでエフェクト発動
        for (let i = 0; i < TOTAL_ELEMENTS; i++) {
            if (candidates.length === 0) break; // 候補がなくなったら終了
            const selectedItem = candidates[Math.floor(Math.random() * candidates.length)];
            const duration = DURATION_BASE + Math.random() * DURATION_RANDOM_ADD;
            // 少し遅延させて出現タイミングをばらけさせる
            setTimeout(() => {
                createFlyingElement(selectedItem.content, selectedItem.type, selectedItem.category, duration);
            }, Math.random() * 800); // 最大0.8秒の遅延
        }
    }

    let hueStart = 0; // レインボーカラーの開始色相

    function createFlyingElement(content, type, category, duration) {
        const el = document.createElement('div');
        el.classList.add('flying-element');

        let isRainbow = false;
        let currentHue = (hueStart + Math.random() * 60) % 360; // 各要素の色相を少しずらす
        hueStart = (hueStart + 20) % 360; // 次の要素の開始色相をずらす

        if (type === 'text') {
            el.classList.add('flying-text');
            el.textContent = content;
            // カテゴリによってスタイルを変えても良い
            if (category === 'nandeya' || category === 'filler' || Math.random() < 0.5) { // 半分くらいの確率でレインボー
                isRainbow = true;
                // el.classList.add('rainbow-text-effect'); // CSSアニメーションでやる場合
            }
            // 背景を少し暗くして虹色を目立たせる
            el.style.backgroundColor = `hsla(${currentHue}, 70%, 20%, 0.7)`;
            el.style.border = `2px solid hsla(${currentHue}, 80%, 60%, 0.8)`;

        } else if (type === 'image') {
            el.classList.add('flying-image');
            el.innerHTML = content; // content is an <img> tag string
            // 画像にも枠線やエフェクトを
            el.style.backgroundColor = `hsla(${currentHue}, 70%, 20%, 0.5)`;
            el.style.border = `3px solid hsla(${currentHue}, 80%, 70%, 0.9)`;
            el.style.padding = "5px"; // 画像に少しパディング
        }

        document.body.appendChild(el);

        // 初期スタイル（アニメーション開始前）
        const screenW = window.innerWidth;
        const screenH = window.innerHeight;
        const elRect = el.getBoundingClientRect(); // サイズ取得のため一度表示させてから計算

        el.style.opacity = '0';
        el.style.transform = 'scale(0.1) rotate(0deg)';

        // アニメーションパラメータ
        const startX = Math.random() * (screenW - elRect.width);
        const startY = Math.random() * (screenH - elRect.height);
        
        const endX = Math.random() * screenW * 1.4 - screenW * 0.2; // 画面内外に激しく
        const endY = Math.random() * screenH * 1.4 - screenH * 0.2;

        const initialRotation = Math.random() * 720 - 360; // -360 to 360 deg
        const endRotation = initialRotation + Math.random() * 1080 - 540; // さらに激しく回転

        // Element.animate() API を使用
        const animation = el.animate([
            { transform: `translate(${startX - screenW/2 + elRect.width/2}px, ${startY - screenH/2 + elRect.height/2}px) scale(0.2) rotate(${initialRotation}deg)`, opacity: 0, offset: 0 }, // 中央付近から開始を調整
            { transform: `translate(${startX - screenW/2 + elRect.width/2}px, ${startY - screenH/2 + elRect.height/2}px) scale(1.2) rotate(${initialRotation + (endRotation - initialRotation)*0.1}deg)`, opacity: 1, offset: 0.15 }, // パッと出現して拡大
            { transform: `translate(${endX - screenW/2 + elRect.width/2}px, ${endY - screenH/2 + elRect.height/2}px) scale(0.8) rotate(${endRotation}deg)`, opacity: 1, offset: 0.85 },
            { transform: `translate(${endX - screenW/2 + elRect.width/2}px, ${endY - screenH/2 + elRect.height/2}px) scale(0.1) rotate(${endRotation + 180}deg)`, opacity: 0, offset: 1 }
        ], {
            duration: duration,
            easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', // 緩急のあるイージング
            fill: 'forwards'
        });

        let rainbowIntervalId = null;
        if (isRainbow && type === 'text') {
            let hue = currentHue;
            rainbowIntervalId = setInterval(() => {
                hue = (hue + 5) % 360;
                el.style.color = `hsl(${hue}, 100%, 70%)`; // 明るい虹色
                el.style.textShadow = `0 0 8px hsl(${hue}, 100%, 50%)`;
                el.style.borderColor = `hsla(${(hue + 30) % 360}, 80%, 60%, 0.8)`; // 枠線も色変化
            }, 50); // 50msごとに色更新
        }

        animation.onfinish = () => {
            if (rainbowIntervalId) clearInterval(rainbowIntervalId);
            if (el.parentNode) {
                el.parentNode.removeChild(el);
            }
        };
    }

    // --- イベントリスナー ---
    submitButton.addEventListener('click', handleSubmit);
    answerInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSubmit(); });
    nextButton.addEventListener('click', displayNextQuestion);
    restartButton.addEventListener('click', () => { loadAndProcessCSV(); });

    // --- 初期化 ---
    splitNandeyaText(); // 「なんでや」フレーズを準備
    loadAndProcessCSV();
});
