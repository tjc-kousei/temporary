// ==========================================
// 1. GLOBALS & STATE
// ==========================================
let display_win; // 統合されたウィンドウ

let Abbre = [
  "創", "出エジ", "レビ", "民", "申", "ヨシュ", "士", "ルツ", "サム上", "サム下",
  "列王上", "列王下", "歴代上", "歴代下", "エズ", "ネヘ", "エス", "ヨブ", "詩",
  "箴", "伝", "雅", "イザ", "エレ", "哀", "エゼ", "ダニ", "ホセ", "ヨエ", "アモ",
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
const LYRICS_API_URL = "https://tjckousei.com/hymn/api.php?action=get_all_lyrics";
const LYRICS_CACHE_KEY = "hymnLyricsData";
const LYRICS_CACHE_UPDATED_KEY = "hymnLyricsUpdatedAt";
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
const GEMINI_ERROR_LOG_KEY = 'geminiErrorLog';
const GEMINI_ERROR_LOG_LIMIT = 5;

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

  // APIキーは発行元によって形式が変わり得るため、保存時には制限せず実行時のAPI応答で検証する。
  geminiSettings.apiKey = keyInput;
  geminiSettings.model = modelSelect;
  geminiSettings.customModel = customInput;

  localStorage.setItem('geminiSettings', JSON.stringify(geminiSettings));
  closeGeminiSettings();
  updateTranslateButtonsVisibility();
  showToast('AI機能設定を保存しました', 'success');
}

function updateTranslateButtonsVisibility() {
  const btns = document.querySelectorAll('.translate-btn');
  const hasKey = !!geminiSettings.apiKey;
  btns.forEach(btn => {
    btn.style.display = hasKey ? 'inline-block' : 'none';
  });
  updateBibleSearchModeUi();
}

function getGeminiModelName() {
  const modelName = geminiSettings.model === 'custom' ? geminiSettings.customModel.trim() : geminiSettings.model;
  return String(modelName || '').replace(/^models\//, '');
}

function getGeminiErrorLog() {
  try {
    const saved = JSON.parse(localStorage.getItem(GEMINI_ERROR_LOG_KEY) || '[]');
    return Array.isArray(saved) ? saved : [];
  } catch (error) {
    console.warn('AIエラーログを読み込めませんでした:', error);
    return [];
  }
}

function redactGeminiSensitiveText(value) {
  let text = String(value || '不明なエラー');
  const apiKey = String(geminiSettings.apiKey || '');
  if (apiKey) text = text.split(apiKey).join('[APIキー]');
  return text;
}

function recordGeminiError(feature, error) {
  const entry = {
    timestamp: new Date().toISOString(),
    feature,
    model: getGeminiModelName() || '未設定',
    status: Number.isFinite(error?.status) ? error.status : null,
    code: error?.code ? String(error.code) : '',
    message: redactGeminiSensitiveText(error?.message)
  };

  // APIキーやリクエスト本文は、画面・保存ログ・コンソールのいずれにも記録しない。
  console.error(`[Gemini API] ${feature}でエラーが発生しました`, entry);
  try {
    const entries = [entry, ...getGeminiErrorLog()].slice(0, GEMINI_ERROR_LOG_LIMIT);
    localStorage.setItem(GEMINI_ERROR_LOG_KEY, JSON.stringify(entries));
  } catch (storageError) {
    console.warn('AIエラーログを保存できませんでした:', storageError);
  }
  renderGeminiErrorLog();
}

function renderGeminiErrorLog() {
  const panel = document.getElementById('geminiErrorLogPanel');
  const container = document.getElementById('geminiErrorLog');
  if (!panel || !container) return;

  const entries = getGeminiErrorLog();
  panel.hidden = entries.length === 0;
  container.replaceChildren();

  entries.forEach((entry) => {
    const item = document.createElement('div');
    item.className = 'gemini-error-log-item';

    const meta = document.createElement('div');
    meta.className = 'gemini-error-log-meta';
    const date = new Date(entry.timestamp);
    const timeText = Number.isNaN(date.getTime()) ? entry.timestamp : date.toLocaleString('ja-JP');
    meta.textContent = `${timeText} · ${entry.feature} · ${entry.model}`;

    const message = document.createElement('div');
    message.className = 'gemini-error-log-message';
    const statusText = entry.status ? `HTTP ${entry.status} / ` : '';
    const codeText = entry.code ? `${entry.code} / ` : '';
    message.textContent = `${statusText}${codeText}${entry.message}`;

    item.append(meta, message);
    container.appendChild(item);
  });
}

function clearGeminiErrorLog() {
  localStorage.removeItem(GEMINI_ERROR_LOG_KEY);
  renderGeminiErrorLog();
  showToast('AIエラーログを消去しました', 'info');
}

function createGeminiApiError(response, errorData) {
  const apiError = errorData?.error || {};
  const error = new Error(redactGeminiSensitiveText(apiError.message || `Gemini APIからHTTP ${response.status}が返されました`));
  error.status = response.status;
  error.code = apiError.status || apiError.code || '';
  return error;
}

async function requestGeminiText(systemPrompt, userText, temperature = 0.1) {
  const modelName = getGeminiModelName();
  if (!modelName) throw new Error('モデル名が設定されていません');

  const isGemma = modelName.toLowerCase().includes('gemma');
  const requestBody = isGemma
    ? {
        contents: [{ parts: [{ text: `${systemPrompt}\n\n${userText}` }] }],
        generationConfig: { temperature }
      }
    : {
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: userText }] }],
        generationConfig: { temperature }
      };

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent?key=${encodeURIComponent(geminiSettings.apiKey)}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    let errorData = null;
    try {
      errorData = await response.json();
    } catch (parseError) {
      // JSONでないエラーレスポンスでもHTTPステータスを記録する。
    }
    throw createGeminiApiError(response, errorData);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('').trim();
  if (!text) {
    const blockReason = data.promptFeedback?.blockReason;
    const error = new Error(blockReason ? `AIの回答がブロックされました (${blockReason})` : 'AIから回答本文を取得できませんでした');
    error.code = blockReason || 'EMPTY_RESPONSE';
    throw error;
  }
  return text;
}

