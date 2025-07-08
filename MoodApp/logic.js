// --- DATA & STATE MANAGEMENT ---
const emotions = ["Joy", "Sadness", "Trust", "Disgust", "Fear", "Anger", "Surprise", "Anticipation", "Calm"];
const emotionColors = {
    Joy: '#facc15', Sadness: '#60a5fa', Trust: '#4ade80', Disgust: '#a3e635', Fear: '#a78bfa',
    Anger: '#f87171', Surprise: '#fb923c', Anticipation: '#f472b6', Calm: '#5eead4', Default: '#36a2eb'
};
let predefinedStates = [];
let history = [];
let trendViewMode = 'entries'; // 'entries' or 'daily'

// --- DOM ELEMENTS ---
const slidersContainer = document.getElementById('sliders-container');
const selectorA = document.getElementById('state-selector-a');
const selectorB = document.getElementById('state-selector-b');
const compareToggle = document.getElementById('compare-toggle');
const compareControls = document.getElementById('compare-controls');
const saveBtn = document.getElementById('save-btn');
const customStateNameInput = document.getElementById('custom-state-name');
const customStateNotesInput = document.getElementById('custom-state-notes');
const selectedStateNotes = document.getElementById('selected-state-notes');
const analyzeBtn = document.getElementById('analyze-btn');
const resetBtn = document.getElementById('reset-btn');
const aiModal = document.getElementById('ai-modal');
const aiResult = document.getElementById('ai-result');
const closeModalBtn = document.getElementById('close-modal-btn');
const logEntryBtn = document.getElementById('log-entry-btn');
const historyList = document.getElementById('history-list');
const trendEmotionSelector = document.getElementById('trend-emotion-selector');
const trendViewToggle = document.getElementById('trend-view-toggle');

// --- CHART SETUP ---
const emotionChartCtx = document.getElementById('emotionChart').getContext('2d');
const emotionChart = new Chart(emotionChartCtx, {
    type: 'radar',
    data: { labels: emotions, datasets: [] },
    options: {
        responsive: true, maintainAspectRatio: false,
        scales: { r: { suggestedMin: 0, suggestedMax: 10, pointLabels: { font: { size: 14 } } } },
        plugins: { legend: { position: 'top' } }
    }
});

const trendChartCtx = document.getElementById('trendChart').getContext('2d');
const trendChart = new Chart(trendChartCtx, {
    type: 'line',
    data: { labels: [], datasets: [{ label: 'Emotion Trend', data: [], tension: 0.1 }] },
    options: {
        responsive: true, maintainAspectRatio: false,
        scales: {
            x: { type: 'time', time: { unit: 'day' } },
            y: { suggestedMin: 0, suggestedMax: 10 }
        }
    }
});

// --- CORE LOGIC & FUNCTIONS ---

function getDominantEmotion(values) {
    const maxValue = Math.max(...values);
    if (maxValue === 0) return { name: 'Neutral', color: emotionColors.Default };
    const dominantIndex = values.indexOf(maxValue);
    const name = emotions[dominantIndex];
    return { name, color: emotionColors[name] };
}

function applyStateToRadarChart(values, datasetIndex = 0, label = 'Primary State') {
    const { color } = getDominantEmotion(values);
    const dataset = {
        label: label, data: [...values], fill: true,
        backgroundColor: datasetIndex === 0 ? `${color}40` : '#9ca3af40',
        borderColor: datasetIndex === 0 ? color : '#9ca3af',
        pointBackgroundColor: datasetIndex === 0 ? color : '#9ca3af'
    };
    if (emotionChart.data.datasets.length > datasetIndex) {
        emotionChart.data.datasets[datasetIndex] = dataset;
    } else {
        emotionChart.data.datasets.push(dataset);
    }
    emotionChart.update();
}

function updateSliders(values) {
    values.forEach((value, index) => {
        const emotion = emotions[index];
        document.getElementById(`slider-${emotion}`).value = value;
        document.getElementById(`value-${emotion}`).textContent = value;
    });
}

function populateSelectors() {
    [selectorA, selectorB].forEach(sel => {
        const currentValue = sel.value;
        sel.innerHTML = '<option value="">-- Select State --</option>';
        predefinedStates.forEach((state, index) => sel.add(new Option(state.name, index)));
        sel.value = currentValue;
    });
}

// --- HISTORY & TRENDS ---

