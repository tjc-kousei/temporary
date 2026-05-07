// ==========================================
// 1. GLOBALS & STATE
// ==========================================
let display_win; // 統合されたウィンドウ

let Abbre = [
  "創", "出エジ", "レビ", "民", "申", "ヨシュ", "士", "ルツ", "サム上", "サム下",
  "列王上", "列王下", "歴代上", "歴代下", "エズ", "ネヘ", "エス", "ヨブ", "詩",
  "箴", "伝", "雅歌", "イザ", "エレ", "哀", "エゼ", "ダニ", "ホセ", "ヨエ", "アモ",
  "オバ", "ヨナ", "ミカ", "ナホ", "ハバ", "ゼパ", "ハガ", "ゼカ", "マラ", "マタ",
  "マル", "ルカ", "ヨハ", "使徒", "ロマ", "Ⅰコリ", "Ⅱコリ", "ガラ", "エペ", "ピリ",
  "コロ", "Ⅰテサ", "Ⅱテサ", "Ⅰテモ", "Ⅱテモ", "テト", "ピレ", "ヘブ", "ヤコ",
  "Ⅰペテ", "Ⅱペテ", "Ⅰヨハ", "Ⅱヨハ", "Ⅲヨハ", "ユダ", "黙",
];

let kr = [
  "창", "출", "레", "민", "신", "수", "삿", "룻", "삼상", "삼하", "왕상", "왕하",
  "대상", "대하", "스", "느", "에", "욥", "시", "잠", "전", "아", "사", "렘", "애",
  "겔", "단", "호", "욜", "암", "옵", "욘", "미", "나", "합", "습", "학", "슥", "말",
  "마", "막", "눅", "요", "행", "롬", "고전", "고후", "갈", "엡", "빌", "골", "살전",
  "살후", "딤전", "딤후", "딛", "몬", "히", "약", "벧전", "벧후", "요일", "요이",
  "요삼", "유", "계",
];

let en = [
  "Gen.", "Ex.", "Lev.", "Num.", "Deut.", "Josh.", "Judg.", "Ruth", "1Sam.", "2Sam.",
  "1Kgs.", "2Kgs.", "1Chr.", "2Chr.", "Ezra", "Neh.", "Esth.", "Job", "Ps.", "Prov.",
  "Eccl.", "Song", "Is.", "Jer.", "Lam.", "Ezek.", "Dan.", "Hos.", "Joel", "Amos",
  "Obad.", "Jonah", "Mic.", "Nah.", "Hab.", "Zeph.", "Hag.", "Zech.", "Mal.", "Matt.",
  "Mark", "Luke", "John", "Acts", "Rom.", "1Cor.", "2Cor.", "Gal.", "Eph.", "Phil.",
  "Col.", "1Thess.", "2Thess.", "1Tim.", "2Tim.", "Titus", "Philem.", "Heb.", "James",
  "1Pet.", "2Pet.", "1John", "2John", "3John", "Jude", "Rev.",
];

let bible = [];
let hymn = [];
let servicerList = {};
let currentLyricsSections = [];
let currentTitleInfo = null;
const HYMN_RECOMMENDATION_ENDPOINT = "https://tjckousei.com/api/v1/hymn-recommendations/index.php";
const fallbackHymnRecommendationGroups = [
  { label: "聖餐式", songs: ["194", "195", "196"] }
];
let hymnRecommendationGroups = [];
let activeHymnRecommendationLabel = "";

let currentMode = "title";

let abbre = "", syou = "", setu = "";
let disp_worship_font = 4.0, disp_jtitle_font = 5.0, disp_ctitle_font = 5.0, disp_person_font = 5.0;

let currentServicerFilter = "all";
let tempGASData = null; // GASから取得した一時的なデータを保持する変数

// ==========================================
// LOGO DISPLAY SETTINGS
// ==========================================
let logoDisplaySettings = {
  titleLogoWidth: 250,
  bibleLogoHeight: 18
};

function loadLogoSettings() {
  const saved = localStorage.getItem("logoDisplaySettings");
  if (saved) {
    try {
      logoDisplaySettings = { ...logoDisplaySettings, ...JSON.parse(saved) };
    } catch (e) { console.warn("logo settings parse error", e); }
  }
}

function saveLogoSettings() {
  localStorage.setItem("logoDisplaySettings", JSON.stringify(logoDisplaySettings));
}

function updateLogoSetting(key, value) {
  logoDisplaySettings[key] = parseFloat(value);
  saveLogoSettings();
  applyLogoSettings();
}

function applyLogoSettings() {
  if (display_win && !display_win.closed) {
    const root = display_win.document.documentElement;
    root.style.setProperty('--title-logo-width', logoDisplaySettings.titleLogoWidth + 'px');
    root.style.setProperty('--bible-logo-height', logoDisplaySettings.bibleLogoHeight + 'vh');
  }
}

// ==========================================
// BIBLE DISPLAY SETTINGS
// ==========================================
let bibleDisplaySettings = {
  bodyMax: 80,
  refScale: 1.0
};

function loadBibleSettings() {
  const saved = localStorage.getItem("bibleDisplaySettings");
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      bibleDisplaySettings = { ...bibleDisplaySettings, ...parsed };
    } catch (e) { console.warn("bible settings parse error", e); }
  }
}

function saveBibleSettings() {
  localStorage.setItem("bibleDisplaySettings", JSON.stringify(bibleDisplaySettings));
}

function updateBibleSetting(key, value) {
  bibleDisplaySettings[key] = parseFloat(value);
  saveBibleSettings();
  if (display_win && !display_win.closed && currentMode === "bible") {
    // DOMを再生成して確実にMutationObserverを発火させ、
    // また表示文字自体も最新状態にアップデートする
    showBible();
  }
}

function resetBibleSettings() {
  bibleDisplaySettings.bodyMax = 80;
  bibleDisplaySettings.refScale = 1.0;
  
  const elMax = document.getElementById("setting_bible_body_max");
  const elScale = document.getElementById("setting_bible_ref_scale");
  if(elMax) elMax.value = bibleDisplaySettings.bodyMax;
  if(elScale) elScale.value = bibleDisplaySettings.refScale;
  
  updateBibleSetting('bodyMax', 80);
  updateBibleSetting('refScale', 1.0);
}

// ==========================================
// GEMINI API TRANSLATION SETTINGS
// ==========================================
let geminiSettings = {
  apiKey: '',
  model: 'gemini-3-flash-preview',
  customModel: ''
};

function loadGeminiSettings() {
  const saved = localStorage.getItem('geminiSettings');
  if (saved) {
    try {
      geminiSettings = { ...geminiSettings, ...JSON.parse(saved) };
    } catch (e) {
      console.warn("Failed to parse geminiSettings", e);
    }
  }
  updateTranslateButtonsVisibility();
  fetchAvailableModels(); // モデル一覧の動的取得を開始
}

let isModelsFetched = false;

async function fetchAvailableModels() {
  if (isModelsFetched) return;
  try {
    const response = await fetch('https://runaaa0712.weblike.jp/MyApp/available-api/api.php');
    if (!response.ok) throw new Error('Network response error');
    const data = await response.json();
    if (data.status === 'success' && data.models) {
      const select = document.getElementById('geminiModel');
      if (!select) return;
      
      const currentValue = geminiSettings.model;
      select.innerHTML = ''; // クリア
      
      data.models.forEach((m, index) => {
        const option = document.createElement('option');
        // 'models/' プレフィックスを削除
        const modelId = m.id.replace('models/', '');
        option.value = modelId;
        option.textContent = `${index + 1}. ${m.displayName}`;
        select.appendChild(option);
      });
      
      const customOption = document.createElement('option');
      customOption.value = 'custom';
      customOption.textContent = `${data.models.length + 1}. 自分でモデルを入力`;
      select.appendChild(customOption);
      
      // 選択状態の復元
      if (Array.from(select.options).some(opt => opt.value === currentValue) || currentValue === 'custom') {
        select.value = currentValue;
      } else if (select.options.length > 0) {
        select.selectedIndex = 0;
        geminiSettings.model = select.value;
      }
      
      isModelsFetched = true;
      toggleCustomModelInput();
    }
  } catch (error) {
    console.warn('モデル一覧の取得に失敗しました:', error);
  }
}

function saveGeminiSettings() {
  const keyInput = document.getElementById('geminiApiKey').value.trim();
  const modelSelect = document.getElementById('geminiModel').value;
  const customInput = document.getElementById('geminiCustomModel').value.trim();

  // APIキーの簡易書式チェック (入力がある場合のみ)
  if (keyInput) {
    // Gemini APIキーは通常 "AIza" から始まり、39文字程度の長さを持つ
    if (!keyInput.startsWith('AIza') || keyInput.length < 30) {
      alert('APIキーの形式が正しくないようです。\n"AIza" から始まる有効なGemini APIキーを入力してください。');
      return; // 保存中断
    }
  }

  geminiSettings.apiKey = keyInput;
  geminiSettings.model = modelSelect;
  geminiSettings.customModel = customInput;

  localStorage.setItem('geminiSettings', JSON.stringify(geminiSettings));
  closeGeminiSettings();
  updateTranslateButtonsVisibility();
  showToast('翻訳設定を保存しました', 'success');
}

function updateTranslateButtonsVisibility() {
  const btns = document.querySelectorAll('.translate-btn');
  const hasKey = !!geminiSettings.apiKey;
  btns.forEach(btn => {
    btn.style.display = hasKey ? 'inline-block' : 'none';
  });
}