function parseGeminiJson(text) {
  const cleaned = String(text || '').replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch (initialError) {
    const arrayStart = cleaned.indexOf('[');
    const arrayEnd = cleaned.lastIndexOf(']');
    if (arrayStart !== -1 && arrayEnd > arrayStart) {
      return JSON.parse(cleaned.slice(arrayStart, arrayEnd + 1));
    }
    const objectStart = cleaned.indexOf('{');
    const objectEnd = cleaned.lastIndexOf('}');
    if (objectStart !== -1 && objectEnd > objectStart) {
      return JSON.parse(cleaned.slice(objectStart, objectEnd + 1));
    }
    throw initialError;
  }
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
    renderGeminiErrorLog();
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
    showToast('APIキーが設定されていません。基本情報のAI機能設定ボタンから設定してください。', 'error');
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

  const modelName = getGeminiModelName();
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
    const translatedText = await requestGeminiText(systemPrompt, sourceText);

    try {
      const candidates = parseGeminiJson(translatedText);
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
    recordGeminiError('タイトル翻訳', error);
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
let searchModeTextBtn, searchModeAiBtn, bibleSearchModeDescription, aiSearchSetupNotice, openAiSettingsFromSearch;
let bibleAiSearchRequestId = 0;
let bibleSearchMode = 'text';
let bibleSearchBusy = false;

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

// OSに依存しない選択・入力候補メニュー
let activeChoiceMenu = null;

function closeChoiceMenu() {
  if (!activeChoiceMenu) return;
  activeChoiceMenu.menu.remove();
  activeChoiceMenu.trigger?.setAttribute("aria-expanded", "false");
  activeChoiceMenu = null;
}

function handleChoiceMenuScroll(event) {
  if (!activeChoiceMenu) return;
  const { menu } = activeChoiceMenu;
  const target = event.target;

  // 候補メニュー自身のスクロールでは閉じず、背景側が動いたときだけ閉じる。
  if (target === menu || (target instanceof Node && menu.contains(target))) return;
  closeChoiceMenu();
}

function placeChoiceMenu(menu, anchor) {
  const rect = anchor.getBoundingClientRect();
  const roomBelow = window.innerHeight - rect.bottom;
  const openAbove = roomBelow < 220 && rect.top > roomBelow;
  const desiredWidth = anchor.closest(".combobox-wrapper") ? 220 : rect.width;
  const width = Math.min(desiredWidth, window.innerWidth - 16);
  const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
  menu.style.left = `${left}px`;
  menu.style.width = `${width}px`;
  menu.style.maxHeight = `${Math.max(120, Math.min(280, openAbove ? rect.top - 12 : roomBelow - 12))}px`;
  menu.style.top = openAbove ? "auto" : `${rect.bottom + 5}px`;
  menu.style.bottom = openAbove ? `${window.innerHeight - rect.top + 5}px` : "auto";
}

function openChoiceMenu(anchor, items, onSelect, selectedIndex = -1) {
  closeChoiceMenu();
  if (!items.length) return null;

  const menu = document.createElement("div");
  menu.className = "custom-choice-menu";
  menu.setAttribute("role", "listbox");
  items.forEach((item, index) => {
    const option = document.createElement("button");
    option.type = "button";
    option.className = "custom-choice-option";
    option.setAttribute("role", "option");
    option.dataset.index = index;
    option.textContent = item.label;
    if (item.secondary) {
      const secondary = document.createElement("small");
      secondary.textContent = item.secondary;
      option.appendChild(secondary);
    }
    if (index === selectedIndex) {
      option.classList.add("selected");
      option.setAttribute("aria-selected", "true");
    }
    option.addEventListener("click", () => {
      onSelect(item, index);
      closeChoiceMenu();
    });
    menu.appendChild(option);
  });

  document.body.appendChild(menu);
  placeChoiceMenu(menu, anchor);
  activeChoiceMenu = { menu, trigger: anchor, items, onSelect, activeIndex: selectedIndex };
  anchor.setAttribute("aria-expanded", "true");
  return menu;
}

function moveChoiceFocus(direction) {
  if (!activeChoiceMenu) return;
  const buttons = activeChoiceMenu.menu.querySelectorAll(".custom-choice-option");
  if (!buttons.length) return;
  let next = activeChoiceMenu.activeIndex + direction;
  if (next < 0) next = buttons.length - 1;
  if (next >= buttons.length) next = 0;
  buttons.forEach(button => button.classList.remove("active"));
  buttons[next].classList.add("active");
  buttons[next].scrollIntoView({ block: "nearest" });
  activeChoiceMenu.activeIndex = next;
}

function enhanceSelect(select) {
  if (select.dataset.customized === "true") return;
  select.dataset.customized = "true";
  select.classList.add("native-choice-control");

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = `custom-select-trigger${select.classList.contains("history-select") ? " history-select" : ""}`;
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-expanded", "false");
  trigger.disabled = select.disabled;
  select.after(trigger);

  const sync = () => {
    const selected = select.options[select.selectedIndex];
    trigger.textContent = selected?.textContent || "選択してください";
    trigger.disabled = select.disabled;
  };
  const show = () => {
    const items = Array.from(select.options).map(option => ({ label: option.textContent, value: option.value, disabled: option.disabled }));
    const menu = openChoiceMenu(trigger, items, (item, index) => {
      if (item.disabled) return;
      select.selectedIndex = index;
      select.dispatchEvent(new Event("change", { bubbles: true }));
      sync();
    }, select.selectedIndex);
    menu?.querySelectorAll(".custom-choice-option").forEach((button, index) => {
      if (items[index].disabled) button.disabled = true;
    });
  };

  trigger.addEventListener("click", () => activeChoiceMenu?.trigger === trigger ? closeChoiceMenu() : show());
  trigger.addEventListener("keydown", event => {
    if (["ArrowDown", "ArrowUp"].includes(event.key)) {
      event.preventDefault();
      if (!activeChoiceMenu || activeChoiceMenu.trigger !== trigger) show();
      moveChoiceFocus(event.key === "ArrowDown" ? 1 : -1);
    } else if (event.key === "Enter" && activeChoiceMenu?.trigger === trigger && activeChoiceMenu.activeIndex >= 0) {
      event.preventDefault();
      activeChoiceMenu.menu.querySelector(`.custom-choice-option[data-index="${activeChoiceMenu.activeIndex}"]`)?.click();
    } else if (event.key === "Escape") closeChoiceMenu();
  });
  select.addEventListener("change", sync);
  new MutationObserver(sync).observe(select, { childList: true, subtree: true, attributes: true });
  sync();
}

function enhanceDatalistInput(input) {
  if (input.dataset.customizedList === "true") return;
  input.dataset.customizedList = "true";
  input.dataset.customListId = input.getAttribute("list");
  input.removeAttribute("list");
  input.setAttribute("aria-haspopup", "listbox");
  input.setAttribute("aria-expanded", "false");

  const show = () => {
    const list = document.getElementById(input.dataset.customListId);
    if (!list) return;
    const query = input.value.trim().toLowerCase();
    const items = Array.from(list.options)
      .map(option => {
        const optionLabel = option.label || option.textContent || "";
        return {
          label: option.value,
          value: option.value,
          secondary: optionLabel && optionLabel !== option.value ? optionLabel : ""
        };
      })
      .filter(item => !query || item.label.toLowerCase().includes(query) || item.secondary.toLowerCase().includes(query))
      .slice(0, 100);
    openChoiceMenu(input, items, item => {
      input.value = item.value;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      input.focus();
    });
  };
  input.addEventListener("focus", show);
  input.addEventListener("input", show);
  input.addEventListener("keydown", event => {
    if (["ArrowDown", "ArrowUp"].includes(event.key)) {
      event.preventDefault();
      if (!activeChoiceMenu || activeChoiceMenu.trigger !== input) show();
      moveChoiceFocus(event.key === "ArrowDown" ? 1 : -1);
    } else if (event.key === "Enter" && activeChoiceMenu?.trigger === input && activeChoiceMenu.activeIndex >= 0) {
      event.preventDefault();
      activeChoiceMenu.menu.querySelector(`.custom-choice-option[data-index="${activeChoiceMenu.activeIndex}"]`)?.click();
    } else if (event.key === "Escape") closeChoiceMenu();
  });
}

function initCustomChoiceControls() {
  document.querySelectorAll("select").forEach(enhanceSelect);
  document.querySelectorAll("input[list]").forEach(enhanceDatalistInput);
  document.addEventListener("pointerdown", event => {
    if (activeChoiceMenu && !activeChoiceMenu.menu.contains(event.target) && event.target !== activeChoiceMenu.trigger) closeChoiceMenu();
  });
  window.addEventListener("resize", closeChoiceMenu);
  window.addEventListener("scroll", handleChoiceMenuScroll, true);
}

function suppressNativeTextSuggestions(root = document) {
  const textControls = [];
  if (root instanceof Element && root.matches('input[type="text"], input[type="search"], textarea')) {
    textControls.push(root);
  }
  if (typeof root.querySelectorAll === "function") {
    textControls.push(...root.querySelectorAll('input[type="text"], input[type="search"], textarea'));
  }

  textControls.forEach((control) => {
    control.setAttribute("autocomplete", "off");
    control.setAttribute("autocorrect", "off");
    control.setAttribute("autocapitalize", "none");
    control.setAttribute("spellcheck", "false");
    control.setAttribute("data-lpignore", "true");
    control.setAttribute("data-1p-ignore", "true");
  });
}

function initNativeSuggestionSuppression() {
  suppressNativeTextSuggestions();
  new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof Element) suppressNativeTextSuggestions(node);
      });
    });
  }).observe(document.body, { childList: true, subtree: true });
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
  const normalizedSong = getNormalizedHymnNumber(song);
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