function calculateDailyAverages() {
    if (history.length === 0) return [];
    
    const dailyData = new Map();
    history.forEach(entry => {
        const date = new Date(entry.timestamp).toISOString().split('T')[0];
        if (!dailyData.has(date)) {
            dailyData.set(date, { count: 0, sums: Array(9).fill(0) });
        }
        const day = dailyData.get(date);
        day.count++;
        entry.values.forEach((val, i) => day.sums[i] += val);
    });

    const averages = [];
    for (const [date, { count, sums }] of dailyData.entries()) {
        averages.push({
            timestamp: date,
            values: sums.map(sum => sum / count)
        });
    }
    return averages.sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
}

function renderHistoryList() {
    historyList.innerHTML = '';
    [...history].reverse().forEach((entry, index) => {
        const dominant = getDominantEmotion(entry.values);
        const li = document.createElement('li');
        li.dataset.index = history.length - 1 - index;
        li.innerHTML = `
            <span class="date">${new Date(entry.timestamp).toLocaleString()}</span>
            <span class="dominant-emotion" style="background-color: ${dominant.color};">${dominant.name}</span>`;
        historyList.appendChild(li);
    });
}

function renderTrendChart() {
    const sourceData = trendViewMode === 'daily' ? calculateDailyAverages() : history;
    const selectedEmotionIndex = trendEmotionSelector.value;
    const selectedEmotionName = emotions[selectedEmotionIndex];
    
    trendChart.data.labels = sourceData.map(entry => entry.timestamp);
    trendChart.data.datasets[0].data = sourceData.map(entry => entry.values[selectedEmotionIndex]);
    trendChart.data.datasets[0].label = `${selectedEmotionName} Trend (${trendViewMode})`;
    trendChart.options.scales.x.time.unit = trendViewMode === 'daily' ? 'day' : 'hour';
    trendChart.update();
}

// --- DATA PERSISTENCE ---

function loadData() {
    const defaultStates = [
        { name: "Neutral", values: [5, 5, 5, 5, 5, 5, 5, 5, 5], notes: "A balanced, neutral state." },
        { name: "Anxious", values: [1, 5, 1, 3, 9, 3, 5, 8, 0], notes: "Feeling worried and tense, often about an imminent event or something with an uncertain outcome." },
        { name: "Content", values: [8, 0, 8, 0, 0, 0, 1, 3, 10], notes: "A state of peaceful satisfaction." },
    ];
    const storedStates = localStorage.getItem('emotionStates');
    predefinedStates = storedStates ? JSON.parse(storedStates) : defaultStates;

    const storedHistory = localStorage.getItem('emotionHistory');
    history = storedHistory ? JSON.parse(storedHistory) : [];
}

function saveData(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
}

function saveCustomState() {
    const name = customStateNameInput.value.trim();
    const notes = customStateNotesInput.value.trim();
    if (!name) return alert("Please enter a name for your custom state.");
    
    const values = Array.from(slidersContainer.querySelectorAll('input[type="range"]')).map(s => Number(s.value));
    
    predefinedStates.push({ name, values, notes, createdAt: new Date().toISOString() });
    saveData('emotionStates', predefinedStates);
    populateSelectors();
    alert(`State "${name}" saved!`);
    customStateNameInput.value = "";
    customStateNotesInput.value = "";
}

function logCurrentState() {
    const values = Array.from(slidersContainer.querySelectorAll('input[type="range"]')).map(s => Number(s.value));
    history.push({ timestamp: new Date().toISOString(), values });
    saveData('emotionHistory', history);
    renderHistoryList();
    renderTrendChart();
}

// --- EVENT HANDLERS ---
selectorA.addEventListener('change', (e) => {
    selectedStateNotes.style.display = 'none';
    const state = predefinedStates[e.target.value];
    if (state) {
        applyStateToRadarChart(state.values, 0, state.name);
        updateSliders(state.values);
        if (state.notes) {
            selectedStateNotes.textContent = state.notes;
            selectedStateNotes.style.display = 'block';
        }
    }
});

compareToggle.addEventListener('change', (e) => {
    compareControls.style.display = e.target.checked ? 'block' : 'none';
    if (!e.target.checked && emotionChart.data.datasets.length > 1) {
        emotionChart.data.datasets.pop();
        emotionChart.update();
    }
});

selectorB.addEventListener('change', (e) => {
    const state = predefinedStates[e.target.value];
    if (state && compareToggle.checked) applyStateToRadarChart(state.values, 1, state.name);
});