function openGeminiSettings() {
  const modal = document.getElementById("geminiSettingsModal");
  if (modal) {
    document.getElementById('geminiApiKey').value = geminiSettings.apiKey;
    document.getElementById('geminiModel').value = geminiSettings.model;
    document.getElementById('geminiCustomModel').value = geminiSettings.customModel || '';
    toggleCustomModelInput();
    
    // 開くたびに再取得を試みる（未取得の場合）
    if (!isModelsFetched) {
      fetchAvailableModels().then(() => {
        document.getElementById('geminiModel').value = geminiSettings.model;
        toggleCustomModelInput();
      });
    }

    // 動画の遅延読み込み
    const video = document.getElementById('tutorial-video');
    if (video && !video.src) {
      video.src = video.getAttribute('data-src');
    }

    modal.style.display = "block";
  }
}

function closeGeminiSettings() {
  const modal = document.getElementById("geminiSettingsModal");
  if (modal) modal.style.display = "none";
  
  // モーダルを閉じたときに動画を止める
  const video = document.getElementById('tutorial-video');
  if (video && !video.paused) {
    video.pause();
  }
}

function toggleCustomModelInput() {
  const modelSelect = document.getElementById('geminiModel').value;
  const customInput = document.getElementById('geminiCustomModel');
  if (modelSelect === 'custom') {
    customInput.style.display = 'block';
  } else {
    customInput.style.display = 'none';
  }
}