function loadServicersList(filter, options = {}) {
  const tbody = document.getElementById("servicerListTable");
  if (!tbody) return;
  // 編集・追加後の再読込でも作業位置を失わないよう、現在のスクロール位置を引き継ぐ。
  const savedScrollTop = Number.isFinite(options.scrollTop)
    ? options.scrollTop
    : options.resetScroll ? 0 : tbody.scrollTop;
  const transaction = db.transaction("servicers", "readwrite");
  const store = transaction.objectStore("servicers");

  store.getAll().onsuccess = (e) => {
    const allData = e.target.result;

    if (ensureOrderFields(allData, store)) {
        loadServicersList(filter, { scrollTop: savedScrollTop });
        return;
    }

    // orderでソート
    allData.sort((a, b) => (a.order || 0) - (b.order || 0));

    const visibleData = allData.filter(s => filter === "all" || filter === s.role);
    const fragment = document.createDocumentFragment();

    visibleData.forEach((s, visibleIndex) => {
      const row = document.createElement("div");
      row.className = "servicer-item";
      row.id = `servicer-row-${s.id}`;
      row.dataset.servicerId = String(s.id);
      row.dataset.servicerName = s.name.toLocaleLowerCase();

      const roleLabel = s.role === "sekkyou" ? "🎤 説教者" : "🌐 通訳者";
      const roleClass = s.role === "sekkyou" ? "primary-text" : "secondary-text";

      row.innerHTML = `
        <button type="button" class="servicer-drag-handle" title="ドラッグして並べ替え（矢印キーでも移動できます）"
          aria-label="${escapeHTML(s.name)}を並べ替え" onpointerdown="startServicerPointerDrag(event, ${s.id});"
          onkeydown="handleServicerHandleKeydown(event, ${s.id});">
          <span class="servicer-grip" aria-hidden="true">⠿</span>
          <span class="servicer-position-badge" aria-hidden="true">${visibleIndex + 1}</span>
        </button>
        <div class="servicer-col-name servicer-name-display">${escapeHTML(s.name)}</div>
        <div class="servicer-col-role ${roleClass}"><small>${roleLabel}</small></div>
        <div class="servicer-col-action">
          <div class="servicer-order-controls" aria-label="${escapeHTML(s.name)}の表示順">
            <button type="button" onclick="moveServicerToEdge(${s.id}, 'first')" data-servicer-move="first" class="move-btn" title="先頭へ" aria-label="先頭へ移動">⇤</button>
            <button type="button" onclick="moveServicer(${s.id}, -1)" data-servicer-move="up" class="move-btn" title="1つ上へ" aria-label="1つ上へ移動">↑</button>
            <button type="button" onclick="moveServicer(${s.id}, 1)" data-servicer-move="down" class="move-btn" title="1つ下へ" aria-label="1つ下へ移動">↓</button>
            <button type="button" onclick="moveServicerToEdge(${s.id}, 'last')" data-servicer-move="last" class="move-btn" title="末尾へ" aria-label="末尾へ移動">⇥</button>
          </div>
          <label class="servicer-position-jump" title="移動先の番号を入力">
            <span class="visually-hidden">${escapeHTML(s.name)}の移動先</span>
            <input type="number" min="1" max="${visibleData.length}" value="${visibleIndex + 1}"
              inputmode="numeric" onchange="moveServicerToPosition(${s.id}, this.value);"
              onkeydown="if(event.key === 'Enter'){ event.preventDefault(); moveServicerToPosition(${s.id}, this.value); this.blur(); }">
            <span>番へ</span>
          </label>
          <button type="button" onclick="editServicer(${s.id})" class="edit-btn" title="編集">編集</button>
          <button type="button" onclick="deleteServicer(${s.id}, ${escapeHTML(JSON.stringify(s.name))})" class="del-btn" title="削除" aria-label="${escapeHTML(s.name)}を削除">削除</button>
        </div>
      `;
      fragment.appendChild(row);
    });

    if (visibleData.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'servicer-empty';
      empty.textContent = '登録されている奉仕者はいません。';
      fragment.appendChild(empty);
    }

    tbody.replaceChildren(fragment);
    tbody.scrollTop = savedScrollTop;
    refreshServicerRowMetadata();
    applyServicerFindMatches(false);
  };
}

// === Pointer-based Sorting for Servicers ===
let servicerPointerDrag = null;

function getServicerRows() {
  return Array.from(document.querySelectorAll("#servicerListTable .servicer-item"));
}

function getServicerRowOrder() {
  return getServicerRows().map(row => Number(row.dataset.servicerId));
}

function moveServicer(id, direction) {
  const rows = getServicerRows();
  const currentIndex = rows.findIndex(row => row.id === `servicer-row-${id}`);
  if (currentIndex < 0) return;
  moveServicerElementToIndex(rows[currentIndex], currentIndex + direction);
}

function moveServicerToEdge(id, edge) {
  const rows = getServicerRows();
  const row = document.getElementById(`servicer-row-${id}`);
  if (!row) return;
  moveServicerElementToIndex(row, edge === 'first' ? 0 : rows.length - 1);
}

function moveServicerToPosition(id, position) {
  const row = document.getElementById(`servicer-row-${id}`);
  if (!row) return;
  const rows = getServicerRows();
  const targetIndex = Math.min(rows.length, Math.max(1, Number.parseInt(position, 10) || 1)) - 1;
  moveServicerElementToIndex(row, targetIndex);
}