slidersContainer.addEventListener('input', (e) => {
    if (e.target.type === 'range') {
        const values = Array.from(slidersContainer.querySelectorAll('input[type="range"]')).map(s => Number(s.value));
        applyStateToRadarChart(values, 0, "Custom State");
        document.getElementById(`value-${emotions[e.target.dataset.index]}`).textContent = e.target.value;
        selectorA.value = "";
        selectedStateNotes.style.display = 'none';
    }
});

historyList.addEventListener('click', (e) => {
    const li = e.target.closest('li');
    if (li) {
        const entry = history[li.dataset.index];
        applyStateToRadarChart(entry.values, 0, `Logged: ${new Date(entry.timestamp).toLocaleDateString()}`);
        updateSliders(entry.values);
        selectorA.value = "";
        selectedStateNotes.style.display = 'none';
    }
});

trendEmotionSelector.addEventListener('change', renderTrendChart);
trendViewToggle.addEventListener('change', (e) => {
    trendViewMode = e.target.value;
    renderTrendChart();
});

saveBtn.addEventListener('click', saveCustomState);
resetBtn.addEventListener('click', () => {
    const neutralState = predefinedStates.find(s => s.name === "Neutral") || { values: Array(9).fill(5) };
    applyStateToRadarChart(neutralState.values, 0, "Neutral");
    updateSliders(neutralState.values);
    selectorA.value = "";
    selectedStateNotes.style.display = 'none';
});
logEntryBtn.addEventListener('click', logCurrentState);
closeModalBtn.addEventListener('click', () => { aiModal.style.display = 'none'; });

// --- AI & MODAL ---
async function callGemini(prompt) {
    const apiKey = "YOUR_API_KEY_HERE"; // ⚠️ IMPORTANT: Replace with your actual key
    if (apiKey === "YOUR_API_KEY_HERE") return `{"classification": "Error", "output": ["AI analysis failed. Please add your API key to the script.", "You can get a key from Google AI Studio."]}`;
    
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const payload = {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
    };

    try {
        const response = await fetch(apiUrl, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error(`API call failed: ${response.status}`);
        const result = await response.json();
        return result.candidates[0].content.parts[0].text;
    } catch (error) {
        console.error("Gemini API Error:", error);
        return `{"classification": "Error", "output": ["Sorry, an error occurred during AI analysis.", "${error.message}"]}`;
    }
}

analyzeBtn.addEventListener('click', async () => {
    aiModal.style.display = 'flex';
    aiResult.innerHTML = '<div class="loader"></div>';
    
    const values = emotionChart.data.datasets[0].data;
    const emotionValues = emotions.map((label, i) => `${label}: ${values[i]}`).join(', ');
    
    const prompt = `
        An emotional state is defined by values (0-10): (${emotionValues}).
        First, classify this state in one word: Positive, Negative, or Neutral.
        Then, based on that classification:
        - If Negative, provide two distinct, helpful, and actionable suggestions.
        - If Positive, provide two distinct, uplifting affirmations.
        - If Neutral, provide two reflective questions to help understand the state.
        Format the response as a single JSON object with "classification" (string) and "output" (an array of two strings).
        Example: {"classification": "Negative", "output": ["Suggestion 1...", "Suggestion 2..."]}`;

    const analysisText = await callGemini(prompt);
    
    try {
        const result = JSON.parse(analysisText);
        let html = `<h3>A ${result.classification} State</h3><ul>`;
        result.output.forEach(item => { html += `<li>${item}</li>`; });
        html += `</ul>`;
        aiResult.innerHTML = html;
    } catch (error) {
        console.error("Error parsing AI response:", error);
        aiResult.innerHTML = `<p>There was an issue formatting the AI's response.</p>`;
    }
});

// --- INITIALIZATION ---
function init() {
    emotions.forEach((emotion, index) => {
        slidersContainer.innerHTML += `<div class="control">
            <label for="slider-${emotion}">${emotion}</label>
            <input type="range" id="slider-${emotion}" min="0" max="10" value="5" data-index="${index}">
            <span class="value-display" id="value-${emotion}">5</span>
        </div>`;
        trendEmotionSelector.add(new Option(emotion, index));
    });

    loadData();
    populateSelectors();
    renderHistoryList();
    renderTrendChart();
    resetBtn.click();
}

init();