// 翻訳実行関数
async function translateTitle(direction) {
  if (!geminiSettings.apiKey) {
    showToast('APIキーが設定されていません。基本情報の歯車アイコンの隣の設定ボタンから設定してください。', 'error');
    openGeminiSettings();
    return;
  }

  let sourceText = '';
  let targetInputId = '';
  let systemPrompt = '';
  const jtitleInput = document.getElementById('jtitle');
  const ctitleInput = document.getElementById('ctitle');

  if (direction === 'j2c') {
    sourceText = jtitleInput.value.trim();
    if (!sourceText) {
      showToast('日本語タイトルを入力してください', 'error');
      return;
    }
    targetInputId = 'ctitle';
    systemPrompt = `あなたはキリスト教の専門的な翻訳者です。以下の日本語のタイトルを中国語に翻訳してください。
出力はJSON形式で行い、異なるニュアンスや表現を用いた3つの翻訳候補を配列として返してください。
フォーマット例: 
[
  "候補1",
  "候補2",
  "候補3"
]
余計な解説やテキストは含めず、純粋なJSON配列のみを出力してください。`;
  } else if (direction === 'c2j') {
    sourceText = ctitleInput.value.trim();
    if (!sourceText) {
      showToast('中国語タイトルを入力してください', 'error');
      return;
    }
    targetInputId = 'jtitle';
    systemPrompt = `あなたはキリスト教の専門的な翻訳者です。以下の中国語のタイトルを日本語に翻訳してください。
出力はJSON形式で行い、異なるニュアンスや表現を用いた3つの翻訳候補を配列として返してください。
フォーマット例: 
[
  "候補1",
  "候補2",
  "候補3"
]
余計な解説やテキストは含めず、純粋なJSON配列のみを出力してください。`;
  }

  const modelName = geminiSettings.model === 'custom' ? geminiSettings.customModel : geminiSettings.model;
  if (!modelName) {
    showToast('モデル名が正しく設定されていません', 'error');
    return;
  }

  // 実行中UIの制御
  const btns = document.querySelectorAll('.translate-btn');
  btns.forEach(btn => btn.disabled = true);
  const originalCtitle = ctitleInput.value;
  const originalJtitle = jtitleInput.value;

  try {
    const isGemma = modelName.toLowerCase().includes('gemma');
    let requestBody;

    if (isGemma) {
      // system_instruction 非対応モデルの場合は contents に含める
      requestBody = {
        contents: [{
          parts: [{ text: systemPrompt + "\n\n" + sourceText }]
        }],
        generationConfig: {
          temperature: 0.1,
        }
      };
    } else {
      // 標準モデル（Geminiシリーズ）
      requestBody = {
        system_instruction: {
          parts: [{ text: systemPrompt }]
        },
        contents: [{
          parts: [{ text: sourceText }]
        }],
        generationConfig: {
          temperature: 0.1,
        }
      };
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiSettings.apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      let errorMsg = `HTTP Error ${response.status}`;
      try {
        const errData = await response.json();
        if (errData.error && errData.error.message) {
          errorMsg = errData.error.message;
        } else if (errData.error && errData.error.details) {
           errorMsg = JSON.stringify(errData.error.details);
        }
      } catch (e) {
        // failed to parse json
      }
      throw new Error(errorMsg);
    }

    const data = await response.json();
    let translatedText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    
    // JSONのクリーンアップ（マークダウンの ```json などが含まれる場合があるため）
    if (translatedText.startsWith('```json')) {
      translatedText = translatedText.replace(/```json/g, '').replace(/```/g, '').trim();
    } else if (translatedText.startsWith('```')) {
      translatedText = translatedText.replace(/```/g, '').trim();
    }

    try {
      const candidates = JSON.parse(translatedText);
      if (Array.isArray(candidates) && candidates.length > 0) {
         showTranslationCandidates(candidates, targetInputId);
      } else {
         throw new Error("配列ではありません");
      }
    } catch (parseError) {
      // JSONパース失敗時はフォールバックとして最初の行やテキスト全体を使う
      console.warn("JSON parsing failed, falling back to raw text.", parseError);
      showTranslationCandidates([translatedText], targetInputId);
    }
  } catch (error) {
    console.error('Translation Error:', error);
    // エラー内容はトーストで表示する
    showToast(`翻訳エラー: ${error.message}`, 'error');
    
    // エラー時は元に戻す
    if (direction === 'j2c') ctitleInput.value = originalCtitle;
    if (direction === 'c2j') jtitleInput.value = originalJtitle;
  } finally {
    // UIを元に戻す
    btns.forEach(btn => btn.disabled = false);
  }
}

// 翻訳候補を表示する
function showTranslationCandidates(candidates, targetInputId) {
  const modal = document.getElementById('translationResultModal');
  const container = document.getElementById('translationCandidates');
  container.innerHTML = ''; // クリア

  candidates.forEach(candidateText => {
    const btn = document.createElement('button');
    btn.className = 'display-btn';
    btn.style.textAlign = 'left';
    btn.style.padding = '15px';
    btn.style.fontSize = '1.1rem';
    btn.style.backgroundColor = '#f5f5f5';
    btn.style.border = '1px solid #ddd';
    btn.style.marginBottom = '5px';
    
    btn.innerText = candidateText;
    btn.onclick = () => selectTranslation(candidateText, targetInputId);
    
    // ホバーエフェクト
    btn.onmouseover = () => btn.style.backgroundColor = '#e0f7fa';
    btn.onmouseout = () => btn.style.backgroundColor = '#f5f5f5';
    
    container.appendChild(btn);
  });

  modal.style.display = 'block';
}

// 候補を選択した時の処理
function selectTranslation(text, targetInputId) {
  document.getElementById(targetInputId).value = text;
  document.getElementById('translationResultModal').style.display = 'none';
  commit(); // プレビュー反映
  showToast('翻訳を適用しました', 'success');
}

// ==========================================
// COLOR CUSTOMIZATION
// ==========================================
const COLOR_DEFAULTS = {
  // 基本情報表示モード
  title_worship: '#3A8FB7',
  title_jtitle: '#171C6B',
  title_ctitle: '#5C6BC0',
  title_speech: '#000000',
  title_translator: '#000000',
  title_hymn: '#000000',
  // 聖書表示モード
  bible_header_bg: '#20604F',
  bible_header_text: '#FFFFFF',
  bible_worship: '#FAD689',
  bible_jtitle: '#FFFFFF',
  bible_ctitle: '#A5D6A7',
  bible_ref: '#E53935',
  bible_body: '#000000',
};

let colorSettings = {};

function loadColorSettings() {
  const saved = localStorage.getItem('colorSettings');
  if (saved) {
    try {
      colorSettings = { ...COLOR_DEFAULTS, ...JSON.parse(saved) };
    } catch (e) {
      colorSettings = { ...COLOR_DEFAULTS };
    }
  } else {
    colorSettings = { ...COLOR_DEFAULTS };
  }
}

function saveColorSettings() {
  localStorage.setItem('colorSettings', JSON.stringify(colorSettings));
}

function resetColorSettings() {
  colorSettings = { ...COLOR_DEFAULTS };
  saveColorSettings();
  // UIのカラーピッカーを更新
  for (const key in COLOR_DEFAULTS) {
    const picker = document.getElementById('color_' + key);
    if (picker) picker.value = COLOR_DEFAULTS[key];
  }
  // 表示に反映
  applyColors();
  showToast('色設定をデフォルトに戻しました', 'info');
}

// ==========================================
// TICKER CUSTOMIZATION
// ==========================================
let showTicker = true;

function loadTickerSettings() {
  const saved = localStorage.getItem('showTicker');
  if (saved !== null) {
    showTicker = saved === 'true';
  } else {
    showTicker = true;
  }
  const tickerCb = document.getElementById('setting_show_ticker');
  if (tickerCb) {
    tickerCb.checked = showTicker;
  }
}

function saveTickerSettings() {
  localStorage.setItem('showTicker', showTicker);
}

function toggleTicker(checked) {
  showTicker = checked;
  saveTickerSettings();
  applyTicker();
}

function applyTicker() {
  if (!display_win || display_win.closed) return;
  const dBody = display_win.document.body;
  if (showTicker) {
    dBody.classList.remove('hide-ticker');
  } else {
    dBody.classList.add('hide-ticker');
  }
}

function onColorChange(key, value) {
  colorSettings[key] = value;
  saveColorSettings();
  applyColors();
}

function applyColors() {
  if (!display_win || display_win.closed) return;
  const doc = display_win.document;

  // 基本情報表示モード
  const tWorship = doc.getElementById('t_worship');
  const tThemaJa = doc.getElementById('t_thema_ja');
  const tThemaCh = doc.getElementById('t_thema_ch');
  const tSpeech = doc.getElementById('t_speech');
  const tTranslator = doc.getElementById('t_translator');
  const tHymn = doc.getElementById('t_hymn');

  if (tWorship) tWorship.style.color = colorSettings.title_worship;
  if (tThemaJa) tThemaJa.style.color = colorSettings.title_jtitle;
  if (tThemaCh) tThemaCh.style.color = colorSettings.title_ctitle;
  if (tSpeech) tSpeech.style.color = colorSettings.title_speech;
  if (tTranslator) tTranslator.style.color = colorSettings.title_translator;
  if (tHymn) tHymn.style.color = colorSettings.title_hymn;

  // 聖書表示モード
  const bHeader = doc.getElementById('b_header');
  const bOut = doc.getElementById('b_out');
  if (bHeader) {
    bHeader.style.backgroundColor = colorSettings.bible_header_bg;
    bHeader.style.color = colorSettings.bible_header_text;
  }
  if (bOut) bOut.style.color = colorSettings.bible_body;

  // 聖書ヘッダー内の個別要素
  const bWorship = doc.getElementById('b_worship');
  const bThemaJp = doc.getElementById('b_thema-jp');
  const bThemaCh = doc.getElementById('b_thema-ch');
  if (bWorship) bWorship.style.color = colorSettings.bible_worship;
  if (bThemaJp) bThemaJp.style.color = colorSettings.bible_jtitle;
  if (bThemaCh) bThemaCh.style.color = colorSettings.bible_ctitle;

  // 聖書本文・箇所
  const refRows = doc.querySelectorAll('.bible_ref_row');
  refRows.forEach(r => r.style.color = colorSettings.bible_ref);
  const targetRefs = doc.querySelectorAll('.target_ref_jp, .target_ref_ch');
  targetRefs.forEach(r => r.style.setProperty('color', colorSettings.bible_ref, 'important'));

  const bodyRows = doc.querySelectorAll('.bible_body_row');
  bodyRows.forEach(b => b.style.color = colorSettings.bible_body);
}

// フル名称データ (略称に対応するフル名称)
const FullNameJP = [
  "創世記", "出エジプト記", "レビ記", "民数記", "申命記", "ヨシュア記", "士師記", "ルツ記", "サムエル記上", "サムエル記下",
  "列王記上", "列王記下", "歴代志上", "歴代志下", "エズラ記", "ネヘミヤ記", "エステル記", "ヨブ記", "詩篇", "箴言",
  "伝道の書", "雅歌", "イザヤ書", "エレミヤ書", "哀歌", "エゼキエル書", "ダニエル書", "ホセア書", "ヨエル書", "アモス書",
  "オバデア書", "ヨナ書", "ミカ書", "ナホム書", "ハバクク書", "ゼパニヤ書", "ハガイ書", "ゼカリヤ書", "マラキ書",
  "マタイによる福音書", "マルコによる福音書", "ルカによる福音書", "ヨハネによる福音書", "使徒行伝", "ローマ人への手紙",
  "コリント人への第一の手紙", "コリント人への第二の手紙", "ガラテヤ人への手紙", "エペソ人への手紙", "ピリピ人への手紙",
  "コロサイ人への手紙", "テサロニケ人への第一の手紙", "テサロニケ人への第二の手紙", "テモテへの第一の手紙",
  "テモテへの第二の手紙", "テトスへの手紙", "ピレモンへの手紙", "ヘブル人への手紙", "ヤコブの手紙", "ペテロの第一の手紙",
  "ペテロの第二の手紙", "ヨハネの第一の手紙", "ヨハネの第二の手紙", "ヨハネの第三の手紙", "ユダの手紙", "ヨハネの黙示録",
];

const FullNameCH = [
  "创世记", "出埃及记", "利未记", "民数记", "申命记", "约书亚记", "士师记", "路得记", "撒母耳记上", "撒母耳记下",
  "列王纪上", "列王纪下", "历代志上", "历代志下", "以斯拉记", "尼希米记", "以斯帖记", "约伯记", "诗篇", "箴言",
  "传道书", "雅歌", "以赛亚书", "耶利米书", "耶利米哀歌", "以西结书", "但以理书", "何西阿书", "约珥书", "阿摩司书",
  "俄巴底亚书", "约拿书", "弥迦书", "那鸿书", "哈巴谷书", "西番雅书", "哈该书", "撒迦利亚书", "玛拉基书",
  "马太福音", "马可福音", "路加福音", "约翰福音", "使徒行传", "罗马书", "哥林多前书", "哥林多后书", "加拉太书",
  "以弗所书", "腓立比书", "歌罗西书", "帖撒罗尼迦前书", "帖撒罗尼迦后书", "提摩太前书", "提摩太后书", "提多书",
  "腓利门书", "希伯来书", "雅各书", "彼得前书", "彼得后书", "约翰一书", "约翰二书", "约翰三书", "犹大书", "启示录",
];

// ==========================================
// 2. INITIALIZATION & DATA LOADING
// ==========================================
let db;
let lang_type_id = 'ja_ot';
let bibleSearchModal, openSearchModalBtn, closeSearchModalBtn, searchInput, executeSearchBtn, searchResultsDiv;

// ==========================================
// 2. INITIALIZATION & DATA LOADING (CSV, GAS)
// ==========================================

function updateProgress(percent, message) {
  const bar = document.getElementById("progress-bar");
  const detail = document.getElementById("loading-detail");
  if (bar) bar.style.width = percent + "%";
  if (detail) detail.innerText = message;
}

function loadCSVAsync(url) {
  return new Promise((resolve, reject) => {
    let req = new XMLHttpRequest();
    req.open("get", url, true);
    req.overrideMimeType("text/plain; charset=utf-8");
    req.onload = () =>
      req.status >= 200 && req.status < 300
        ? resolve(req.responseText)
        : reject(req.statusText);
    req.onerror = () => reject(req.statusText);
    req.send(null);
  });
}

function convertbibleCSVtoArray(str) {
  let tmp = str.split("\n");
  for (let i = 0; i < tmp.length; ++i) bible[i] = tmp[i].split(",");
}

function converthymnCSVtoArray(str) {
  let tmp = str.split("\n");
  const hymnlist = document.getElementById("hymnlist");
  for (let i = 1; i < tmp.length; ++i) {
    hymn[i] = tmp[i].split(",");
    let option = document.createElement("option");
    option.value = hymn[i][0].trim();
    hymnlist.appendChild(option);
  }
}

function normalizeHymnRecommendationGroups(groups) {
  if (!Array.isArray(groups)) return [];

  return groups
    .filter((group) => group && group.label)
    .map((group) => ({
      label: String(group.label).trim(),
      songs: Array.isArray(group.songs)
        ? group.songs.map((song) => String(song).trim()).filter(Boolean)
        : []
    }))
    .filter((group) => group.label);
}

function convertHymnRecommendationRowsToGroups(rows) {
  if (!Array.isArray(rows)) return [];

  const groupMap = new Map();

  rows.forEach((row) => {
    if (!row || !row.label || !row.song) return;

    const label = String(row.label).trim();
    const song = String(row.song).trim();
    if (!label || !song) return;

    if (!groupMap.has(label)) {
      groupMap.set(label, []);
    }

    groupMap.get(label).push(song);
  });

  return Array.from(groupMap.entries()).map(([label, songs]) => ({ label, songs }));
}

function renderHymnRecommendationSongs(label) {
  const songsWrap = document.getElementById("hymn-recommendation-songs");
  if (!songsWrap) return;

  if (!label) {
    songsWrap.innerHTML = "";
    return;
  }

  const selectedGroup = hymnRecommendationGroups.find((group) => group.label === label);
  const songs = selectedGroup && Array.isArray(selectedGroup.songs) ? selectedGroup.songs : [];

  if (!songs.length) {
    songsWrap.innerHTML = '<span class="hymn-recommendation-empty">候補曲はまだ登録されていません。</span>';
    return;
  }

  songsWrap.innerHTML = songs
    .map((song) => `<button type="button" class="hymn-recommendation-song" data-song="${escapeHTML(song)}">${escapeHTML(song)}</button>`)
    .join("");

  songsWrap.querySelectorAll(".hymn-recommendation-song").forEach((button) => {
    button.addEventListener("click", () => applyRecommendedHymn(button.dataset.song || ""));
  });
}

function renderHymnRecommendationGroups(groups) {
  const tagsWrap = document.getElementById("hymn-recommendation-tags");
  const songsWrap = document.getElementById("hymn-recommendation-songs");
  const panel = document.getElementById("hymn-recommendation-panel");
  if (!tagsWrap || !songsWrap || !panel) return;

  hymnRecommendationGroups = normalizeHymnRecommendationGroups(groups);

  if (!hymnRecommendationGroups.length) {
    panel.style.display = "none";
    return;
  }

  panel.style.display = "";
  tagsWrap.innerHTML = hymnRecommendationGroups
    .map((group) => {
      const isActive = activeHymnRecommendationLabel === group.label;
      return `<button type="button" class="hymn-recommendation-tag${isActive ? " active" : ""}" data-label="${escapeHTML(group.label)}">${escapeHTML(group.label)}</button>`;
    })
    .join("");

  if (!hymnRecommendationGroups.some((group) => group.label === activeHymnRecommendationLabel)) {
    activeHymnRecommendationLabel = "";
  }

  renderHymnRecommendationSongs(activeHymnRecommendationLabel);

  tagsWrap.querySelectorAll(".hymn-recommendation-tag").forEach((button) => {
    button.addEventListener("click", () => {
      const label = button.dataset.label || "";
      activeHymnRecommendationLabel = activeHymnRecommendationLabel === label ? "" : label;
      tagsWrap.querySelectorAll(".hymn-recommendation-tag").forEach((tag) => tag.classList.remove("active"));

      if (activeHymnRecommendationLabel) {
        button.classList.add("active");
      }

      renderHymnRecommendationSongs(activeHymnRecommendationLabel);
    });
  });
}

async function loadHymnRecommendations() {
  renderHymnRecommendationGroups(fallbackHymnRecommendationGroups);

  try {
    const response = await fetch(HYMN_RECOMMENDATION_ENDPOINT, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json();
    if (!payload || (!Array.isArray(payload.groups) && !Array.isArray(payload.rows))) {
      throw new Error("Invalid response format");
    }

    const groups = Array.isArray(payload.groups)
      ? payload.groups
      : convertHymnRecommendationRowsToGroups(payload.rows);

    renderHymnRecommendationGroups(groups);
  } catch (error) {
    console.warn("讃美歌候補の取得に失敗したため、ローカル設定を使用します。", error);
  }
}

function applyRecommendedHymn(song) {
  const normalizedSong = String(song || "").trim().replace(/[^(0-9)(甲乙)]/g, "");
  if (!normalizedSong) return;

  const prehymnInput = document.getElementById("prehymn");
  if (!prehymnInput) return;

  prehymnInput.value = normalizedSong;
  recievehymn(normalizedSong);
  showToast(`讃美歌 ${normalizedSong} を表示しました`, "success");
}

async function loadInitialData() {
  const overlay = document.getElementById("loading-overlay");
  updateProgress(5, "接続を開始します...");
  const urlParams = new URLSearchParams(window.location.search);
  const churchName = urlParams.get("church");
  const GAS_WEB_APP_URL =
    "https://script.google.com/macros/s/AKfycbyWVCbzcHS9n1ZzL21kLOLmjOJJT7s1U0qksIksyAbBYoA_k7iMKnQneYt1oveRwpBz/exec";

  try {
    if (churchName) {
      updateProgress(15, `設定データを取得中 (${churchName})...`);
      const response = await fetch(
        `${GAS_WEB_APP_URL}?church=${encodeURIComponent(churchName)}`
      );
      if (response.ok) {
        let recievedData = await response.json();
        if (recievedData) {
          servicerList = recievedData;
          tempGASData = recievedData; // データを一時保存
          // 登録ボタンをUI上に表示させる（ID: gas-import-btn はHTMLに作成）
          const isImported = localStorage.getItem(`imported`);
          const importBtn = document.getElementById("gas-import-btn");

          if (importBtn && !isImported) {
            importBtn.style.display = "inline-block";
          }

          const sekkyoulist = document.getElementById("sekkyoulist");
          const tuyakulist = document.getElementById("tuyakulist");
          for (const keys in servicerList) {
            for (const key in servicerList[keys]) {
              if (servicerList[keys][key].role == "sekkyou") {
                let sekkyou = document.createElement("option");
                sekkyou.value = servicerList[keys][key].name;
                sekkyoulist.appendChild(sekkyou);
              } else if (servicerList[keys][key].role == "tuyaku") {
                let tuyaku = document.createElement("option");
                tuyaku.value = servicerList[keys][key].name;
                tuyakulist.appendChild(tuyaku);
              }
            }
          }
        }
      }
    }
    updateProgress(40, "聖書データを読み込んでいます...");
    const bibleData = await loadCSVAsync("./Data.csv");
    convertbibleCSVtoArray(bibleData);
    updateProgress(75, "讃美歌データを読み込んでいます...");
    const hymnData = await loadCSVAsync("./hymn.csv");
    converthymnCSVtoArray(hymnData);
    await loadHymnRecommendations();
    updateProgress(100, "準備完了！");
    setTimeout(() => {
      if (overlay) overlay.classList.add("hidden");
    }, 800);
  } catch (error) {
    console.error(error);
    updateProgress(100, "エラーが発生しました");
    alert("データの読み込みに失敗しました。");
  }
}

// ボタンクリックで呼ばれる一括登録関数
function importGASDataToDB() {
  if (!tempGASData) return;
  if (!confirm("GASから取得した名簿をブラウザのデータベースに登録しますか？")) return;

  const transaction = db.transaction(["servicers"], "readwrite");
  const store = transaction.objectStore("servicers");

  // すでに登録されている名前を取得して重複を避ける（任意）
  store.getAll().onsuccess = (e) => {
    const existingNames = e.target.result.map(s => s.name);

    // GASデータの階層構造に合わせてループ（servicerList[keys][key] の構造を想定）
    for (const keys in tempGASData) {
      for (const key in tempGASData[keys]) {
        const item = tempGASData[keys][key];
        // 重複していなければ追加
        if (!existingNames.includes(item.name)) {
          store.add({ name: item.name, role: item.role });
        }
      }
    }
  };

  transaction.oncomplete = () => {
    // インポート済みフラグをLocalStorageに保存
    localStorage.setItem(`imported`, "true");

    alert("一括登録が完了しました。");
    updateDatalistFromDB(); // リストを更新
    document.getElementById("gas-import-btn").style.display = "none"; // ボタンを隠す
  };
}

// ==========================================
// 3. DATABASE CONTROL (IndexedDB)
// ==========================================

function initDB() {
  const request = indexedDB.open('TJC_Meeting_DB', 1);
  request.onupgradeneeded = function (e) {
    db = e.target.result;
    if (!db.objectStoreNames.contains("servicers")) {
      const objectStore = db.createObjectStore("servicers", { keyPath: "id", autoIncrement: true });
      objectStore.createIndex("role", "role", { unique: false });
      // 追加: orderフィールドのインデックス
      objectStore.createIndex("order", "order", { unique: false });
    }
  };
  request.onsuccess = function (e) {
    db = e.target.result;
    updateDatalistFromDB();
  };
}

function ensureOrderFields(allData, store) {
  let modified = false;
  // 最大のorderを見つける（新規追加時の基準用）
  let maxOrder = 0;

  allData.forEach(item => {
    if (item.order && item.order > maxOrder) {
      maxOrder = item.order;
    }
  });

  allData.forEach(item => {
    if (typeof item.order === 'undefined') {
      maxOrder += 10;
      item.order = maxOrder;
      store.put(item);
      modified = true;
    }
  });
  return modified;
}

// 入力候補（select）を最新の状態に更新する関数
function updateDatalistFromDB() {
  const sekkyoulist = document.getElementById("sekkyoulist");
  const tuyakulist = document.getElementById("tuyakulist");
  const sekkyouSelect = document.getElementById("sekkyouSelect");
  const tuyakuSelect = document.getElementById("tuyakuSelect");

  // 一旦クリア
  if (sekkyoulist) sekkyoulist.innerHTML = "";
  if (tuyakulist) tuyakulist.innerHTML = "";
  if (sekkyouSelect) sekkyouSelect.innerHTML = '<option value="">▼</option>';
  if (tuyakuSelect) tuyakuSelect.innerHTML = '<option value="">▼</option>';

  const transaction = db.transaction("servicers", "readonly");
  const store = transaction.objectStore("servicers");

  store.getAll().onsuccess = (e) => {
    const data = e.target.result;
    data.sort((a, b) => (a.order || 9999) - (b.order || 9999));
    data.forEach(s => {
      // datalist用のoption作成（後方互換）
      const listOption = document.createElement("option");
      listOption.value = s.name;
      // combobox用のoption作成
      const selectOption = document.createElement("option");
      selectOption.value = s.name;
      selectOption.textContent = s.name;

      if (s.role === "sekkyou") {
        if (sekkyoulist) sekkyoulist.appendChild(listOption);
        if (sekkyouSelect) sekkyouSelect.appendChild(selectOption);
      } else if (s.role === "tuyaku") {
        if (tuyakulist) tuyakulist.appendChild(listOption);
        if (tuyakuSelect) tuyakuSelect.appendChild(selectOption);
      }
    });

    // 初期化時、すでに入力欄にCookie等で値が入っている場合
    // comboboxの選択状態を同期する
    syncInputToSelect("speecher", "sekkyouSelect");
    syncInputToSelect("translator", "tuyakuSelect");
  };
}

// Selectが変更されたときInputに反映
function syncSelectToInput(inputId, selectElem) {
  const input = document.getElementById(inputId);
  if (selectElem.value) {
    input.value = selectElem.value;
    commit(); // 値が変わったのでタイトル画面にも反映
    selectElem.selectedIndex = 0; // 反映後に自動的にデフォルトに戻す
  }
}

// Inputの値に合わせてSelectの初期選択状態を合わせる
function syncInputToSelect(inputId, selectId) {
  const select = document.getElementById(selectId);
  if (!select) return;
  // 反映後やCookie復元後も常にデフォルト(▼)に戻す
  select.selectedIndex = 0;
}

function addServicerToDB() {
  const nameInput = document.getElementById("newServicerName");
  const roleSelect = document.getElementById("newServicerRole");
  const name = nameInput.value.trim();
  const role = roleSelect.value;
  if (!name) {
    showToast("名前を入力してください", "error");
    return;
  }
  const transaction = db.transaction(["servicers"], "readwrite");
  const store = transaction.objectStore("servicers");
  const addRequest = store.add({ name, role });

  addRequest.onsuccess = (e) => {
    nameInput.value = "";
    showToast("追加しました", "success");
    loadServicersList(currentServicerFilter);
    updateDatalistFromDB();
  };
  addRequest.onerror = (e) => {
    // 重複エラーなどの処理が必要なら追加
    showToast("追加に失敗しました", "error");
  };
}

function loadServicersList(filter) {
  const tbody = document.getElementById("servicerListTable");
  tbody.innerHTML = "";
  const transaction = db.transaction("servicers", "readwrite");
  const store = transaction.objectStore("servicers");

  store.getAll().onsuccess = (e) => {
    const allData = e.target.result;

    if (ensureOrderFields(allData, store)) {
        // 更新があった場合は、再度読み込み直す
        loadServicersList(filter);
        return;
    }

    // orderでソート
    allData.sort((a, b) => (a.order || 0) - (b.order || 0));

    let count = 0;
    allData.forEach(s => {
      if (filter === "all" || filter === s.role) {
        count++;
        const row = document.createElement("div");
        row.className = "servicer-item"; // was servicer-list-row, but style is servicer-item
        row.id = `servicer-row-${s.id}`;

        const roleLabel = s.role === "sekkyou" ? "🎤 説教者" : "🌐 通訳者";
        const roleClass = s.role === "sekkyou" ? "primary-text" : "secondary-text";

        row.ondragstart = handleDragStart;
        row.ondragover = handleDragOver;
        row.ondrop = handleDrop;
        row.ondragenter = handleDragEnter;
        row.ondragleave = handleDragLeave;
        row.ondragend = handleDragEnd;

        row.innerHTML = `
          <div class="servicer-drag-handle"
               onmousedown="this.parentElement.setAttribute('draggable', 'true')"
               onmouseup="this.parentElement.removeAttribute('draggable')"
               onmouseleave="this.parentElement.removeAttribute('draggable')">
            ≡
          </div>
          <div class="servicer-col-name servicer-name-display">${escapeHTML(s.name)}</div>
          <div class="servicer-col-role ${roleClass}"><small>${roleLabel}</small></div>
          <div class="servicer-col-action">
            <button onclick="editServicer(${s.id})" class="edit-btn" title="編集">✏️</button>
            <button onclick="deleteServicer(${s.id}, '${s.name}')" class="del-btn" title="削除">🗑️</button>
          </div>
        `;
        tbody.appendChild(row);
      }
    });

    document.getElementById("servicerCount").innerText = `${count} 名`;
  };
}

// === Drag and Drop Sorting for Servicers ===
let dragSrcEl = null;

function handleDragStart(e) {
  dragSrcEl = this;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', this.id);
  this.classList.add('dragging');
}

function handleDragOver(e) {
  if (e.preventDefault) {
    e.preventDefault(); // Necessary. Allows us to drop.
  }
  e.dataTransfer.dropEffect = 'move';
  return false;
}

function handleDragEnter(e) {
  this.classList.add('drag-over');
}

function handleDragLeave(e) {
  this.classList.remove('drag-over');
}

function handleDrop(e) {
  if (e.stopPropagation) {
    e.stopPropagation(); // Stops some browsers from redirecting.
  }

  if (dragSrcEl !== this) {
    let sourceIdStr = dragSrcEl.id.replace('servicer-row-', '');
    let targetIdStr = this.id.replace('servicer-row-', '');

    let sourceId = parseInt(sourceIdStr, 10);
    let targetId = parseInt(targetIdStr, 10);

    if(!isNaN(sourceId) && !isNaN(targetId)) {
        reorderServicers(sourceId, targetId);
    }
  }
  return false;
}

function handleDragEnd(e) {
  this.classList.remove('dragging');
  let rows = document.querySelectorAll('.servicer-list-row');
  [].forEach.call(rows, function (row) {
    row.classList.remove('drag-over');
  });
}

function reorderServicers(sourceId, targetId) {
  const transaction = db.transaction(["servicers"], "readwrite");
  const store = transaction.objectStore("servicers");

  store.getAll().onsuccess = (e) => {
    let allData = e.target.result;
    allData.sort((a, b) => (a.order || 0) - (b.order || 0));

    // 現在のフィルターで表示されている項目のみを対象とする
    let visibleData = allData.filter(s => currentServicerFilter === "all" || currentServicerFilter === s.role);

    const sourceIndex = visibleData.findIndex(item => item.id === sourceId);
    const targetIndex = visibleData.findIndex(item => item.id === targetId);

    if (sourceIndex === -1 || targetIndex === -1) return;

    // 配列内で要素を移動
    const [movedItem] = visibleData.splice(sourceIndex, 1);
    visibleData.splice(targetIndex, 0, movedItem);

    // 新しい順序を割り当て（間隔を10空ける）
    let currentOrder = 10;
    let orderUpdates = new Map();
    visibleData.forEach((item) => {
         orderUpdates.set(item.id, currentOrder);
         currentOrder += 10;
    });

    if (currentServicerFilter === "all") {
         visibleData.forEach((item, idx) => {
             item.order = (idx + 1) * 10;
             store.put(item);
         });
    } else {
         allData.forEach(item => {
             if(orderUpdates.has(item.id)) {
                 item.order = orderUpdates.get(item.id);
                 store.put(item);
             }
         });
    }
  };

  transaction.oncomplete = () => {
    loadServicersList(currentServicerFilter);
    updateDatalistFromDB();
  };
}

function editServicer(id) {
  const row = document.getElementById(`servicer-row-${id}`);
  const nameDiv = row.querySelector(".servicer-name-display");
  const currentName = nameDiv.innerText;

  row.innerHTML = `
    <div class="servicer-col-name" style="flex: 2;">
      <input type="text" id="edit-name-${id}" value="${escapeHTML(currentName)}" style="width: 100%; padding: 4px; box-sizing: border-box;">
    </div>
    <div class="servicer-col-role"></div>
    <div class="servicer-col-action">
      <button onclick="saveServicer(${id})" class="save-btn" style="width: auto;">保存</button>
      <button onclick="loadServicersList(currentServicerFilter)" class="cancel-btn" style="width: auto; margin-bottom: 0;">取消</button>
    </div>
  `;
}

function saveServicer(id) {
  const nameInput = document.getElementById(`edit-name-${id}`);
  const newName = nameInput.value.trim();

  if (!newName) {
    showToast("名前を入力してください", "error");
    return;
  }

  const transaction = db.transaction(["servicers"], "readwrite");
  const store = transaction.objectStore("servicers");

  store.get(id).onsuccess = (e) => {
    const data = e.target.result;
    data.name = newName;
    store.put(data);
  };

  transaction.oncomplete = () => {
    showToast("更新しました", "success");
    loadServicersList(currentServicerFilter);
    updateDatalistFromDB();
  };
}

function deleteServicer(id, name) {
  if (!confirm(`「${name}」を削除しますか？`)) return;
  const transaction = db.transaction(["servicers"], "readwrite");
  const store = transaction.objectStore("servicers");
  store.delete(id);

  transaction.oncomplete = () => {
    showToast("削除しました", "info");
    loadServicersList(currentServicerFilter);
    updateDatalistFromDB();
  };
}

function exportServicers() {
  const transaction = db.transaction(["servicers"], "readonly");
  const store = transaction.objectStore("servicers");
  store.getAll().onsuccess = (e) => {
    const data = e.target.result;
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "servicers_backup.json";
    a.click();
    URL.revokeObjectURL(url);
    showToast("エクスポートしました", "success");
  };
}

function importServicers(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (!Array.isArray(data)) throw new Error("不正なフォーマットです");

      const transaction = db.transaction(["servicers"], "readwrite");
      const store = transaction.objectStore("servicers");

      data.forEach(item => {
        if (item.name && item.role) {
          // IDは自動インクリメントさせるため削除するか維持するか要検討だがここではIDを含めない
          store.add({ name: item.name, role: item.role, order: item.order || new Date().getTime() });
        }
      });

      transaction.oncomplete = () => {
        showToast("インポートしました", "success");
        loadServicersList(currentServicerFilter);
        updateDatalistFromDB();
      };
    } catch (err) {
      showToast("インポートに失敗しました", "error");
      console.error(err);
    }
  };
  reader.readAsText(file);
  event.target.value = ""; // リセット
}

// ==========================================
// 4. DATA PROCESSING & UTILITIES
// ==========================================

function escapeHTML(str) {
  if (typeof str !== "string") return "";
  return str.replace(/[&<>"']/g, function (match) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[match];
  });
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

let allLyricsData = null;

async function recievehymn(value) {
  const lyricsArea = document.getElementById("lyrics_area");
  if (!lyricsArea) return;

  lyricsArea.innerHTML = "";
  currentTitleInfo = null;
  currentLyricsSections = [];

  if (display_win && !display_win.closed) {
    const doc = display_win.document;
    const hOutput = doc.getElementById("h_output");
    const hBgNum = doc.getElementById("h_bg_number");
    if (hOutput) hOutput.innerHTML = "";
    if (hBgNum) hBgNum.innerText = "";
  }

  if (!value) return;

  for (let n = 1; n < hymn.length; n++) {
    if (hymn[n][0].trim() === value.trim()) {
      currentTitleInfo = hymn[n];
      break;
    }
  }

  if (!currentTitleInfo) return;

  try {
    if (!allLyricsData) {
      const response = await fetch("https://tjckousei.com/hymn//api.php?action=get_all_lyrics");
      if (response.ok) {
        const json = await response.json();
        if (json.success) {
          allLyricsData = json.data;
        }
      }
    }

    const text = allLyricsData ? allLyricsData[`${value}.txt`] : null;

    if (text) {
      currentLyricsSections = parseLyrics(text);

      if (currentLyricsSections.length > 0) {
        let buttonsHTML = `<button onclick="switchScreen('hymn'); showTitleInPopup(); updateActiveButton(this);" class="lyric-btn" id="btn-title">タイトル</button>`;
        currentLyricsSections.forEach((sec, index) => {
          buttonsHTML += `<button onclick="switchScreen('hymn'); showLyricsVerse(${index}); updateActiveButton(this);" class="lyric-btn">${sec.label}</button>`;
        });
        lyricsArea.innerHTML = buttonsHTML;

        switchScreen("hymn");
        showTitleInPopup();
        const titleBtn = document.getElementById("btn-title");
        if (titleBtn) updateActiveButton(titleBtn);
      }
    } else {
      console.warn("歌詞データが見つかりませんでした:", value);
    }
  } catch (e) {
    console.warn("歌詞の取得に失敗しました:", value);
  }
}

async function reloadLyricsData() {
  try {
    showToast("最新の歌詞を取得しています...", "info");
    const response = await fetch("https://tjckousei.com/hymn//api.php?action=get_all_lyrics");
    if (response.ok) {
      const json = await response.json();
      if (json.success) {
        allLyricsData = json.data;
        showToast("歌詞データを最新に更新しました", "success");
        // もし現在選択中の讃美歌があれば再表示
        const prehymnInput = document.getElementById("prehymn");
        if (prehymnInput && prehymnInput.value) {
          recievehymn(prehymnInput.value.trim());
        }
      } else {
        showToast("歌詞データの更新に失敗しました", "error");
      }
    } else {
      showToast("通信エラーが発生しました", "error");
    }
  } catch (e) {
    console.error(e);
    showToast("エラーが発生しました", "error");
  }
}

function convertRuby(text) {
  return text.replace(
    /([一-龠々]+)\(([ぁ-んァ-ヶー]+)\)/g,
    "<ruby>$1<rt>$2</rt></ruby>"
  );
}

function parseLyrics(text) {
  const regex = /\[(.*?)\]/g;
  let match,
    lastIndex = 0,
    currentLabel = null;
  const sections = [];
  const processContent = (rawText) => {
    rawText = rawText.trim();
    if (!rawText) return "";
    let processed = convertRuby(rawText);
    return processed
      .split(/\r\n|\n/)
      .map((line) => {
        if (!line.trim()) return '<div style="min-height: 1.2em;">&nbsp;</div>';
        return `<div style="white-space: nowrap; text-align: center; margin: 2px 0;">${line}</div>`;
      })
      .join("");
  };
  while ((match = regex.exec(text)) !== null) {
    if (currentLabel)
      sections.push({
        label: currentLabel,
        content: processContent(text.substring(lastIndex, match.index)),
      });
    currentLabel = match[1];
    lastIndex = regex.lastIndex;
  }
  if (currentLabel)
    sections.push({
      label: currentLabel,
      content: processContent(text.substring(lastIndex)),
    });
  return sections;
}
function saveCookies() {
  document.cookie = "worship=" + document.getElementById("worship").value;
  document.cookie = "jtitle=" + document.getElementById("jtitle").value;
  document.cookie = "ctitle=" + document.getElementById("ctitle").value;
  document.cookie = "speecher=" + document.getElementById("speecher").value;
  document.cookie = "translator=" + document.getElementById("translator").value;
  document.cookie = "hymn=" + document.getElementById("hymn").value;
  document.cookie = "hymn2nd=" + document.getElementById("hymn2nd").value;
}

// ==========================================
// 5. UI EVENT LOGIC & MODALS
// ==========================================

function countVersesInChapter() {
  const display = document.getElementById("verse_count_display");
  const syouInput = document.getElementById("syou").value;
  if (!display) return;
  if (abbre === "" || !syouInput) {
    display.innerText = "";
    return;
  }
  const prefix = Abbre[abbre] + syouInput + ":";
  let count = 0;
  for (let i = 1; i < bible.length; i++)
    if (bible[i] && bible[i][3] && bible[i][3].indexOf(prefix) === 0) count++;
  display.innerText = count > 0 ? "この章の節数: " + count : "";
}

function memobible(num) {
  abbre = num;
  document.getElementById("syou").value = "";
  document.getElementById("setu").value = "";
  countVersesInChapter();
}
function memosyou(num) {
  syou = num;
  document.getElementById("setu").value = "";
  countVersesInChapter();
}
function memosetu(num) {
  setu = num;
}

function openwindow() {
  if (display_win && !display_win.closed) {
    display_win.focus();
  } else {
    display_win = window.open(
      "./popwindow/display.html",
      "display",
      "width=1500,height=800,scrollbars=yes,resizable=yes"
    );
  }
}

function openServicerManager() {
  const modal = document.getElementById("servicerManagerModal");
  if (modal) {
    modal.style.display = "block";
    loadServicersList("all");
  }
}

function closeServicerManager() {
  const modal = document.getElementById("servicerManagerModal");
  if (modal) modal.style.display = "none";
}
function filterServicerList(filter, btn) {
  currentServicerFilter = filter;
  document.querySelectorAll(".servicer-tab").forEach(t => t.classList.remove("active"));
  btn.classList.add("active");
  loadServicersList(filter);
}
function updateModeUI(mode) {
  const btnTitle = document.getElementById("btn-mode-title");
  const btnHymn = document.getElementById("btn-mode-hymn");
  const btnBible = document.getElementById("btn-mode-bible");
  const btnCapture = document.getElementById("btn-mode-capture");

  if (btnTitle) btnTitle.classList.remove("primary");
  if (btnHymn) btnHymn.classList.remove("primary");
  if (btnBible) btnBible.classList.remove("primary");
  if (btnCapture) btnCapture.classList.remove("primary");

  if (mode === "title" && btnTitle) btnTitle.classList.add("primary");
  else if (mode === "hymn" && btnHymn) btnHymn.classList.add("primary");
  else if (mode === "bible" && btnBible) btnBible.classList.add("primary");
  else if (mode === "capture" && btnCapture) btnCapture.classList.add("primary");
}

function updateActiveButton(activeBtn) {
  const buttons = document.querySelectorAll(".lyric-btn");
  buttons.forEach((btn) => btn.classList.remove("active"));
  if (activeBtn) activeBtn.classList.add("active");
}
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.innerText = message;
  toast.style.position = 'fixed';
  toast.style.bottom = '20px';
  toast.style.right = '20px';
  toast.style.padding = '12px 24px';
  toast.style.borderRadius = '8px';
  toast.style.color = 'white';
  toast.style.fontWeight = 'bold';
  toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
  toast.style.zIndex = '9999';
  toast.style.transition = 'opacity 0.3s ease';

  if (type === 'success') toast.style.backgroundColor = '#4CAF50';
  else if (type === 'error') toast.style.backgroundColor = '#F44336';
  else if (type === 'info') toast.style.backgroundColor = '#2196F3';

  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; }, 3000);
  setTimeout(() => { document.body.removeChild(toast); }, 3300);
}
function openBibleSearchModal() {
  if (bibleSearchModal) bibleSearchModal.style.display = "block";
  if (searchInput) searchInput.value = "";
  if (searchResultsDiv)
    searchResultsDiv.innerHTML = "<p>検索キーワードを入力して「検索」ボタンを押してください。</p>";

  if (typeof bible === "undefined" || !Array.isArray(bible) || bible.length === 0) {
    if (searchResultsDiv)
      searchResultsDiv.innerHTML = '<p style="color: red; font-weight: bold;">エラー: 聖書データが正しく読み込まれていません。</p>';
    if (searchInput) searchInput.disabled = true;
    if (executeSearchBtn) executeSearchBtn.disabled = true;
  } else {
    if (searchInput) searchInput.disabled = false;
    if (executeSearchBtn) executeSearchBtn.disabled = false;
  }
}

function closeBibleSearchModal() {
  if (bibleSearchModal) bibleSearchModal.style.display = "none";
}

function performSearch() {
  const query = searchInput.value.trim();
  if (!query) {
    searchResultsDiv.innerHTML = "<p>検索キーワードを入力してください。</p>";
    return;
  }
  const lowerCaseQuery = query.toLowerCase();
  const results = bible.filter((rowArray) => {
    const chineseReference = (rowArray[2] || "").toLowerCase();
    const japaneseReference = (rowArray[4] || "").toLowerCase();
    return chineseReference.includes(lowerCaseQuery) || japaneseReference.includes(lowerCaseQuery);
  });
  displayResults(results, query);
}

function displayResults(results, query) {
  searchResultsDiv.innerHTML = "";
  if (results.length === 0) {
    searchResultsDiv.innerHTML = "<p>「" + escapeHTML(query) + "」に一致する情報は見つかりませんでした。</p>";
    return;
  }
  const highlight = (text, queryToHighlight) => {
    if (!text || !queryToHighlight) return escapeHTML(text || "");
    const regex = new RegExp("(" + escapeRegExp(queryToHighlight) + ")", "gi");
    return escapeHTML(text).replace(regex, '<span class="highlight">$1</span>');
  };
  results.forEach((rowArray) => {
    const resultItem = document.createElement("div");
    resultItem.className = "result-item";
    const chFullText = rowArray[1] || "";
    const chReference = rowArray[2] || "";
    const jpFullText = rowArray[3] || "";
    const jpReference = rowArray[4] || "";
    let displayReferenceText =
      chReference && jpReference
        ? chReference === jpReference ? chReference : `${chReference} / ${jpReference}`
        : chReference || jpReference || "参照情報なし";
    let contentHTML = `<p class="verse-ref">${highlight(displayReferenceText, query)}</p>`;
    if (jpFullText) contentHTML += `<p><span class="lang-label">日本語:</span> ${highlight(jpFullText, query)}</p>`;
    if (chFullText) contentHTML += `<p><span class="lang-label">中文:</span> ${highlight(chFullText, query)}</p>`;
    const safeRef = (rowArray[3] || '').replace(/'/g, "\\'");
    contentHTML += `<button class="apply-verse-btn" onclick="applySearchResult('${safeRef}')">➜ 反映</button>`;
    resultItem.innerHTML = contentHTML;
    searchResultsDiv.appendChild(resultItem);
  });
}

function applySearchResult(jpRef) {
  if (!jpRef) return;
  for (let n = 1; n < bible.length; n++) {
    if (bible[n][3] === jpRef) {
      for (let i = Abbre.length - 1; i >= 0; i--) {
        if (jpRef.startsWith(Abbre[i])) {
          const rest = jpRef.substring(Abbre[i].length);
          const parts = rest.split(':');
          if (parts.length === 2) {
            abbre = i;
            syou = parts[0];
            setu = parts[1];
            document.getElementById('abbre_memo').innerHTML = Abbre[i];
            document.getElementById('syou').value = syou;
            document.getElementById('setu').value = setu;
            showBible();
            checkwindow('bible');
            countVersesInChapter();
            closeBibleSearchModal();
            showToast(`${Abbre[i]} ${syou}:${setu} を反映しました`, 'success');
            return;
          }
        }
      }
      break;
    }
  }
  showToast('参照情報を解析できませんでした', 'error');
}
function active_abbre(type) {
  const switch_lang = document.querySelectorAll(".switch");
  if (switch_lang[0].checked) {
    const id_name = "ja_" + type;
    document.getElementById(id_name).style.left = "0";
    lang_type_id = id_name;
  }
  if (switch_lang[1].checked) {
    const id_name = "ch_" + type;
    document.getElementById(id_name).style.left = "0";
    lang_type_id = id_name;
  }
}

function abbre_btn(num, value) {
  memobible(num);
  document.getElementById("abbre_memo").innerHTML = value;
  document.getElementById(lang_type_id).style.left = "-100vw";
}

function display_history(element, index) {
  if (index == 0) return;
  const arr = element[index].value.split(",");
  abbre = arr[0];
  syou = arr[1];
  setu = arr[2];
  const text = element[index].innerHTML;
  abbre_btn(abbre, text);
  document.getElementById("syou").value = syou;
  document.getElementById("setu").value = setu;
  showBible();
  element[0].selected = true;
  countVersesInChapter();
}

function append_history() {
  if (abbre === "" || syou === "" || setu === "") {
    showToast('聖書箇所を選択してください', 'error');
    return;
  }
  const history = document.getElementById("history");
  const option = document.createElement("option");
  option.value = abbre + "," + syou + "," + setu;
  option.innerHTML = document.getElementById("abbre_memo").innerHTML;
  option.label = document.getElementById("abbre_memo").innerHTML + " " + syou + ":" + setu;
  for (let n = 1; n < history.length; n++) {
    if (history[n].label == option.label) {
      history[n].remove();
      break;
    }
  }
  history[0].after(option);
  showToast('📌 聖句を記憶しました', 'success');
}

function clear_history() {
  const history = document.getElementById("history");
  if (history.length <= 1) {
    showToast('消去する履歴がありません', 'error');
    return;
  }
  if (!confirm('履歴をすべて消去しますか？')) return;
  history.innerHTML = `<option value="">📖 履歴</option>`;
  showToast('🗑️ 履歴を消去しました', 'info');
}

// ==========================================
// 6. DISPLAY POPUP CONTROL & SYNCHRONIZATION
// ==========================================

function switchScreen(mode) {
  if (!display_win || display_win.closed) return;
  currentMode = mode;
  updateModeUI(mode);
  const dBody = display_win.document.body;
  dBody.classList.remove("bible-mode", "title-mode", "hymn-mode", "capture-mode");
  dBody.classList.add(mode + "-mode");

  const views = ["bible-view", "title-view", "hymn-view", "capture-view"];
  views.forEach((v) => {
    const el = display_win.document.getElementById(v);
    if (el) el.style.display = "none";
  });
  const viewEl = display_win.document.getElementById(mode + "-view");
  if (viewEl) viewEl.style.display = "";
}

function checkwindow(mode) {
  let targetMode = "bible";
  if (mode === "bible_win" || mode === "bible") targetMode = "bible";
  if (mode === "title_win" || mode === "title") targetMode = "title";
  if (mode === "hymn_win" || mode === "hymn") targetMode = "hymn";
  if (mode === "capture") targetMode = "capture";

  if (display_win && !display_win.closed) {
    switchScreen(targetMode);
    if (targetMode === "bible") showBible();
    if (targetMode === "title") commit();
    display_win.focus();
  } else {
    openwindow();
    display_win.onload = () => {
      applyLogoSettings();
      switchScreen(targetMode);
      if (targetMode === "bible") showBible();
      if (targetMode === "title") commit();
    };
    display_win.focus();
  }
}

// ==========================================
// 7. SCREEN CAPTURE
// ==========================================
async function startCapture() {
  if (!display_win || display_win.closed) {
    openwindow();
    // 窓が開くまで少し待機してからキャプチャ開始
    setTimeout(async () => {
      await initializeCapture();
    }, 500);
  } else {
    // 既にストリームが存在してアクティブなら、取得済みのものを再利用して表示モードだけ切り替える
    if (captureStream && captureStream.active) {
      switchScreen("capture");
      updateCaptureButtons();
      return;
    }
    await initializeCapture();
  }
}

async function reselectCapture() {
  if (!display_win || display_win.closed) {
     openwindow();
  }
  // 既存のストリームがあれば一旦停止する
  stopCaptureTracks();
  await initializeCapture();
}

function stopCapture() {
  stopCaptureTracks();
  updateCaptureButtons();
  if (currentMode === "capture") {
    checkwindow("title"); // 切断時は基本情報画面に戻す
  }
}

function stopCaptureTracks() {
  if (captureStream) {
    captureStream.getTracks().forEach(track => track.stop());
    captureStream = null;
  }
}

function updateCaptureButtons() {
  const btnReselect = document.getElementById("btn-capture-reselect");
  const btnStop = document.getElementById("btn-capture-stop");
  
  if (captureStream && captureStream.active) {
    if (btnReselect) btnReselect.disabled = false;
    if (btnStop) btnStop.disabled = false;
  } else {
    if (btnReselect) btnReselect.disabled = true;
    if (btnStop) btnStop.disabled = true;
  }
}

let captureStream = null;

async function initializeCapture() {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      console.error("Screen Capture API is not supported in this environment.");
      alert("この環境では画面キャプチャがサポートされていません。\nhttps:// でアクセスするか、localhost (127.0.0.1) 環境で実行してください。");
      showToast("画面キャプチャ機能が利用できません", "error");
      return;
    }

    captureStream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        cursor: "always"
      },
      audio: false
    });
    
    switchScreen("capture");
    updateCaptureButtons();
    
    const doc = display_win.document;
    const videoElem = doc.getElementById('capture-video');
    if (videoElem) {
      videoElem.srcObject = captureStream;
      videoElem.play();
    }
    
    // ストリームが停止されたら(「共有を停止」ボタン押下など)
    captureStream.getVideoTracks()[0].onended = () => {
      stopCaptureTracks();
      updateCaptureButtons();
      if (currentMode === "capture") {
        checkwindow("title");
      }
    };
  } catch(err) {
    console.error("キャプチャエラー:", err);
    // ユーザーがキャンセルした場合などはエラーを出さずにリセットする
    stopCaptureTracks();
    updateCaptureButtons();
    if (err.name !== "NotAllowedError") {
      showToast("画面キャプチャの取得に失敗しました", "error");
    }
  }
}

function showBible() {
  if (!display_win || display_win.closed) return;
  let where = Abbre[abbre] + syou + ":" + setu;
  const outDiv = display_win.document.getElementById("b_out");
  for (let n = 1; n < bible.length; n++) {
    if (bible[n][3] == where) {
      outDiv.innerHTML = `<div id="master" data-bible-body-max="${bibleDisplaySettings.bodyMax}" data-bible-ref-scale="${bibleDisplaySettings.refScale}">
        <div id="jp">
          <div class="bible_ref_row"><b class="target_ref_jp">${bible[n][3]}</b> / ${kr[abbre]}${syou}:${setu}</div>
          <div class="target_jp bible_body_row">${bible[n][4]}</div>
        </div>
        <div id="ch">
          <div class="bible_ref_row"><b class="target_ref_ch">${bible[n][1]}</b> / ${en[abbre]}${syou}:${setu}</div>
          <div class="target_ch bible_body_row">${bible[n][2]}</div>
        </div>
      </div>`;
      break;
    } else {
      outDiv.innerHTML = "";
    }
  }
  commit();
}

function showTitleInPopup() {
  if (!display_win || display_win.closed || !currentTitleInfo) return;
  if (currentMode !== "hymn") switchScreen("hymn");
  const doc = display_win.document;
  const outputDiv = doc.getElementById("h_output");
  const bgNumDiv = doc.getElementById("h_bg_number");

  if (bgNumDiv) bgNumDiv.innerText = ""; // 背景番号クリア

  let wrap = "<div><p id='h_title_text'>" + currentTitleInfo[0] + "番</p>";
  wrap += "<p id='h_ch_text'><<" + currentTitleInfo[1] + ">></p>";
  wrap += "<p id='h_jp_text'><<" + currentTitleInfo[2] + ">></p>";
  wrap += "</div>";
  if (outputDiv) outputDiv.innerHTML = wrap;
}
function showLyricsVerse(index) {
  if (!display_win || display_win.closed || !currentTitleInfo) return;
  if (currentMode !== "hymn") switchScreen("hymn");

  const contentHtml = currentLyricsSections[index].content;
  const verseLabel = currentLyricsSections[index].label;

  const doc = display_win.document;
  const outputDiv = doc.getElementById("h_output");
  const bgNumDiv = doc.getElementById("h_bg_number");

  if (bgNumDiv) bgNumDiv.innerText = verseLabel;

  if (!outputDiv) return;

  const headerHtml = `
    <div style="flex: 0 0 auto; width: 100%; text-align: center; padding: 10px; background: rgba(255,255,255,0.9); border-bottom: 2px solid #ccc;">
      <span style="font-size: 4rem; font-weight: bold;">${currentTitleInfo[0]} ${currentTitleInfo[2]}/${currentTitleInfo[1]}</span>
    </div>
  `;
  const bodyHtml = `
    <div id="lyric-container" style="flex: 1; width: 100%; height: 100%; overflow: hidden; display: flex; justify-content: center; align-items: center;">
      <div id="lyric-text" style="display: flex; flex-direction: column; align-items: center; justify-content: center; font-weight: bold; line-height: 1.5;">${contentHtml}</div>
    </div>
  `;
  outputDiv.innerHTML = `<div style="display: flex; flex-direction: column; height: 100vh; width: 100%;">${headerHtml}${bodyHtml}</div>`;
  setTimeout(
    () =>
      adjustFontSizeForLyrics(
        doc.getElementById("lyric-container"),
        doc.getElementById("lyric-text")
      ),
    10
  );
  display_win.onresize = () => {
    if (currentMode === "hymn")
      adjustFontSizeForLyrics(
        doc.getElementById("lyric-container"),
        doc.getElementById("lyric-text")
      );
  };
}

function adjustFontSizeForLyrics(container, element) {
  if (!container || !element) return;
  let size = 8, loopCount = 0;
  element.style.fontSize = size + "rem";
  while (
    (element.scrollWidth > container.clientWidth ||
      element.scrollHeight > container.clientHeight) &&
    size > 0.5 &&
    loopCount < 100
  ) {
    size -= 0.5;
    element.style.fontSize = size + "rem";
    loopCount++;
  }
}
function commit() {
  const worship = document.getElementById("worship").value;
  const thema_ja = document.getElementById("jtitle").value;
  const thema_ch = document.getElementById("ctitle").value;

  const speech = document.getElementById("speecher").value != "" ? "説教者：" + document.getElementById("speecher").value : "";
  const translator = document.getElementById("translator").value != "" ? "通訳者：" + document.getElementById("translator").value : "";
  const hymn_1nd = document.getElementById("hymn").value;
  const hymn_2nd = document.getElementById("hymn2nd").value;
  let hymnText = "";
  if (hymn_1nd !== "") {
    hymnText = "讃美歌：" + hymn_1nd;
    if (hymn_2nd !== "") hymnText += "/" + hymn_2nd;
  }

  if (!display_win || display_win.closed) return;
  const doc = display_win.document;

  const bibleHeader = doc.getElementById("b_header");
  if (bibleHeader) {
    let output = '<div id="b_thema"><div id="b_worship">' + worship + '</div><div id="b_thema-jp">' + thema_ja + '</div><div id="b_thema-ch">' + thema_ch + "</div></div>";

    output += '<div id="b_people"><div id="b_speech">' + speech + "<br>" + translator + "</div>" + '<div id="b_hymn">';
    output += hymn_1nd != "" ? "讃美歌：" + hymn_1nd : "";
    output += hymn_2nd != "" ? "/" + hymn_2nd : "";
    output += "</div></div>";

    bibleHeader.innerHTML = output;
  }

  if (doc.getElementById("t_worship")) doc.getElementById("t_worship").innerHTML = worship;
  if (doc.getElementById("t_thema_ja")) doc.getElementById("t_thema_ja").innerHTML = thema_ja;
  if (doc.getElementById("t_thema_ch")) doc.getElementById("t_thema_ch").innerHTML = thema_ch;
  if (doc.getElementById("t_speech")) doc.getElementById("t_speech").innerHTML = speech;
  if (doc.getElementById("t_translator")) doc.getElementById("t_translator").innerHTML = translator;
  if (doc.getElementById("t_hymn")) doc.getElementById("t_hymn").innerHTML = hymnText;

  const tickerJp = doc.getElementById('ticker-jp');
  const tickerCh = doc.getElementById('ticker-ch');

  if (tickerJp && tickerCh) {
    if (abbre !== "" && syou !== "" && setu !== "") {
      tickerJp.innerText = `${FullNameJP[abbre]} ${syou}章 ${setu}節`;
      tickerCh.innerText = `${FullNameCH[abbre]} ${syou}章 ${setu}節`;
    } else {
      tickerJp.innerText = "";
      tickerCh.innerText = "";
    }
  }

  saveCookies();
  fontsizecommit();
  applyColors();
  applyTicker();
}

function fontsizecommit() {
  if (!display_win || display_win.closed) return;
  const doc = display_win.document;
  const setSize = (id, size) => {
    const el = doc.getElementById(id);
    if (el) el.style.fontSize = size + "em";
  };
  setSize("t_worship", disp_worship_font);
  setSize("t_thema_ja", disp_jtitle_font);
  setSize("t_thema_ch", disp_ctitle_font);
  setSize("t_speech", disp_person_font);
  setSize("t_translator", disp_person_font);
  setSize("t_hymn", disp_person_font);
}

// ==========================================
// 7. EVENT LISTENERS & SETUP
// ==========================================

function setupEventListeners() {
  // DOM Elements Assignment
  bibleSearchModal = document.getElementById('bibleSearchModal');
  openSearchModalBtn = document.getElementById('openSearchModalBtn');
  closeSearchModalBtn = document.getElementById('closeSearchModalBtn');
  searchInput = document.getElementById('searchInput');
  executeSearchBtn = document.getElementById('executeSearchBtn');
  searchResultsDiv = document.getElementById('searchResults');

  // Logo Settings Init
  loadLogoSettings();
  const elLogoTitle = document.getElementById("setting_logo_title_width");
  const elLogoBible = document.getElementById("setting_logo_bible_height");
  if(elLogoTitle) elLogoTitle.value = logoDisplaySettings.titleLogoWidth;
  if(elLogoBible) elLogoBible.value = logoDisplaySettings.bibleLogoHeight;

  // Bible Settings Init
  loadBibleSettings();
  const elBibleMax = document.getElementById("setting_bible_body_max");
  const elBibleScale = document.getElementById("setting_bible_ref_scale");
  if(elBibleMax) elBibleMax.value = bibleDisplaySettings.bodyMax;
  if(elBibleScale) elBibleScale.value = bibleDisplaySettings.refScale;

  // Font size ranges
  const input_ranges = document.querySelectorAll('.change_size');
  for (let n = 0; n < input_ranges.length; n++) {
    input_ranges[n].addEventListener('input', () => fontsizecommit());
  }

  // Initialize color pickers with saved values
  for (const key in colorSettings) {
    const picker = document.getElementById('color_' + key);
    if (picker) picker.value = colorSettings[key];
  }

  // Load Cookies
  let r = document.cookie.split(';');
  r.forEach((value) => {
    let content = value.split('=');
    if(content.length < 2) return;
    let key = content[0].trim();
    let val = content[1];
    if (key == 'worship' && document.getElementById('worship')) document.getElementById('worship').value = val;
    if (key == 'jtitle' && document.getElementById('jtitle')) document.getElementById('jtitle').value = val;
    if (key == 'ctitle' && document.getElementById('ctitle')) document.getElementById('ctitle').value = val;
    if (key == 'speecher' && document.getElementById('speecher')) document.getElementById('speecher').value = val;
    if (key == 'translator' && document.getElementById('translator')) document.getElementById('translator').value = val;
    if (key == 'hymn' && document.getElementById('hymn')) document.getElementById('hymn').value = val;
    if (key == 'hymn2nd' && document.getElementById('hymn2nd')) document.getElementById('hymn2nd').value = val;
  });
  document.cookie = '';

  // Language Switch
  const switch_lang = document.querySelectorAll(".switch");
  // 初期化時に一つ目を選択
  if(switch_lang.length > 0) switch_lang[0].click();
if(switch_lang.length > 0) {
  switch_lang[0].addEventListener("click", () => {
    document.getElementById("ot").innerHTML = "旧約";
    document.getElementById("nt").innerHTML = "新約";
  });
}
if(switch_lang.length > 1) {
  switch_lang[1].addEventListener("click", () => {
    document.getElementById("ot").innerHTML = "旧约";
    document.getElementById("nt").innerHTML = "新约";
  });
}

  // Modal Buttons
  document.querySelectorAll(".modal_abbre_btn").forEach((ele) => {
    ele.addEventListener("click", (e) => {
      if (e.target.className == "modal_abbre_btn") ele.style.left = "-100vw";
    });
  });

  // Search Modal Listeners
  if (openSearchModalBtn) openSearchModalBtn.addEventListener("click", openBibleSearchModal);
  if (closeSearchModalBtn) closeSearchModalBtn.addEventListener("click", closeBibleSearchModal);
  if (executeSearchBtn) executeSearchBtn.addEventListener("click", performSearch);
if (searchInput) {
  searchInput.addEventListener("keypress", function (event) {
    if (event.key === "Enter") {
      event.preventDefault();
      performSearch();
    }
  });
}

window.addEventListener("click", function (event) {
  if (event.target === bibleSearchModal) closeBibleSearchModal();
});
window.addEventListener("keydown", function (event) {
  if (event.key === "Escape" && bibleSearchModal && bibleSearchModal.style.display === "block")
    closeBibleSearchModal();
});

  // Window Exiting Listeners
  window.onbeforeunload = function (e) {
    e.returnValue = "本当にページを閉じますか？";
  };
window.addEventListener("unload", (e) => {
  if (display_win) display_win.close();
});

  // Delay commit
  setTimeout(commit, 2000);
}

window.addEventListener('load', () => {
  loadGeminiSettings();
  loadColorSettings();
  loadTickerSettings();
  initDB();
  setupEventListeners();
  loadInitialData().then(() => {
    // データ読み込み完了後に自動でウィンドウを開く
    try {
      openwindow();
      if (display_win) {
        display_win.onload = () => {
          switchScreen('title');
          commit();
        };
      }
    } catch (e) {
      console.warn('ポップアップがブロックされた可能性があります:', e);
    }
  });
});
