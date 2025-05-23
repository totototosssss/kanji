document.addEventListener('DOMContentLoaded', () => {
    // HTML要素の取得
    const loadingMessage = document.getElementById('loading-message');
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
    let currentProcessedLevel = -1; // 表示用レベル

    // CSVファイルのパス
    const csvFilePath = 'ankiDeck.csv';

    // --- データ処理 ---
    async function loadAndProcessCSV() {
        try {
            const response = await fetch(csvFilePath);
            if (!response.ok) {
                throw new Error(`CSVファイルの読み込みに失敗しました: ${response.statusText}`);
            }
            const csvText = await response.text();

            Papa.parse(csvText, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => {
                    // 1行目の説明行はresults.meta.fields (ヘッダー名) によって処理されているので、
                    // results.data は実データのみのはず。
                    // もし1行目がデータとして混入する場合はフィルタリングが必要。
                    // 今回はヘッダーがあるので、1行目がデータとして扱われることはない想定。
                    processQuizData(results.data);
                    startGame();
                },
                error: (error) => {
                    console.error("CSVパースエラー:", error);
                    loadingMessage.textContent = "クイズデータの解析に失敗しました。";
                }
            });
        } catch (error) {
            console.error("CSV読み込みエラー:", error);
            loadingMessage.textContent = "クイズデータの読み込みに失敗しました。";
        }
    }

    function processQuizData(rawData) {
        const quizDataMap = new Map();

        rawData.forEach(row => {
            // "単語" 列が空、または "レベル" 列が空の場合はスキップ (不正なデータや最終行など)
            if (!row['単語'] || !row['単語'].trim() || !row['レベル'] || !row['レベル'].trim()) {
                return;
            }

            const problemId = row['問題ID'];
            if (!problemId) return; // 問題IDがないデータはスキップ

            if (!quizDataMap.has(problemId)) {
                quizDataMap.set(problemId, {
                    id: problemId,
                    level: parseInt(row['レベル'], 10), // 数値として保持
                    displayWords: new Set(),
                    answers: new Set(),
                    meanings: new Set(),
                    notes: new Set(),
                    otherSpellingsFromColumn: new Set(), // CSVの「別表記」列
                    images: new Set(),
                    croppedImages: new Set()
                });
            }

            const entry = quizDataMap.get(problemId);
            entry.displayWords.add(row['単語'].trim());
            entry.answers.add(row['読み方'].trim());
            if (row['別解'] && row['別解'].trim()) {
                // 別解が複数ある場合も考慮 (例: "かい1/かい2") -> splitして追加
                row['別解'].trim().split(/[/／、。・\s]+/).forEach(ans => { // 区切り文字を複数指定
                    if(ans) entry.answers.add(ans.trim());
                });
            }
            if (row['意味'] && row['意味'].trim()) entry.meanings.add(row['意味'].trim());
            if (row['追記'] && row['追記'].trim()) entry.notes.add(row['追記'].trim());
            if (row['別表記'] && row['別表記'].trim()) entry.otherSpellingsFromColumn.add(row['別表記'].trim());
            if (row['画像'] && row['画像'].trim()) entry.images.add(row['画像'].trim());
            if (row['切り抜き画像'] && row['切り抜き画像'].trim()) entry.croppedImages.add(row['切り抜き画像'].trim());
        });

        allQuizData = Array.from(quizDataMap.values()).map(item => ({
            ...item,
            displayWords: Array.from(item.displayWords),
            answers: Array.from(item.answers),
            meanings: Array.from(item.meanings).join(' <br> '), // 複数あれば改行で結合
            notes: Array.from(item.notes).join(' <br> '),
            otherSpellingsFromColumn: Array.from(item.otherSpellingsFromColumn),
            images: Array.from(item.images),
            croppedImages: Array.from(item.croppedImages)
        }));

        // レベルでソート (昇順)
        allQuizData.sort((a, b) => a.level - b.level);
        console.log("処理済みクイズデータ:", allQuizData);
    }

    // --- ゲームロジック ---
    function startGame() {
        currentQuestionIndex = 0;
        score = 0;
        currentProcessedLevel = -1; // リセット
        updateScoreDisplay();
        gameOverArea.classList.add('hidden');
        feedbackArea.classList.add('hidden');
        loadingMessage.classList.add('hidden');
        questionContainer.classList.remove('hidden');
        displayNextQuestion();
    }

    function displayNextQuestion() {
        if (currentQuestionIndex >= allQuizData.length) {
            showGameOver();
            return;
        }

        const currentQuestion = allQuizData[currentQuestionIndex];

        // レベル表示の更新
        if (currentQuestion.level !== currentProcessedLevel) {
            currentProcessedLevel = currentQuestion.level;
            currentLevelDisplay.textContent = currentProcessedLevel;
        }
        
        // 問題の表示漢字を選択 (候補の中からランダムまたは先頭)
        kanjiDisplay.textContent = currentQuestion.displayWords[0]; // とりあえず先頭を表示

        // 画像表示 (あれば)
        imageDisplay.innerHTML = ''; // 前の画像をクリア
        if (currentQuestion.croppedImages.length > 0) {
            imageDisplay.innerHTML = currentQuestion.croppedImages[0]; // とりあえず先頭
        } else if (currentQuestion.images.length > 0) {
            imageDisplay.innerHTML = currentQuestion.images[0]; // とりあえず先頭
        }


        answerInput.value = '';
        answerInput.disabled = false;
        submitButton.disabled = false;
        feedbackArea.classList.add('hidden');
        infoArea.classList.add('hidden');
        nextButton.classList.add('hidden');
        answerInput.focus();
    }

    function handleSubmit() {
        if (answerInput.disabled) return;

        const userAnswer = answerInput.value.trim().toLowerCase(); // 入力を整形
        const currentQuestion = allQuizData[currentQuestionIndex];
        let isCorrect = false;

        // ひらがな・カタカナ、全角・半角の差異をある程度許容する
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
            score += 10; // スコア加算
        } else {
            feedbackText.textContent = "不正解...";
            feedbackText.className = 'incorrect';
            // 不正解の場合、正解を表示
            feedbackText.textContent += ` (正解: ${currentQuestion.answers.join(', ')})`;
        }

        meaningText.innerHTML = currentQuestion.meanings || '－';
        
        if (currentQuestion.notes) {
            notesText.innerHTML = currentQuestion.notes;
            notesContainer.classList.remove('hidden');
        } else {
            notesContainer.classList.add('hidden');
        }

        // 別表記の処理 (問題文に使われなかったもの + CSVの別表記列)
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

    // 解答の正規化 (ひらがな化、小文字化など)
    function normalizeAnswer(str) {
        if (!str) return "";
        return str.normalize('NFKC') // 全角英数を半角に、半角カナを全角カナに等
                  .toLowerCase()     // 英字を小文字に
                  .replace(/[\u30a1-\u30f6]/g, function(match) { // カタカナをひらがなに
                      var chr = match.charCodeAt(0) - 0x60;
                      return String.fromCharCode(chr);
                  })
                  .replace(/\s+/g, ''); // スペース除去
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

    // --- イベントリスナー ---
    submitButton.addEventListener('click', handleSubmit);
    answerInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleSubmit();
        }
    });
    nextButton.addEventListener('click', displayNextQuestion);
    restartButton.addEventListener('click', () => {
        // データを再ロードするか、現在のデータで再開するかを選択できます。
        // ここでは現在のデータでゲームをリスタートします。
        loadAndProcessCSV(); // CSVから再読み込みする場合
        // startGame(); // 既存データで始める場合 (CSVに変更がなければこちらでも可)
    });

    // --- 初期化 ---
    loadAndProcessCSV();
});