function handleServicerHandleKeydown(event, id) {
  if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  if (event.key === 'ArrowUp') moveServicer(id, -1);
  if (event.key === 'ArrowDown') moveServicer(id, 1);
  if (event.key === 'Home') moveServicerToEdge(id, 'first');
  if (event.key === 'End') moveServicerToEdge(id, 'last');
  document.getElementById(`servicer-row-${id}`)?.querySelector('.servicer-drag-handle')?.focus();
}

function animateServicerRows(mutator, excludedRow) {
  // DOMを入れ替える前後の座標差をアニメーションする（FLIP）ことで、移動方向を視覚化する。
  const before = new Map(getServicerRows().map(row => [row, row.getBoundingClientRect()]));
  mutator();
  getServicerRows().forEach((row) => {
    if (row === excludedRow || !before.has(row) || typeof row.animate !== 'function') return;
    const previous = before.get(row);
    const current = row.getBoundingClientRect();
    const deltaY = previous.top - current.top;
    if (Math.abs(deltaY) < 1) return;
    row.animate([
      { transform: `translateY(${deltaY}px)` },
      { transform: 'translateY(0)' }
    ], { duration: 190, easing: 'cubic-bezier(.2,.8,.2,1)' });
  });
}

function moveServicerElementToIndex(row, requestedIndex, save = true) {
  const container = document.getElementById('servicerListTable');
  const rows = getServicerRows();
  const sourceIndex = rows.indexOf(row);
  const targetIndex = Math.max(0, Math.min(rows.length - 1, requestedIndex));
  if (!container || sourceIndex === -1) return;
  if (sourceIndex === targetIndex) {
    refreshServicerRowMetadata();
    return;
  }

  const targetRow = rows[targetIndex];
  animateServicerRows(() => {
    if (targetIndex > sourceIndex) container.insertBefore(row, targetRow.nextSibling);
    else container.insertBefore(row, targetRow);
  }, row);
  refreshServicerRowMetadata();
  markServicerAsMoved(row);
  if (save) persistServicerOrder(getServicerRowOrder());
}

function repositionDraggedServicer(sourceRow, targetRow, pointerY) {
  const container = document.getElementById('servicerListTable');
  if (!container || !sourceRow || !targetRow || sourceRow === targetRow) return;
  const rect = targetRow.getBoundingClientRect();
  const insertAfter = pointerY > rect.top + rect.height / 2;
  const beforeOrder = getServicerRowOrder().join(',');
  animateServicerRows(() => {
    container.insertBefore(sourceRow, insertAfter ? targetRow.nextSibling : targetRow);
  }, sourceRow);
  if (getServicerRowOrder().join(',') !== beforeOrder) refreshServicerRowMetadata();
}

function autoScrollServicerList(pointerY) {
  const container = document.getElementById('servicerListTable');
  if (!container) return;
  const rect = container.getBoundingClientRect();
  const edgeSize = Math.min(70, rect.height * 0.22);
  if (pointerY < rect.top + edgeSize) {
    const strength = (rect.top + edgeSize - pointerY) / edgeSize;
    container.scrollTop -= Math.ceil(18 * strength);
  } else if (pointerY > rect.bottom - edgeSize) {
    const strength = (pointerY - (rect.bottom - edgeSize)) / edgeSize;
    container.scrollTop += Math.ceil(18 * strength);
  }
}

function startServicerPointerDrag(event, id) {
  if (event.button !== 0 || servicerPointerDrag) return;
  const row = document.getElementById(`servicer-row-${id}`);
  const container = document.getElementById('servicerListTable');
  if (!row || !container) return;
  event.preventDefault();
  event.currentTarget.focus({ preventScroll: true });

  const rect = row.getBoundingClientRect();
  const ghost = row.cloneNode(true);
  ghost.querySelectorAll('[id]').forEach(element => element.removeAttribute('id'));
  ghost.className = 'servicer-touch-ghost';
  Object.assign(ghost.style, {
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`
  });
  document.body.appendChild(ghost);

  row.classList.add('dragging');
  container.classList.add('sorting');
  servicerPointerDrag = {
    pointerId: event.pointerId,
    handle: event.currentTarget,
    row,
    container,
    ghost,
    offsetY: event.clientY - rect.top,
    initialOrder: getServicerRowOrder()
  };
  document.addEventListener('pointermove', handleServicerPointerMove, { passive: false });
  document.addEventListener('pointerup', finishServicerPointerDrag);
  document.addEventListener('pointercancel', finishServicerPointerDrag);
}

function handleServicerPointerMove(event) {
  const state = servicerPointerDrag;
  if (!state || event.pointerId !== state.pointerId) return;
  event.preventDefault();
  state.ghost.style.top = `${event.clientY - state.offsetY}px`;
  autoScrollServicerList(event.clientY);
  const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('.servicer-item');
  if (target && target !== state.row && state.container.contains(target)) {
    repositionDraggedServicer(state.row, target, event.clientY);
  }
}

function finishServicerPointerDrag(event) {
  const state = servicerPointerDrag;
  if (!state || event.pointerId !== state.pointerId) return;
  document.removeEventListener('pointermove', handleServicerPointerMove);
  document.removeEventListener('pointerup', finishServicerPointerDrag);
  document.removeEventListener('pointercancel', finishServicerPointerDrag);
  state.ghost.remove();
  state.row.classList.remove('dragging');
  state.container.classList.remove('sorting');
  refreshServicerRowMetadata();
  const currentOrder = getServicerRowOrder();
  if (currentOrder.join(',') !== state.initialOrder.join(',')) {
    persistServicerOrder(currentOrder);
    markServicerAsMoved(state.row);
  }
  servicerPointerDrag = null;
}

function refreshServicerRowMetadata() {
  const rows = getServicerRows();
  rows.forEach((row, index) => {
    const badge = row.querySelector('.servicer-position-badge');
    const input = row.querySelector('.servicer-position-jump input');
    if (badge) badge.textContent = String(index + 1);
    if (input) {
      input.value = String(index + 1);
      input.max = String(rows.length);
    }
    const first = index === 0;
    const last = index === rows.length - 1;
    row.querySelector('[data-servicer-move="first"]')?.toggleAttribute('disabled', first);
    row.querySelector('[data-servicer-move="up"]')?.toggleAttribute('disabled', first);
    row.querySelector('[data-servicer-move="down"]')?.toggleAttribute('disabled', last);
    row.querySelector('[data-servicer-move="last"]')?.toggleAttribute('disabled', last);
  });
  const count = document.getElementById('servicerCount');
  if (count) count.innerText = `${rows.length} 名`;
}

function markServicerAsMoved(row) {
  if (!row) return;
  row.classList.remove('just-moved');
  requestAnimationFrame(() => row.classList.add('just-moved'));
  setTimeout(() => row.classList.remove('just-moved'), 650);
}

function applyServicerFindMatches(shouldScroll) {
  const input = document.getElementById('servicerQuickFind');
  const status = document.getElementById('servicerFindStatus');
  const query = input?.value.trim().toLocaleLowerCase() || '';
  const rows = getServicerRows();
  const matches = [];
  rows.forEach((row) => {
    const isMatch = !!query && row.dataset.servicerName.includes(query);
    row.classList.toggle('search-match', isMatch);
    if (isMatch) matches.push(row);
  });
  if (status) status.textContent = query ? `${matches.length}件` : '';
  if (shouldScroll && matches[0]) {
    const container = document.getElementById('servicerListTable');
    const containerRect = container.getBoundingClientRect();
    const matchRect = matches[0].getBoundingClientRect();
    const targetTop = container.scrollTop + (matchRect.top - containerRect.top)
      - (container.clientHeight - matchRect.height) / 2;
    container.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
  }
}

function findServicerInList() {
  applyServicerFindMatches(true);
}

function persistServicerOrder(orderedIds) {
  const filterAtSave = currentServicerFilter;
  const transaction = db.transaction(["servicers"], "readwrite");
  const store = transaction.objectStore("servicers");

  store.getAll().onsuccess = (e) => {
    let allData = e.target.result;
    allData.sort((a, b) => ((a.order || 0) - (b.order || 0)) || (a.id - b.id));

    // 絞り込み中は対象役職が元々占めていた枠だけを入れ替え、他役職の位置は動かさない。
    const visibleSlots = [];
    allData.forEach((item, index) => {
      if (filterAtSave === 'all' || item.role === filterAtSave) visibleSlots.push(index);
    });
    const itemById = new Map(allData.map(item => [item.id, item]));
    const orderedItems = orderedIds.map(id => itemById.get(id)).filter(Boolean);
    if (orderedItems.length !== visibleSlots.length) {
      console.error('奉仕者の並び順を保存できません: 表示件数が一致しません', {
        displayed: orderedItems.length,
        stored: visibleSlots.length,
        filter: filterAtSave
      });
      transaction.abort();
      return;
    }

    visibleSlots.forEach((slot, index) => {
      allData[slot] = orderedItems[index];
    });
    allData.forEach((item, index) => {
      item.order = (index + 1) * 10;
      store.put(item);
    });
  };

  transaction.oncomplete = updateDatalistFromDB;
  transaction.onabort = () => {
    showToast('並び順を保存できませんでした。リストを再読み込みしました', 'error');
    loadServicersList(currentServicerFilter);
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

function getNormalizedHymnNumber(value) {
  return String(value || "").trim().replace(/[^(0-9)(甲乙)]/g, "");
}

function getHymnTitleInfo(value) {
  const hymnNumber = getNormalizedHymnNumber(value);
  if (!hymnNumber) return null;

  return hymn.find((row) => Array.isArray(row) && row[0] && row[0].trim() === hymnNumber) || null;
}

function setLyricsMessage(message, type = "empty") {
  const lyricsArea = document.getElementById("lyrics_area");
  if (!lyricsArea) return;
  lyricsArea.innerHTML = `<div class="lyrics-state lyrics-state-${type}">${escapeHTML(message)}</div>`;
}

function readLyricsCache() {
  try {
    const cached = localStorage.getItem(LYRICS_CACHE_KEY);
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    console.warn("保存済み歌詞データの読み込みに失敗しました:", error);
    return null;
  }
}

function writeLyricsCache(data) {
  try {
    localStorage.setItem(LYRICS_CACHE_KEY, JSON.stringify(data));
    localStorage.setItem(LYRICS_CACHE_UPDATED_KEY, new Date().toISOString());
  } catch (error) {
    console.warn("歌詞データの保存に失敗しました:", error);
  }
}

async function fetchLyricsData() {
  const response = await fetch(LYRICS_API_URL, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const json = await response.json();
  if (!json || !json.success || !json.data) {
    throw new Error("Invalid lyrics response");
  }

  writeLyricsCache(json.data);
  return json.data;
}

async function loadLyricsData({ force = false } = {}) {
  if (allLyricsData && !force) return allLyricsData;

  if (!force) {
    const cached = readLyricsCache();
    if (cached) {
      allLyricsData = cached;
      return allLyricsData;
    }
  }

  allLyricsData = await fetchLyricsData();
  return allLyricsData;
}

function clearDisplayedHymn() {
  if (!display_win || display_win.closed) return;

  const doc = display_win.document;
  const hOutput = doc.getElementById("h_output");
  const hBgNum = doc.getElementById("h_bg_number");
  if (hOutput) hOutput.innerHTML = "";
  if (hBgNum) hBgNum.innerText = "";
}

function renderLyricsControls(sections) {
  const lyricsArea = document.getElementById("lyrics_area");
  if (!lyricsArea) return;

  lyricsArea.innerHTML = "";

  const titleButton = document.createElement("button");
  titleButton.type = "button";
  titleButton.className = "lyric-btn";
  titleButton.id = "btn-title";
  titleButton.textContent = "タイトル";
  titleButton.addEventListener("click", () => {
    switchScreen("hymn");
    showTitleInPopup();
    updateActiveButton(titleButton);
  });
  lyricsArea.appendChild(titleButton);

  sections.forEach((section, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "lyric-btn";
    button.textContent = section.label;
    button.addEventListener("click", () => {
      switchScreen("hymn");
      showLyricsVerse(index);
      updateActiveButton(button);
    });
    lyricsArea.appendChild(button);
  });
}

async function recievehymn(value) {
  const lyricsArea = document.getElementById("lyrics_area");
  if (!lyricsArea) return;

  lyricsArea.innerHTML = "";
  currentTitleInfo = null;
  currentLyricsSections = [];
  clearDisplayedHymn();

  const hymnNumber = getNormalizedHymnNumber(value);
  if (!hymnNumber) {
    setLyricsMessage("讃美歌番号を入力してください。");
    return;
  }

  currentTitleInfo = getHymnTitleInfo(hymnNumber);
  if (!currentTitleInfo) {
    setLyricsMessage(`讃美歌 ${hymnNumber} は一覧に見つかりません。`, "warning");
    return;
  }

  setLyricsMessage("歌詞を読み込んでいます...", "loading");

  try {
    const lyricsData = await loadLyricsData();
    const text = lyricsData ? lyricsData[`${hymnNumber}.txt`] : null;

    if (text) {
      currentLyricsSections = parseLyrics(text);

      if (currentLyricsSections.length > 0) {
        renderLyricsControls(currentLyricsSections);
        switchScreen("hymn");
        showTitleInPopup();
        const titleBtn = document.getElementById("btn-title");
        if (titleBtn) updateActiveButton(titleBtn);
      } else {
        setLyricsMessage(`讃美歌 ${hymnNumber} の歌詞形式を解析できませんでした。`, "warning");
      }
    } else {
      setLyricsMessage(`讃美歌 ${hymnNumber} の歌詞データはまだ登録されていません。`, "warning");
      showTitleInPopup();
      console.warn("歌詞データが見つかりませんでした:", hymnNumber);
    }
  } catch (e) {
    setLyricsMessage("歌詞データの取得に失敗しました。通信状況を確認してください。", "error");
    console.warn("歌詞の取得に失敗しました:", hymnNumber, e);
  }
}

async function reloadLyricsData() {
  try {
    showToast("最新の歌詞を取得しています...", "info");
    await loadLyricsData({ force: true });
    showToast("歌詞データを最新に更新しました", "success");

    const prehymnInput = document.getElementById("prehymn");
    if (prehymnInput && prehymnInput.value) {
      recievehymn(prehymnInput.value.trim());
    }
  } catch (e) {
    console.error(e);
    showToast("歌詞データの更新に失敗しました", "error");
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
    let processed = convertRuby(escapeHTML(rawText));
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

function bindDisplayFullscreenEvents() {
  const doc = getDisplayDocument();
  if (!doc || doc.__fullscreenEventsBound) return;

  doc.addEventListener("fullscreenchange", updateFullscreenButton);
  doc.addEventListener("webkitfullscreenchange", updateFullscreenButton);
  doc.__fullscreenEventsBound = true;
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
    if (display_win) {
      display_win.addEventListener("load", bindDisplayFullscreenEvents);
    }
  }
  bindDisplayFullscreenEvents();
  updateFullscreenButton();
}

function openServicerManager() {
  const modal = document.getElementById("servicerManagerModal");
  if (modal) {
    currentServicerFilter = 'all';
    document.querySelectorAll('.servicer-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.filter === 'all');
    });
    const findInput = document.getElementById('servicerQuickFind');
    if (findInput) findInput.value = '';
    modal.style.display = "block";
    loadServicersList("all", { resetScroll: true });
  }
}

function closeServicerManager() {
  const modal = document.getElementById("servicerManagerModal");
  if (modal) modal.style.display = "none";
}

function openDisplaySettings() {
  const modal = document.getElementById("displaySettingsModal");
  if (modal) modal.style.display = "block";
}

function closeDisplaySettings() {
  const modal = document.getElementById("displaySettingsModal");
  if (modal) modal.style.display = "none";
}

function filterServicerList(filter, btn) {
  currentServicerFilter = filter;
  document.querySelectorAll(".servicer-tab").forEach(t => t.classList.remove("active"));
  btn.classList.add("active");
  loadServicersList(filter, { resetScroll: true });
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

function getDisplayDocument() {
  if (!display_win || display_win.closed) return null;
  return display_win.document;
}

function getDisplayFullscreenElement() {
  const doc = getDisplayDocument();
  if (!doc) return null;
  return doc.fullscreenElement || doc.webkitFullscreenElement || null;
}

function updateFullscreenButton() {
  const button = document.getElementById("fullscreen-toggle");
  if (!button) return;

  const isFullscreen = !!getDisplayFullscreenElement();
  button.textContent = isFullscreen ? "全画面解除" : "全画面表示";
  button.classList.toggle("is-active", isFullscreen);
  button.setAttribute("aria-pressed", String(isFullscreen));
}

async function toggleFullscreen() {
  try {
    if (!display_win || display_win.closed) {
      openwindow();
      showToast("別画面を開きました。もう一度押すと全画面表示します", "info");
      return;
    }

    const doc = getDisplayDocument();
    if (!doc) {
      showToast("別画面を開けませんでした。ポップアップ設定を確認してください", "error");
      return;
    }

    const root = doc.documentElement;
    const requestFullscreen = root.requestFullscreen || root.webkitRequestFullscreen;
    const exitFullscreen = doc.exitFullscreen || doc.webkitExitFullscreen;

    if (getDisplayFullscreenElement()) {
      if (exitFullscreen) await exitFullscreen.call(doc);
    } else if (requestFullscreen) {
      display_win.focus();
      await requestFullscreen.call(root);
    } else {
      showToast("このブラウザでは別画面の全画面表示を利用できません", "error");
    }
  } catch (error) {
    console.warn("別画面の全画面表示切り替えに失敗しました:", error);
    showToast("別画面を全画面にできませんでした。別画面を開いてからもう一度押してください", "error");
  } finally {
    updateFullscreenButton();
  }
}

function hasBibleSearchData() {
  return Array.isArray(bible) && bible.length > 0;
}

function getBibleSearchInitialMessage() {
  if (!hasBibleSearchData()) {
    return '<p class="search-data-error">エラー: 聖書データが正しく読み込まれていません。</p>';
  }
  if (bibleSearchMode === 'ai') {
    return geminiSettings.apiKey
      ? '<p>テーマや状況を入力すると、AIが関連しそうな聖句を提案します。</p>'
      : '<p>AI機能設定を完了すると、テーマや状況から聖句候補を探せます。</p>';
  }
  return '<p>聖句本文に含まれる言葉を入力して、文字が一致する箇所を検索します。</p>';
}

function updateBibleSearchModeUi({ resetResults = false } = {}) {
  const hasKey = !!geminiSettings.apiKey;
  const isAiMode = bibleSearchMode === 'ai';
  const hasData = hasBibleSearchData();

  searchModeTextBtn = searchModeTextBtn || document.getElementById('searchModeTextBtn');
  searchModeAiBtn = searchModeAiBtn || document.getElementById('searchModeAiBtn');
  bibleSearchModeDescription = bibleSearchModeDescription || document.getElementById('bibleSearchModeDescription');
  aiSearchSetupNotice = aiSearchSetupNotice || document.getElementById('aiSearchSetupNotice');
  searchInput = searchInput || document.getElementById('searchInput');
  executeSearchBtn = executeSearchBtn || document.getElementById('executeSearchBtn');
  searchResultsDiv = searchResultsDiv || document.getElementById('searchResults');
  bibleSearchModal = bibleSearchModal || document.getElementById('bibleSearchModal');

  searchModeTextBtn?.classList.toggle('is-active', !isAiMode);
  searchModeTextBtn?.setAttribute('aria-selected', String(!isAiMode));
  searchModeAiBtn?.classList.toggle('is-active', isAiMode);
  searchModeAiBtn?.classList.toggle('needs-setup', !hasKey);
  searchModeAiBtn?.setAttribute('aria-selected', String(isAiMode));
  bibleSearchModal?.classList.toggle('is-ai-mode', isAiMode);

  if (bibleSearchModeDescription) {
    bibleSearchModeDescription.textContent = isAiMode
      ? '入力したテーマや状況からAIが候補を提案します。全文の文字一致検索は行いません。'
      : '登録済みの聖書本文から文字が一致する箇所だけを検索します。AIは使用しません。';
  }
  if (searchInput) {
    searchInput.placeholder = isAiMode
      ? '例：不安な時に励まされる聖句'
      : '例：いつも喜んでいなさい';
    searchInput.disabled = bibleSearchBusy || !hasData;
  }
  if (executeSearchBtn) {
    executeSearchBtn.textContent = bibleSearchBusy ? '検索中…' : (isAiMode ? 'AIで探す' : '全文検索');
    executeSearchBtn.disabled = bibleSearchBusy || !hasData || (isAiMode && !hasKey);
  }
  if (searchModeTextBtn) searchModeTextBtn.disabled = bibleSearchBusy;
  if (searchModeAiBtn) searchModeAiBtn.disabled = bibleSearchBusy;
  if (aiSearchSetupNotice) aiSearchSetupNotice.hidden = !isAiMode || hasKey;
  if (resetResults && searchResultsDiv) searchResultsDiv.innerHTML = getBibleSearchInitialMessage();
}

function setBibleSearchMode(mode, { clearInput = true, focus = true } = {}) {
  bibleAiSearchRequestId += 1;
  bibleSearchBusy = false;
  bibleSearchMode = mode === 'ai' ? 'ai' : 'text';
  if (clearInput && searchInput) searchInput.value = '';
  updateBibleSearchModeUi({ resetResults: true });
  if (focus && !searchInput?.disabled) setTimeout(() => searchInput.focus(), 0);
}

function openBibleSearchModal() {
  if (bibleSearchModal) bibleSearchModal.style.display = "block";
  setBibleSearchMode('text', { clearInput: true, focus: false });
  setTimeout(() => searchInput?.focus(), 0);
}

function closeBibleSearchModal() {
  bibleAiSearchRequestId += 1;
  setBibleSearchBusy(false);
  if (bibleSearchModal) bibleSearchModal.style.display = "none";
}

function performSearch() {
  setBibleSearchBusy(false);
  const query = searchInput.value.trim();
  if (!query) {
    searchResultsDiv.innerHTML = "<p>検索キーワードを入力してください。</p>";
    return;
  }
  bibleAiSearchRequestId += 1;
  const lowerCaseQuery = query.toLocaleLowerCase();
  const results = bible.slice(1).filter((rowArray) => {
    return rowArray.slice(1, 5).some(value => String(value || '').toLocaleLowerCase().includes(lowerCaseQuery));
  });
  displayResults(results, query);
}

function displayResults(results, query) {
  searchResultsDiv.replaceChildren();
  if (results.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'search-empty-state';
    empty.innerHTML = `<p>「${escapeHTML(query)}」に文字が一致する聖句は見つかりませんでした。</p>`;
    searchResultsDiv.appendChild(empty);
    return;
  }
  const shownResults = results.slice(0, 200);
  const summary = document.createElement('div');
  summary.className = 'search-results-summary';
  summary.textContent = results.length > shownResults.length
    ? `${results.length}件中、先頭の${shownResults.length}件を表示`
    : `${results.length}件見つかりました`;
  searchResultsDiv.appendChild(summary);

  shownResults.forEach((rowArray) => {
    searchResultsDiv.appendChild(createBibleResultItem(rowArray, { query }));
  });
}

function createBibleResultItem(rowArray, { query = '', reason = '', aiCandidate = false } = {}) {
  const highlight = (text, queryToHighlight) => {
    if (!text || !queryToHighlight) return escapeHTML(text || "");
    const regex = new RegExp("(" + escapeRegExp(queryToHighlight) + ")", "gi");
    return escapeHTML(text).replace(regex, '<span class="highlight">$1</span>');
  };

  const resultItem = document.createElement("div");
  resultItem.className = `result-item${aiCandidate ? ' ai-bible-result' : ''}`;
  const chReference = rowArray[1] || "";
  const chFullText = rowArray[2] || "";
  const jpReference = rowArray[3] || "";
  const jpFullText = rowArray[4] || "";
  const displayReferenceText = [jpReference, chReference].filter(Boolean).join(' / ') || "参照情報なし";
  let contentHTML = `<p class="verse-ref">${aiCandidate ? '<span class="ai-candidate-badge">これかも？</span>' : ''}${highlight(displayReferenceText, query)}</p>`;
  if (reason) contentHTML += `<p class="ai-candidate-reason">${escapeHTML(reason)}</p>`;
  if (jpFullText) contentHTML += `<p><span class="lang-label">日本語:</span> ${highlight(jpFullText, query)}</p>`;
  if (chFullText) contentHTML += `<p><span class="lang-label">中文:</span> ${highlight(chFullText, query)}</p>`;
  resultItem.innerHTML = contentHTML;

  const applyButton = document.createElement('button');
  applyButton.type = 'button';
  applyButton.className = 'apply-verse-btn';
  applyButton.textContent = '➜ 反映';
  applyButton.addEventListener('click', () => applySearchResult(jpReference));
  resultItem.appendChild(applyButton);
  return resultItem;
}

async function performAiBibleSearchFromInput() {
  const query = searchInput?.value.trim();
  if (!query) {
    searchResultsDiv.innerHTML = '<p>探したい聖句の内容を入力してください。</p>';
    searchInput?.focus();
    return;
  }
  await performAiBibleSearch(query, ++bibleAiSearchRequestId);
}

function executeActiveBibleSearch() {
  if (bibleSearchMode === 'ai') {
    performAiBibleSearchFromInput();
  } else {
    performSearch();
  }
}

async function performAiBibleSearch(query, requestId = ++bibleAiSearchRequestId) {
  if (!geminiSettings.apiKey) {
    showToast('AI候補を使うにはAPIキーを設定してください', 'error');
    openGeminiSettings();
    return;
  }

  setBibleSearchBusy(true);
  searchResultsDiv.innerHTML = `
    <div class="ai-search-loading" role="status">
      <span class="ai-search-spinner" aria-hidden="true"></span>
      <div><strong>「${escapeHTML(query)}」から候補を探しています…</strong><small>AIが候補を選び、本文は登録済みの聖書データから表示します。</small></div>
    </div>`;

  const bookCatalog = FullNameJP.map((name, index) => `${index + 1}:${name}`).join(', ');
  const systemPrompt = `あなたは聖書箇所を探す案内役です。利用者の曖昧な記憶、テーマ、悩み、場面に合いそうな聖句を最大5件提案してください。
聖書に実在する1つの節だけを候補にし、同じ箇所を重複させないでください。
出力は説明文やMarkdownを付けず、次のJSON配列だけにしてください。
[{"bookNumber":43,"chapter":3,"verse":16,"reason":"候補にした理由を日本語で短く"}]
bookNumberは次の対応表の番号です: ${bookCatalog}`;

  try {
    const responseText = await requestGeminiText(systemPrompt, query, 0.2);
    if (requestId !== bibleAiSearchRequestId) return;
    const parsed = parseGeminiJson(responseText);
    const rawCandidates = Array.isArray(parsed) ? parsed : parsed?.candidates;
    if (!Array.isArray(rawCandidates)) throw new Error('AIの候補形式を読み取れませんでした');

    // AIには参照候補だけを選ばせ、表示本文は必ずローカルの聖書データから取得する。
    const seenReferences = new Set();
    const candidates = [];
    rawCandidates.slice(0, 8).forEach((candidate) => {
      if (!candidate || typeof candidate !== 'object') return;
      const bookNumber = Number.parseInt(candidate.bookNumber, 10);
      const chapter = Number.parseInt(candidate.chapter, 10);
      const verse = Number.parseInt(candidate.verse, 10);
      if (!Number.isInteger(bookNumber) || !Number.isInteger(chapter) || !Number.isInteger(verse)
        || bookNumber < 1 || bookNumber > Abbre.length || chapter < 1 || verse < 1) return;
      const jpReference = `${Abbre[bookNumber - 1]}${chapter}:${verse}`;
      if (seenReferences.has(jpReference)) return;
      const row = bible.find(item => item?.[3] === jpReference);
      if (!row) return;
      seenReferences.add(jpReference);
      candidates.push({ row, reason: String(candidate.reason || '').trim() });
    });

    if (candidates.length === 0) throw new Error('登録済みの聖書データに一致するAI候補がありませんでした');
    displayAiBibleResults(candidates, query);
  } catch (error) {
    if (requestId !== bibleAiSearchRequestId) return;
    recordGeminiError('聖句AI検索', error);
    displayAiBibleSearchError(query, error);
  } finally {
    if (requestId === bibleAiSearchRequestId) setBibleSearchBusy(false);
  }
}

function setBibleSearchBusy(isBusy) {
  bibleSearchBusy = isBusy;
  searchResultsDiv?.setAttribute('aria-busy', String(isBusy));
  updateBibleSearchModeUi();
}

function displayAiBibleResults(candidates, query) {
  searchResultsDiv.replaceChildren();
  const heading = document.createElement('div');
  heading.className = 'ai-results-heading';
  heading.innerHTML = `<strong>✨ 「${escapeHTML(query)}」の、これかも？</strong><small>AIの提案です。本文を確認してから反映してください。</small>`;
  searchResultsDiv.appendChild(heading);
  candidates.forEach(({ row, reason }) => {
    searchResultsDiv.appendChild(createBibleResultItem(row, { reason, aiCandidate: true }));
  });
}

function displayAiBibleSearchError(query, error) {
  searchResultsDiv.replaceChildren();
  const panel = document.createElement('div');
  panel.className = 'ai-search-error';
  const title = document.createElement('strong');
  title.textContent = 'AI候補を取得できませんでした';
  const message = document.createElement('p');
  message.textContent = error.message;
  const actions = document.createElement('div');
  actions.className = 'ai-search-error-actions';
  const retry = document.createElement('button');
  retry.type = 'button';
  retry.className = 'primary-btn';
  retry.textContent = 'もう一度試す';
  retry.addEventListener('click', () => performAiBibleSearch(query, ++bibleAiSearchRequestId));
  const settings = document.createElement('button');
  settings.type = 'button';
  settings.className = 'secondary-btn';
  settings.textContent = '設定とエラーログを見る';
  settings.addEventListener('click', openGeminiSettings);
  actions.append(retry, settings);
  panel.append(title, message, actions);
  searchResultsDiv.appendChild(panel);
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

  const hymnNumber = escapeHTML(currentTitleInfo[0] || "");
  const chineseTitle = escapeHTML(currentTitleInfo[1] || "");
  const japaneseTitle = escapeHTML(currentTitleInfo[2] || "");
  const verseTotal = currentLyricsSections.length;

  let wrap = "<div><p id='h_title_text'>" + hymnNumber + "番</p>";
  wrap += "<p id='h_ch_text'><<" + chineseTitle + ">></p>";
  wrap += "<p id='h_jp_text'><<" + japaneseTitle + ">></p>";
  if (verseTotal > 0) {
    wrap += "<p id='h_verse_summary'>全 " + verseTotal + " 番</p>";
  }
  wrap += "</div>";
  if (outputDiv) outputDiv.innerHTML = wrap;
}
function showLyricsVerse(index) {
  if (!display_win || display_win.closed || !currentTitleInfo) return;
  if (currentMode !== "hymn") switchScreen("hymn");
  if (!currentLyricsSections[index]) return;

  const contentHtml = currentLyricsSections[index].content;
  const verseLabel = currentLyricsSections[index].label;
  const hymnNumber = escapeHTML(currentTitleInfo[0] || "");
  const japaneseTitle = escapeHTML(currentTitleInfo[2] || "");
  const chineseTitle = escapeHTML(currentTitleInfo[1] || "");
  const verseTotal = currentLyricsSections.length;
  const versePosition = index + 1;
  const verseMeta = escapeHTML(`${verseLabel}  (${versePosition} / ${verseTotal})`);

  const doc = display_win.document;
  const outputDiv = doc.getElementById("h_output");
  const bgNumDiv = doc.getElementById("h_bg_number");

  if (bgNumDiv) bgNumDiv.innerText = verseLabel;

  if (!outputDiv) return;

  const headerHtml = `
    <div style="flex: 0 0 auto; width: 100%; text-align: center; padding: 10px 20px; background: rgba(255,255,255,0.92); border-bottom: 2px solid #ccc; display: flex; align-items: center; justify-content: center; gap: 2rem; flex-wrap: wrap;">
      <span style="font-size: 4rem; font-weight: bold;">${hymnNumber} ${japaneseTitle}/${chineseTitle}</span>
      <span style="font-size: 3rem; font-weight: 800; color: #006064; border: 3px solid #00838f; border-radius: 999px; padding: 0.1em 0.65em;">${verseMeta}</span>
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
  initNativeSuggestionSuppression();
  initCustomChoiceControls();
  // DOM Elements Assignment
  bibleSearchModal = document.getElementById('bibleSearchModal');
  openSearchModalBtn = document.getElementById('openSearchModalBtn');
  closeSearchModalBtn = document.getElementById('closeSearchModalBtn');
  searchInput = document.getElementById('searchInput');
  executeSearchBtn = document.getElementById('executeSearchBtn');
  searchResultsDiv = document.getElementById('searchResults');
  searchModeTextBtn = document.getElementById('searchModeTextBtn');
  searchModeAiBtn = document.getElementById('searchModeAiBtn');
  bibleSearchModeDescription = document.getElementById('bibleSearchModeDescription');
  aiSearchSetupNotice = document.getElementById('aiSearchSetupNotice');
  openAiSettingsFromSearch = document.getElementById('openAiSettingsFromSearch');
  updateTranslateButtonsVisibility();

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

  const fullscreenButton = document.getElementById("fullscreen-toggle");
  if (fullscreenButton) {
    fullscreenButton.addEventListener("click", toggleFullscreen);
    updateFullscreenButton();
  }
  window.addEventListener("focus", updateFullscreenButton);

  // Modal Buttons
  document.querySelectorAll(".modal_abbre_btn").forEach((ele) => {
    ele.addEventListener("click", (e) => {
      if (e.target.className == "modal_abbre_btn") ele.style.left = "-100vw";
    });
  });

  // Search Modal Listeners
  if (openSearchModalBtn) openSearchModalBtn.addEventListener("click", openBibleSearchModal);
  if (closeSearchModalBtn) closeSearchModalBtn.addEventListener("click", closeBibleSearchModal);
  if (searchModeTextBtn) searchModeTextBtn.addEventListener("click", () => setBibleSearchMode('text'));
  if (searchModeAiBtn) searchModeAiBtn.addEventListener("click", () => setBibleSearchMode('ai'));
  if (executeSearchBtn) executeSearchBtn.addEventListener("click", executeActiveBibleSearch);
  if (openAiSettingsFromSearch) openAiSettingsFromSearch.addEventListener("click", openGeminiSettings);
if (searchInput) {
  searchInput.addEventListener("keypress", function (event) {
    if (event.key === "Enter") {
      event.preventDefault();
      executeActiveBibleSearch();
    }
  });
}

window.addEventListener("click", function (event) {
  const modal = event.target.closest(".search-modal");
  if (modal && event.target === modal) modal.style.display = "none";
});
window.addEventListener("keydown", function (event) {
  if (event.key === "Escape") {
    document.querySelectorAll(".search-modal").forEach(modal => {
      if (modal.style.display === "block") modal.style.display = "none";
    });
  }
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
