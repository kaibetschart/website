
/* ============================================================
   CONFIGURATION
============================================================ */

const DEFAULT_SETTINGS = {
    scaleX: 1,
    scaleY: 1,
    translateX: 0,
    translateY: 0,
    letterSpacing: 0,
    color: "#000000"
};


const SETTING_CONFIG = {

    scaleX: {
        label: "scaleX",
        min: 0,
        max: 2,
        step: 0.01,
        unit: ""
    },

    scaleY: {
        label: "scaleY",
        min: 0,
        max: 2,
        step: 0.01,
        unit: ""
    },

    translateX: {
        label: "translateX",
        min: 0,
        max: 2,
        step: 1,
        unit: "px"
    },

    translateY: {
        label: "translateY",
        min: 0,
        max: 2,
        step: 1,
        unit: "px"
    },

    color: {
        label: "color"
    }
};


/* ============================================================
   DOM REFERENCES
============================================================ */

const textInput =
    document.getElementById("textInput");

const generateButton =
    document.getElementById("generateButton");

const letterContainer =
    document.getElementById("letterContainer");

const fontSizeInput =
    document.getElementById("fontSize");

let fontFamilyInput =
    document.getElementById("fontFamily");

const selectionInfo =
    document.getElementById("selectionInfo");

const controlList =
    document.getElementById("controlList");

const selectAllButton =
    document.getElementById("selectAllButton");

const deselectButton =
    document.getElementById("deselectButton");

const randomAllButton =
    document.getElementById("randomAllButton");

const resetAllButton =
    document.getElementById("resetAllButton");

const randomColor =
    document.getElementById("randomColor");

const exportButton =
    document.getElementById("exportButton");

const status =
    document.getElementById("status");

const undoButton =
    document.getElementById("undoButton");

const redoButton =
    document.getElementById("redoButton");


/* ============================================================
   STATE
============================================================ */

let nextLetterId = 0;

let letters = [];

/*
    IMPORTANT:
 
    selectedIds now represents ONLY visually selected letters.
 
    An empty Set is completely valid.
 
    Empty selection means:
 
        "there is no visual selection, therefore operations
         target ALL letters."
 
    This is different from the previous implementation.
*/
let selectedIds = new Set();


/* ============================================================
   HISTORY + CHANGE LOG
============================================================ */

const MAX_HISTORY = 100;
const MAX_CHANGE_LOG = 200;

let undoStack = [];
let redoStack = [];
let changeLog = [];
let restoringHistory = false;
let initializing = true;

function cloneSettings(settings) {
    return {
        scaleX: settings.scaleX,
        scaleY: settings.scaleY,
        translateX: settings.translateX,
        translateY: settings.translateY,
        letterSpacing: settings.letterSpacing ?? 0,
        color: settings.color
    };
}

function createHistorySnapshot() {
    return {
        text: textInput.value,
        fontSize: fontSizeInput.value,
        fontFamily: fontFamilyInput.value,
        selectedIds: [...selectedIds],
        nextLetterId,
        letters: letters.map(letter => ({
            id: letter.id,
            character: letter.character,
            settings: cloneSettings(letter.settings)
        })),
        randomColor: randomColor ? randomColor.value : "#000000"
    };
}

function snapshotsEqual(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
}

function updateHistoryButtons() {
    if (undoButton) undoButton.disabled = undoStack.length === 0;
    if (redoButton) redoButton.disabled = redoStack.length === 0;
}

/*
    ------------------------------------------------------------
    CHANGE LOG
    ------------------------------------------------------------

    The status div shows ONLY the newest change.

    Clicking the status div opens a scrollable history panel.
    The newest change is always at the top of that panel.
*/

let changeHistoryOpen = false;
let changeHistoryPanel = null;

function setupChangeHistoryUI() {
    if (!status) return;

    status.classList.add("change-status");
    status.setAttribute(
        "title",
        "Click to view change history"
    );
    status.setAttribute("role", "button");
    status.setAttribute("tabindex", "0");

    status.addEventListener("click", event => {
        event.stopPropagation();
        toggleChangeHistory();
    });

    status.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            event.stopPropagation();
            toggleChangeHistory();
        }

        if (event.key === "Escape") {
            closeChangeHistory();
        }
    });

    document.addEventListener("click", event => {
        if (!changeHistoryOpen) return;

        if (
            event.target !== status &&
            !status.contains(event.target) &&
            changeHistoryPanel &&
            !changeHistoryPanel.contains(event.target)
        ) {
            closeChangeHistory();
        }
    });


}

function positionChangeHistoryPanel() {
    if (!status || !changeHistoryPanel) return;

    const rect = status.getBoundingClientRect();

    let top = rect.bottom + 8;
    let left = rect.left;

    const panelWidth =
        Math.min(520, window.innerWidth - 32);

    if (left + panelWidth > window.innerWidth - 16) {
        left = window.innerWidth - panelWidth - 16;
    }

    if (left < 16) {
        left = 16;
    }

    const maxHeight =
        Math.min(420, window.innerHeight - 32);

    if (top + maxHeight > window.innerHeight - 16) {
        top = Math.max(
            16,
            rect.top - maxHeight - 8
        );
    }

    changeHistoryPanel.style.top = `${top}px`;
    changeHistoryPanel.style.left = `${left}px`;
}

function renderChangeLog() {
    if (!status) return;

    /*
        Status shows ONLY the newest action.
    */
    status.textContent =
        changeLog.length > 0
            ? getChangeLogMessage(changeLog[0])
            : "No changes yet.";

    /*
        Update the expanded history panel if it is open.
        Newest item is rendered first.
    */
    if (!changeHistoryPanel) return;

    changeHistoryPanel.innerHTML = "";

    if (changeLog.length === 0) {
        const empty = document.createElement("div");
        empty.className = "change-history-empty";
        empty.textContent = "No changes yet.";
        changeHistoryPanel.appendChild(empty);
        return;
    }

    changeLog.forEach((historyEntry, index) => {
        const entry = document.createElement("div");
        entry.className = "change-history-entry";
        entry.textContent =
            getChangeLogMessage(historyEntry);

        if (getChangeLogSnapshot(historyEntry)) {
            entry.classList.add("clickable");
            entry.setAttribute("role", "button");
            entry.setAttribute("tabindex", "0");
            entry.title = "Click to jump to this history state";

            entry.addEventListener("click", event => {
                event.stopPropagation();
                jumpToHistoryEntry(index);
            });

            entry.addEventListener("keydown", event => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    event.stopPropagation();
                    jumpToHistoryEntry(index);
                }
            });
        }

        changeHistoryPanel.appendChild(entry);
    });

    positionChangeHistoryPanel();
}

function openChangeHistory() {
    if (!status) return;

    if (!changeHistoryPanel) {
        changeHistoryPanel =
            document.createElement("div");

        changeHistoryPanel.className =
            "change-history-panel";

        document.body.appendChild(
            changeHistoryPanel
        );
    }

    changeHistoryOpen = true;
    renderChangeLog();
    positionChangeHistoryPanel();
}

function closeChangeHistory() {
    changeHistoryOpen = false;

    if (changeHistoryPanel) {
        changeHistoryPanel.remove();
        changeHistoryPanel = null;
    }
}

function toggleChangeHistory() {
    if (changeHistoryOpen) {
        closeChangeHistory();
    } else {
        openChangeHistory();
    }
}

window.addEventListener("resize", () => {
    if (changeHistoryOpen) {
        positionChangeHistoryPanel();
    }
});

window.addEventListener("scroll", () => {
    if (changeHistoryOpen) {
        positionChangeHistoryPanel();
    }
}, true);

function logChange(message, snapshot = null) {
    if (!message) return;

    /*
        Store the snapshot belonging to this entry so the user can
        click an entry and jump back to that exact application state.
        Newest entry is stored at index 0.
    */
    changeLog.unshift({
        message,
        snapshot: snapshot
            ? JSON.parse(JSON.stringify(snapshot))
            : null
    });

    if (changeLog.length > MAX_CHANGE_LOG) {
        changeLog.length = MAX_CHANGE_LOG;
    }

    renderChangeLog();
}

function getChangeLogMessage(entry) {
    return typeof entry === "string"
        ? entry
        : entry?.message || "";
}

function getChangeLogSnapshot(entry) {
    return typeof entry === "string"
        ? null
        : entry?.snapshot || null;
}

function jumpToHistoryEntry(index) {
    const entry = changeLog[index];
    const snapshot = getChangeLogSnapshot(entry);

    if (!snapshot || restoringHistory) return;

    const current = createHistorySnapshot();

    if (snapshotsEqual(current, snapshot)) {
        closeChangeHistory();
        return;
    }

    /*
        Jumping to a history entry behaves like a normal undoable
        change: the current state is saved so it can be undone.
    */
    pushUndoSnapshot(current);
    redoStack = [];

    restoreHistorySnapshot(snapshot);

    /*
        Do not add a new "Jumped to history" entry.
        The status simply becomes the exact entry the user jumped to,
        keeping the history overview clean and avoiding recursive jump messages.
    */
    status.textContent = getChangeLogMessage(entry);

    updateHistoryButtons();
    closeChangeHistory();
}

function pushUndoSnapshot(snapshot) {
    if (restoringHistory || !snapshot) return;

    undoStack.push(snapshot);

    if (undoStack.length > MAX_HISTORY) {
        undoStack.shift();
    }

    redoStack = [];
    updateHistoryButtons();
}

function saveHistory() {
    if (restoringHistory || initializing) return;
    pushUndoSnapshot(createHistorySnapshot());
}

function beginHistoryTransaction() {
    if (restoringHistory || initializing) return null;
    return createHistorySnapshot();
}

function commitHistoryTransaction(before, description) {
    if (!before || restoringHistory || initializing) return;

    const after = createHistorySnapshot();

    if (snapshotsEqual(before, after)) return;

    pushUndoSnapshot(before);

    if (description) {
        logChange(description, after);
    }
}

function letterDescription(letter) {
    if (!letter) return "letter";

    if (letter.character === " ") return "space";
    if (letter.character === "\n") return "newline";
    if (letter.character === "\t") return "tab";

    return `letter "${letter.character}"`;
}

function selectionDescription(targets) {
    if (targets.length === letters.length) {
        return "all letters";
    }

    if (targets.length === 1) {
        return letterDescription(targets[0]);
    }

    return `${targets.length} selected letters`;
}

function settingLabel(settingName) {
    return {
        scaleX: "X scale",
        scaleY: "Y scale",
        translateX: "X translate",
        translateY: "Y translate",
        color: "color"
    }[settingName] || settingName;
}

function restoreHistorySnapshot(snapshot) {
    restoringHistory = true;

    textInput.value = snapshot.text;
    fontSizeInput.value = snapshot.fontSize;

    fontFamilyInput.value = snapshot.fontFamily;

    document.querySelectorAll(".setting-enabled").forEach(input => {
        updateSettingRowState(
            input.dataset.setting
        );
    });

    if (randomColor && snapshot.randomColor) {
        randomColor.value =
            snapshot.randomColor;
    }

    letterContainer.innerHTML = "";
    letters = [];

    /*
        Rebuild the generated content from the saved input text so
        literal "<br>" tokens become real line breaks again.
        Saved letter settings are consumed only for actual letters;
        <br> elements are never added to the letters array.
    */
    let savedLetterIndex = 0;
    let textIndex = 0;

    while (textIndex < snapshot.text.length) {

        if (snapshot.text.slice(textIndex, textIndex + 4) === "<br>") {

            const breakElement =
                document.createElement("br");

            letterContainer.appendChild(breakElement);

            textIndex += 4;
            continue;
        }

        const savedLetter =
            snapshot.letters[savedLetterIndex++];

        if (!savedLetter) break;

        const span =
            document.createElement("span");

        span.className = "letter";

        if (
            savedLetter.character === " " ||
            savedLetter.character === "\n" ||
            savedLetter.character === "\t"
        ) {
            span.classList.add("space");
        }

        span.textContent =
            savedLetter.character;

        const letter = {
            id: savedLetter.id,
            character: savedLetter.character,
            element: span,
            settings:
                cloneSettings(
                    savedLetter.settings
                )
        };

        span.dataset.id = letter.id;

        span.addEventListener(
            "click",
            () => {
                toggleSelection(letter.id);
            }
        );

        letterContainer.appendChild(span);
        letters.push(letter);
        textIndex++;
    }

    nextLetterId =
        snapshot.nextLetterId;

    selectedIds =
        new Set(snapshot.selectedIds);

    updateParentStyles();
    applyAllLetterStyles();
    updateSelectionVisuals();
    updateControlPanel();

    restoringHistory = false;

    updateHistoryButtons();
}

function undo() {
    if (undoStack.length === 0) return;

    const current =
        createHistorySnapshot();

    const previous =
        undoStack.pop();

    redoStack.push(current);

    restoreHistorySnapshot(previous);

    logChange("Undid previous change", createHistorySnapshot());

    updateHistoryButtons();
}

function redo() {
    if (redoStack.length === 0) return;

    const current =
        createHistorySnapshot();

    const next =
        redoStack.pop();

    undoStack.push(current);

    restoreHistorySnapshot(next);

    logChange("Redid previous change", createHistorySnapshot());

    updateHistoryButtons();
}

setupChangeHistoryUI();

/* ============================================================
   GENERATE
============================================================ */

function generateText() {

    const before = beginHistoryTransaction();
    const text = textInput.value;

    letterContainer.innerHTML = "";

    letters = [];

    /*
        Start with NO visual selection.
 
        Therefore the blue selection boxes are absent by default.
 
        Since no letters are selected, random operations will
        automatically target every letter.
    */
    selectedIds.clear();

    /*
        The literal text "<br>" in the input creates a real <br>
        element instead of four letter spans.

        Example:

            HELLO<br>WORLD

        creates two lines of letter spans with a real line break
        between them.
    */
    let textIndex = 0;

    while (textIndex < text.length) {

        if (text.slice(textIndex, textIndex + 4) === "<br>") {

            const breakElement =
                document.createElement("br");

            letterContainer.appendChild(breakElement);

            textIndex += 4;
            continue;
        }

        const character = text[textIndex];

        const span =
            document.createElement("span");

        span.className = "letter";

        if (
            character === " " ||
            character === "\n" ||
            character === "\t"
        ) {
            span.classList.add("space");
        }

        span.textContent = character;

        const letter = {

            id: nextLetterId++,

            character,

            element: span,

            settings: {
                ...DEFAULT_SETTINGS
            }
        };

        span.dataset.id = letter.id;

        span.addEventListener("click", () => {
            toggleSelection(letter.id);
        });

        letterContainer.appendChild(span);

        letters.push(letter);
        textIndex++;
    }

    updateParentStyles();

    applyAllLetterStyles();

    updateSelectionVisuals();

    updateControlPanel();

    if (before) {
        const preview = text.length > 40 ? text.slice(0, 40) + "…" : text;
        commitHistoryTransaction(
            before,
            `Generated text: "${preview.replaceAll("\n", "\\n")}"`
        );
    }
}


/* ============================================================
   SELECTION
============================================================ */

/*
    Click one letter:
 
        unselected -> selected
        selected   -> unselected
*/
function toggleSelection(id) {

    const letter = letters.find(item => item.id === id);
    const before = beginHistoryTransaction();
    const wasSelected = selectedIds.has(id);

    if (wasSelected) {
        selectedIds.delete(id);
    } else {
        selectedIds.add(id);
    }

    updateSelectionVisuals();
    updateControlPanel();

    if (before && letter) {
        commitHistoryTransaction(
            before,
            `${wasSelected ? "Deselected" : "Selected"} ${letterDescription(letter)}`
        );
    }
}


/*
    Select every letter visually.
*/
function selectAll() {

    const before = beginHistoryTransaction();

    selectedIds = new Set(
        letters.map(letter => letter.id)
    );

    updateSelectionVisuals();
    updateControlPanel();

    if (before) {
        commitHistoryTransaction(
            before,
            `Selected all letters (${letters.length})`
        );
    }
}


/*
    Deselect every letter visually.
 
    This is now genuinely a deselection operation.
 
    There is NO fallback to all-selected.
 
    However, all random operations use getTargetLetters(),
    which interprets an empty visual selection as ALL letters.
*/
function deselectAll() {

    const before = beginHistoryTransaction();
    const count = selectedIds.size;

    selectedIds.clear();

    updateSelectionVisuals();
    updateControlPanel();

    if (before) {
        commitHistoryTransaction(
            before,
            count > 0
                ? `Deselected all letters (${count})`
                : "Cleared visual selection"
        );
    }
}


/*
    This is the key distinction between:
 
        VISUAL SELECTION
        EFFECTIVE TARGET
 
    If nothing is selected visually, every letter is targeted.
*/
function getTargetLetters() {

    if (selectedIds.size === 0) {
        return [...letters];
    }

    return letters.filter(letter =>
        selectedIds.has(letter.id)
    );
}


/*
    The control panel needs a reference letter even when there
    is no visual selection.
 
    In that situation it uses the first letter.
*/
function getControlReferenceLetter() {

    if (letters.length === 0) {
        return null;
    }

    if (selectedIds.size === 0) {
        return letters[0];
    }

    return letters.find(letter =>
        selectedIds.has(letter.id)
    ) || letters[0];
}


function updateSelectionVisuals() {

    letters.forEach(letter => {

        letter.element.classList.toggle(
            "selected",
            selectedIds.has(letter.id)
        );
    });
}


/* ============================================================
   ENABLE / DISABLE RANDOM SETTINGS
============================================================ */

function isSettingEnabled(settingName) {

    const checkbox =
        document.querySelector(
            `.setting-enabled[data-setting="${settingName}"]`
        );

    return checkbox
        ? checkbox.checked
        : true;
}


function updateSettingRowState(settingName) {

    const checkbox =
        document.querySelector(
            `.setting-enabled[data-setting="${settingName}"]`
        );

    const row =
        document.querySelector(
            `.setting-row[data-row-setting="${settingName}"]`
        );

    if (!checkbox || !row) {
        return;
    }

    row.classList.toggle(
        "disabled",
        !checkbox.checked
    );
}


document.querySelectorAll(".setting-enabled")
    .forEach(checkbox => {

        checkbox.addEventListener("change", () => {
            updateSettingRowState(checkbox.dataset.setting);
        });

        updateSettingRowState(
            checkbox.dataset.setting
        );
    });


/* ============================================================
   RANGE
============================================================ */

function randomNumber(min, max, step) {

    const value =
        min + Math.random() * (max - min);

    const decimals =
        step < 1 ? 2 : 0;

    return Number(
        value.toFixed(decimals)
    );
}


/* ============================================================
   INDIVIDUAL RANDOM SETTING
============================================================ */

function randomizeSetting(settingName) {

    const before = beginHistoryTransaction();

    /*
        Disabled settings do nothing.
    */
    if (!isSettingEnabled(settingName)) {
        return;
    }

    const targets =
        getTargetLetters();

    if (targets.length === 0) {
        return;
    }


    /*
        COLOR
 
        Every target receives its OWN random color.
 
        The color picker is no longer used as the color that
        gets applied. It remains available as the UI color
        reference if desired.
    */
    if (settingName === "color") {

        targets.forEach(letter => {

            letter.settings.color =
                randomHexColor();
        });

    }

    /*
        NUMERIC SETTING
    */
    else {

        const config =
            SETTING_CONFIG[settingName];

        const range =
            getRandomRange(settingName);

        targets.forEach(letter => {

            letter.settings[settingName] =
                randomNumber(
                    range.min,
                    range.max,
                    config.step
                );
        });
    }


    applyAllLetterStyles();

    updateControlPanel();

    if (before) {
        commitHistoryTransaction(
            before,
            `Randomized ${settingLabel(settingName)} for ${selectionDescription(targets)}`
        );
    }
}


/* ============================================================
   RANDOMIZE ALL ENABLED SETTINGS
============================================================ */

function randomizeAll() {

    const before = beginHistoryTransaction();
    const targets =
        getTargetLetters();

    if (targets.length === 0) {
        return;
    }


    Object.keys(SETTING_CONFIG)
        .forEach(settingName => {

            /*
                Disabled settings are completely ignored.
            */
            if (!isSettingEnabled(settingName)) {
                return;
            }


            if (settingName === "color") {

                /*
                    Different random color for every letter.
                */
                targets.forEach(letter => {

                    letter.settings.color =
                        randomHexColor();
                });

                return;
            }


            const config =
                SETTING_CONFIG[settingName];

            const range =
                getRandomRange(settingName);


            targets.forEach(letter => {

                letter.settings[settingName] =
                    randomNumber(
                        range.min,
                        range.max,
                        config.step
                    );
            });

        });


    applyAllLetterStyles();

    updateControlPanel();

    if (before) {
        commitHistoryTransaction(
            before,
            `Randomized all enabled settings for ${selectionDescription(targets)}`
        );
    }
}


/* ============================================================
   RESET INDIVIDUAL SETTING
============================================================ */

function resetSetting(settingName) {

    const before = beginHistoryTransaction();
    const targets =
        getTargetLetters();

    targets.forEach(letter => {

        letter.settings[settingName] =
            DEFAULT_SETTINGS[settingName];
    });

    applyAllLetterStyles();

    updateControlPanel();

    if (before) {
        commitHistoryTransaction(
            before,
            `Reset ${settingLabel(settingName)} for ${selectionDescription(targets)}`
        );
    }
}


/* ============================================================
   RESET ALL
============================================================ */

function resetAllSettings() {

    const before = beginHistoryTransaction();
    const targets = getTargetLetters();

    if (targets.length === 0) return;

    targets.forEach(letter => {
        letter.settings = {
            ...DEFAULT_SETTINGS
        };
    });

    applyAllLetterStyles();
    updateControlPanel();

    if (before) {
        commitHistoryTransaction(
            before,
            `Reset all transformations for ${selectionDescription(targets)}`
        );
    }
}


/* ============================================================
   CSS
============================================================ */

function applyLetterStyle(letter) {

    const s = letter.settings;

    letter.element.style.transform = [
        `scaleX(${s.scaleX})`,
        `scaleY(${s.scaleY})`,
        `translateX(${s.translateX}px)`,
        `translateY(${s.translateY}px)`
    ].join(" ");

    letter.element.style.color =
        s.color;

    /*
        Each character is its own span, so selection-specific letter
        spacing is represented as spacing after that character.
    */
    letter.element.style.marginRight =
        `${s.letterSpacing ?? 0}px`;
}


function applyAllLetterStyles() {

    letters.forEach(letter => {

        applyLetterStyle(letter);
    });
}


/* ============================================================
   GENERAL PARENT SETTINGS
============================================================ */

function updateParentStyles() {

    letterContainer.style.fontSize =
        `${fontSizeInput.value || "64"}px`;

    letterContainer.style.fontFamily =
        fontFamilyInput.value ||
        "Arial, Helvetica, sans-serif";
}


function addNumberUnitLabel(input, unit) {
    if (!input || !unit || !input.parentElement) return;

    const wrapper = input.parentElement;
    if (wrapper.querySelector(`[data-number-unit="${unit}"]`)) return;

    const unitLabel = document.createElement("span");
    unitLabel.className = "number-unit";
    unitLabel.dataset.numberUnit = unit;
    unitLabel.textContent = unit;

    input.insertAdjacentElement("afterend", unitLabel);
}


function setupParentNumberInput(input, propertyName, defaultValue, unit) {
    if (!input) return;

    input.type = "number";

    if (propertyName === "font size") {
        input.min = "1";
        input.max = "1000";
        input.step = "1";
    }

    input.value =
        input.value !== ""
            ? input.value
            : defaultValue;

    input.classList.add("drag-number");
    addNumberUnitLabel(input, unit);
    enableDragNumberInput(input);

    let historySnapshot = null;
    let startValue = input.value;

    const begin = () => {
        if (!historySnapshot) {
            historySnapshot = beginHistoryTransaction();
            startValue = input.value;
        }
    };

    const commit = () => {
        if (!historySnapshot) return;

        const before = historySnapshot;
        historySnapshot = null;

        commitHistoryTransaction(
            before,
            `Changed ${propertyName} from ${startValue}${unit} to ${input.value}${unit}`
        );
    };

    input.addEventListener("focus", begin);
    input.addEventListener("mousedown", begin);
    input.addEventListener("input", updateParentStyles);
    input.addEventListener("change", commit);
    input.addEventListener("blur", commit);
}


setupParentNumberInput(
    fontSizeInput,
    "font size",
    "64",
    "px"
);

function setupFontFamilySelect() {
    if (!fontFamilyInput) return;

    const currentValue =
        fontFamilyInput.value ||
        "Helvetica";

    const select =
        document.createElement("select");

    select.id = "fontFamily";
    select.name = "fontFamily";
    select.className = fontFamilyInput.className;

    const fonts = [
        ["Helvetica", "Helvetica, Arial, sans-serif"],
        ["Arial", "Arial, Helvetica, sans-serif"],
        ["Times New Roman", "Times New Roman, Times, serif"],
        ["Georgia", "Georgia, serif"],
        ["Verdana", "Verdana, Geneva, sans-serif"],
        ["Tahoma", "Tahoma, Geneva, sans-serif"],
        ["Trebuchet MS", "Trebuchet MS, Arial, sans-serif"],
        ["Courier New", "Courier New, Courier, monospace"],
        ["Lucida Console", "Lucida Console, Monaco, monospace"],
        ["Impact", "Impact, Haettenschweiler, sans-serif"],
        ["Comic Sans MS", "Comic Sans MS, cursive"],
        ["Palatino", "Palatino Linotype, Book Antiqua, Palatino, serif"],
        ["Garamond", "Garamond, serif"],
        ["Baskerville", "Baskerville, serif"],
        ["Century Gothic", "Century Gothic, sans-serif"],
        ["Arial Black", "Arial Black, Gadget, sans-serif"],
        ["system-ui", "system-ui, sans-serif"],
        ["serif", "serif"],
        ["sans-serif", "sans-serif"],
        ["monospace", "monospace"]
    ];

    fonts.forEach(([label, value]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        option.style.fontFamily = value;
        select.appendChild(option);
    });

    const matchingOption =
        Array.from(select.options).find(
            option => option.value === currentValue
        );

    if (matchingOption) {
        select.value = currentValue;
    } else {
        const customOption = document.createElement("option");
        customOption.value = currentValue;
        customOption.textContent = currentValue;
        customOption.style.fontFamily = currentValue;
        select.appendChild(customOption);
        select.value = currentValue;
    }

    fontFamilyInput.replaceWith(select);
    fontFamilyInput = select;
}

setupFontFamilySelect();

fontFamilyInput.addEventListener("focus", () => {
    fontFamilyHistorySnapshot = beginHistoryTransaction();
});

fontFamilyInput.addEventListener("change", () => {
    const before = fontFamilyHistorySnapshot;
    fontFamilyHistorySnapshot = null;
    updateParentStyles();

    if (before) {
        commitHistoryTransaction(
            before,
            `Changed font family to ${fontFamilyInput.value || "Arial, Helvetica, sans-serif"}`
        );
    }
});


/* ============================================================
   CONTROL PANEL
============================================================ */

function createControlResetButton(settingName) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "reset-setting control-reset";
    button.dataset.setting = settingName;
    button.textContent = "Reset";
    button.addEventListener("click", () => {
        resetSetting(settingName);
    });
    return button;
}


function updateControlPanel() {

    controlList.innerHTML = "";

    const referenceLetter =
        getControlReferenceLetter();


    /*
        Selection information
    */

    if (letters.length === 0) {

        selectionInfo.innerHTML =
            "No letters.";

        return;
    }


    if (selectedIds.size === 0) {

        selectionInfo.innerHTML =
            `<strong>No visual selection</strong>
             — controls affect all letters`;

    } else {

        const selected =
            letters.filter(letter =>
                selectedIds.has(letter.id)
            );

        const chars =
            selected
                .map(letter => letter.character)
                .join("");

        selectionInfo.innerHTML =
            `<strong>${escapeHTML(chars)}</strong>
             — ${selected.length} selected`;
    }


    if (!referenceLetter) {
        return;
    }


    /*
        Numeric settings

        These are draggable number inputs rather than sliders.
        The same control changes every effective target in the
        current selection.
    */

    [
        "scaleX",
        "scaleY",
        "translateX",
        "translateY"
    ].forEach(settingName => {

        const config =
            SETTING_CONFIG[settingName];

        const row =
            document.createElement("div");

        row.className =
            "control-row";

        const name =
            document.createElement("div");

        name.className =
            "control-name";

        name.textContent =
            config.label;

        const numberInput =
            document.createElement("input");

        numberInput.type =
            "number";

        numberInput.className =
            "control-number drag-number";

        numberInput.min =
            String(config.min);

        numberInput.max =
            String(config.max);

        numberInput.step =
            String(config.step);

        numberInput.value =
            referenceLetter.settings[settingName];

        if (config.unit) {
            addNumberUnitLabel(
                numberInput,
                config.unit
            );
        }

        enableDragNumberInput(
            numberInput
        );

        const resetButton =
            createControlResetButton(
                settingName
            );

        let numberHistorySnapshot =
            null;

        let numberStartValue =
            Number(numberInput.value);

        const beginNumberHistory = () => {

            if (!numberHistorySnapshot) {

                numberHistorySnapshot =
                    beginHistoryTransaction();

                numberStartValue =
                    Number(numberInput.value);
            }
        };

        numberInput.addEventListener(
            "pointerdown",
            beginNumberHistory
        );

        numberInput.addEventListener(
            "focus",
            beginNumberHistory
        );

        numberInput.addEventListener(
            "input",
            () => {

                const newValue =
                    Number(numberInput.value);

                if (!Number.isFinite(newValue)) {
                    return;
                }

                getTargetLetters().forEach(letter => {

                    letter.settings[settingName] =
                        newValue;
                });

                applyAllLetterStyles();
            }
        );

        const commitNumberHistory = () => {

            if (!numberHistorySnapshot) {
                return;
            }

            const before =
                numberHistorySnapshot;

            numberHistorySnapshot =
                null;

            const targets =
                getTargetLetters();

            const finalValue =
                Number(numberInput.value);

            if (!Number.isFinite(finalValue)) {
                return;
            }

            commitHistoryTransaction(
                before,
                `Changed ${settingLabel(settingName)} of ${selectionDescription(targets)} from ${formatValue(numberStartValue, config.unit)} to ${formatValue(finalValue, config.unit)}`
            );
        };

        numberInput.addEventListener(
            "change",
            commitNumberHistory
        );

        numberInput.addEventListener(
            "blur",
            commitNumberHistory
        );

        row.appendChild(name);
        row.appendChild(numberInput);
        row.appendChild(resetButton);

        controlList.appendChild(row);
    });


    /*
        COLOR

        Color belongs to the selection and is stored
        on each letter.
    */

    const colorRow =
        document.createElement("div");

    colorRow.className =
        "control-row";


    const colorName =
        document.createElement("div");

    colorName.className =
        "control-name";

    colorName.textContent =
        "color";


    const colorInput =
        document.createElement("input");

    colorInput.type =
        "color";

    colorInput.className =
        "color-control";

    colorInput.value =
        normalizeColor(
            referenceLetter.settings.color
        );


    const colorValue =
        document.createElement("div");

    colorValue.className =
        "control-value";

    colorValue.textContent =
        referenceLetter.settings.color;


    let colorHistorySnapshot =
        null;

    let colorStartValue =
        referenceLetter.settings.color;


    const beginColorHistory = () => {

        if (!colorHistorySnapshot) {

            colorHistorySnapshot =
                beginHistoryTransaction();

            colorStartValue =
                referenceLetter.settings.color;
        }
    };


    colorInput.addEventListener(
        "pointerdown",
        beginColorHistory
    );

    colorInput.addEventListener(
        "focus",
        beginColorHistory
    );


    colorInput.addEventListener(
        "input",
        () => {

            const newColor =
                colorInput.value;

            getTargetLetters().forEach(letter => {

                letter.settings.color =
                    newColor;
            });

            applyAllLetterStyles();

            colorValue.textContent =
                newColor;
        }
    );


    const commitColorHistory = () => {

        if (!colorHistorySnapshot) {
            return;
        }

        const before =
            colorHistorySnapshot;

        colorHistorySnapshot =
            null;

        const targetDescription =
            selectionDescription(
                getTargetLetters()
            );

        const finalColor =
            colorInput.value;

        commitHistoryTransaction(
            before,
            `Changed color of ${targetDescription} from ${colorStartValue} to ${finalColor}`
        );
    };


    colorInput.addEventListener(
        "change",
        commitColorHistory
    );

    colorInput.addEventListener(
        "blur",
        commitColorHistory
    );


    const colorResetButton =
        createControlResetButton(
            "color"
        );


    colorRow.appendChild(
        colorName
    );

    colorRow.appendChild(
        colorInput
    );

    colorRow.appendChild(
        colorValue
    );

    colorRow.appendChild(
        colorResetButton
    );


    controlList.appendChild(
        colorRow
    );


    /*
        LETTER SPACING

        Unlike the global font settings, this belongs
        to the selection and is therefore stored on each
        letter.
    */

    const letterSpacingRow =
        document.createElement("div");

    letterSpacingRow.className =
        "control-row";


    const letterSpacingName =
        document.createElement("div");

    letterSpacingName.className =
        "control-name";

    letterSpacingName.textContent =
        "letter spacing";


    const letterSpacingInputControl =
        document.createElement("input");

    letterSpacingInputControl.type =
        "number";

    letterSpacingInputControl.className =
        "control-number drag-number";

    letterSpacingInputControl.min =
        "-100";

    letterSpacingInputControl.max =
        "100";

    letterSpacingInputControl.step =
        "0.1";

    letterSpacingInputControl.value =
        referenceLetter.settings.letterSpacing ?? 0;


    addNumberUnitLabel(
        letterSpacingInputControl,
        "px"
    );

    enableDragNumberInput(
        letterSpacingInputControl
    );


    const letterSpacingResetButton =
        createControlResetButton(
            "letterSpacing"
        );


    let letterSpacingControlHistory =
        null;

    let letterSpacingStartValue =
        Number(
            letterSpacingInputControl.value
        );


    const beginLetterSpacingHistory = () => {

        if (!letterSpacingControlHistory) {

            letterSpacingControlHistory =
                beginHistoryTransaction();

            letterSpacingStartValue =
                Number(
                    letterSpacingInputControl.value
                );
        }
    };


    const applyLetterSpacing = () => {

        const newValue =
            Number(
                letterSpacingInputControl.value
            );

        if (!Number.isFinite(newValue)) {
            return;
        }

        getTargetLetters().forEach(letter => {

            letter.settings.letterSpacing =
                newValue;
        });

        applyAllLetterStyles();
    };


    const commitLetterSpacingHistory = () => {

        if (!letterSpacingControlHistory) {
            return;
        }

        const before =
            letterSpacingControlHistory;

        letterSpacingControlHistory =
            null;

        const targets =
            getTargetLetters();

        const finalValue =
            Number(
                letterSpacingInputControl.value
            );

        commitHistoryTransaction(
            before,
            `Changed letter spacing of ${selectionDescription(targets)} from ${letterSpacingStartValue}px to ${finalValue}px`
        );
    };


    letterSpacingInputControl.addEventListener(
        "pointerdown",
        beginLetterSpacingHistory
    );

    letterSpacingInputControl.addEventListener(
        "focus",
        beginLetterSpacingHistory
    );

    letterSpacingInputControl.addEventListener(
        "input",
        applyLetterSpacing
    );

    letterSpacingInputControl.addEventListener(
        "change",
        commitLetterSpacingHistory
    );

    letterSpacingInputControl.addEventListener(
        "blur",
        commitLetterSpacingHistory
    );


    letterSpacingRow.appendChild(
        letterSpacingName
    );

    letterSpacingRow.appendChild(
        letterSpacingInputControl
    );

    letterSpacingRow.appendChild(
        letterSpacingResetButton
    );


    controlList.appendChild(
        letterSpacingRow
    );
}

/* ============================================================
   DRAG NUMBER INPUTS
============================================================ */

function getDecimalPlaces(value) {

    const stringValue =
        String(value);

    if (!stringValue.includes(".")) {
        return 0;
    }

    return stringValue.split(".")[1].length;
}


function enableDragNumberInput(input) {

    let startY = 0;
    let startValue = 0;
    let dragging = false;

    input.classList.add("drag-number");

    input.addEventListener("mousedown", event => {

        /*
            Ignore the native number arrows.
        */
        if (
            event.offsetX >
            input.clientWidth - 25
        ) {
            return;
        }

        startY =
            event.clientY;

        startValue =
            Number(input.value);

        dragging = false;


        const onMouseMove = moveEvent => {

            const distance =
                startY -
                moveEvent.clientY;

            const step =
                Number(input.step) || 1;


            /*
                Pixels dragged = amount changed.
            */
            const change =
                Math.round(distance) * step;


            /*
                Calculate the new value.
            */
            const rawValue =
                startValue + change;


            /*
                Round according to the step.
                
                step 0.1  -> 1 decimal
                step 0.01 -> 2 decimals
                step 1     -> 0 decimals
            */
            const decimals =
                getDecimalPlaces(step);


            const newValue =
                Number(
                    rawValue.toFixed(decimals)
                );


            input.value =
                newValue;


            input.dispatchEvent(
                new Event("input", {
                    bubbles: true
                })
            );


            dragging = true;
        };


        const onMouseUp = () => {

            document.removeEventListener(
                "mousemove",
                onMouseMove
            );

            document.removeEventListener(
                "mouseup",
                onMouseUp
            );


            if (dragging) {
                input.blur();
            }
        };


        document.addEventListener(
            "mousemove",
            onMouseMove
        );

        document.addEventListener(
            "mouseup",
            onMouseUp
        );
    });
}


/*
    RANDOM RANGE CONTROLS

    The Control Panel transformation controls are draggable number
    inputs, but the min/max range controls remain in the Random
    Settings section. Those range controls define the inherited
    randomization bounds for each setting.
*/
function getRandomRange(settingName) {
    const row =
        document.querySelector(
            `.setting-row[data-row-setting="${settingName}"]`
        );

    const minInput =
        row?.querySelector(".range-min");

    const maxInput =
        row?.querySelector(".range-max");

    const config = SETTING_CONFIG[settingName];

    return {
        min: minInput
            ? Number(minInput.value)
            : Number(config.min),
        max: maxInput
            ? Number(maxInput.value)
            : Number(config.max)
    };
}

function setupRandomRangeControls() {
    Object.keys(SETTING_CONFIG).forEach(settingName => {
        const row =
            document.querySelector(
                `.setting-row[data-row-setting="${settingName}"]`
            );

        if (!row || settingName === "color") return;

        const minInput =
            row.querySelector(".range-min");

        const maxInput =
            row.querySelector(".range-max");

        if (!minInput || !maxInput) return;

        const config = SETTING_CONFIG[settingName];

        minInput.type = "number";
        maxInput.type = "number";
        minInput.step = String(config.step);
        maxInput.step = String(config.step);

        if (minInput.value === "") {
            minInput.value = String(config.min);
        }

        if (maxInput.value === "") {
            maxInput.value = String(config.max);
        }

        enableDragNumberInput(minInput);
        enableDragNumberInput(maxInput);
    });
}

setupRandomRangeControls();

/* ============================================================
   BUTTONS
============================================================ */

generateButton.addEventListener(
    "click",
    generateText
);


selectAllButton.addEventListener(
    "click",
    selectAll
);


deselectButton.addEventListener(
    "click",
    deselectAll
);


randomAllButton.addEventListener(
    "click",
    randomizeAll
);


resetAllButton.addEventListener(
    "click",
    resetAllSettings
);


if (undoButton) {
    undoButton.addEventListener("click", undo);
}

if (redoButton) {
    redoButton.addEventListener("click", redo);
}

document.addEventListener("keydown", event => {
    const modifier = event.ctrlKey || event.metaKey;
    if (!modifier) return;

    if (event.key.toLowerCase() === "z") {
        event.preventDefault();

        if (event.shiftKey) {
            redo();
        } else {
            undo();
        }
        return;
    }

    if (event.key.toLowerCase() === "y" && !event.metaKey) {
        event.preventDefault();
        redo();
    }
});


/*
    Individual Apply buttons
*/

document.querySelectorAll(
    ".apply-setting"
).forEach(button => {

    button.addEventListener("click", () => {

        randomizeSetting(
            button.dataset.setting
        );
    });
});


/*
    Individual reset buttons now live in the Control Panel.
    Remove the old reset buttons from Random Settings.
    resetAllButton remains unchanged.
*/
document.querySelectorAll(".setting-row .reset-setting").forEach(button => {
    button.remove();
});


/* ============================================================
   RANDOM COLOR
============================================================ */

function randomHexColor() {

    const value =
        Math.floor(
            Math.random() * 0xffffff
        );

    return "#" +
        value
            .toString(16)
            .padStart(6, "0");
}


/* ============================================================
   EXPORT
============================================================ */

function exportTXT() {

    if (letters.length === 0) {
        logChange("Export requested, but there was nothing to export.");
        return;
    }


    /*
        Clone the generated letter container so the editor itself
        is never modified by the export process.
    */
    const clone =
        letterContainer.cloneNode(true);


    /*
        Remove editor-only information.
    */
    clone.querySelectorAll(".letter").forEach(span => {

        span.classList.remove("selected");
        span.removeAttribute("data-id");

    });


    /*
        Format the generated markup with indentation
        and line breaks.
    */
    const markup =
        formatHTML(clone);


    /*
        Create a plain-text file.
    */
    const blob =
        new Blob(
            [markup],
            {
                type: "text/plain;charset=utf-8"
            }
        );


    /*
        Create a temporary download URL.
    */
    const url =
        URL.createObjectURL(blob);


    /*
        Create the download link.
    */
    const link =
        document.createElement("a");

    link.href =
        url;

    link.download =
        "letter-transformation.txt";

    link.style.display =
        "none";


    /*
        Trigger the download.
    */
    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);


    /*
        Clean up.
    */
    setTimeout(() => {

        URL.revokeObjectURL(url);

    }, 100);


    logChange("Exported TXT file successfully.");
}


/* ============================================================
   FORMAT HTML
============================================================ */

function formatHTML(element, level = 0) {

    const indent =
        "    ".repeat(level);

    const childIndent =
        "    ".repeat(level + 1);

    let result =
        indent +
        `<${element.tagName.toLowerCase()}`;


    /*
        Add attributes.
    */
    Array.from(element.attributes).forEach(attribute => {

        result +=
            ` ${attribute.name}="${attribute.value}"`;

    });


    /*
        Find child nodes.
    */
    const children =
        Array.from(element.childNodes);


    /*
        No children.
    */
    if (children.length === 0) {

        result +=
            `></${element.tagName.toLowerCase()}>`;

        return result;
    }


    result += ">";


    /*
        Format child elements.
    */
    children.forEach(child => {

        if (child.nodeType === Node.ELEMENT_NODE) {

            result +=
                "\n" +
                formatHTML(
                    child,
                    level + 1
                );

        }

        else if (
            child.nodeType === Node.TEXT_NODE &&
            child.textContent.trim() !== ""
        ) {

            result +=
                child.textContent.trim();

        }

    });


    /*
        Close the element.
    */
    if (
        children.some(
            child =>
                child.nodeType === Node.ELEMENT_NODE
        )
    ) {

        result +=
            "\n" +
            indent;

    }


    result +=
        `</${element.tagName.toLowerCase()}>`;


    return result;
}


/*
    Connect the Export TXT button.
*/
exportButton.addEventListener(
    "click",
    exportTXT
);

/* ============================================================
   UTILITY
============================================================ */

function formatValue(value, unit) {

    return `${value}${unit}`;
}


function normalizeColor(color) {

    if (
        !color ||
        !color.startsWith("#")
    ) {
        return "#000000";
    }

    return color;
}


function escapeHTML(value) {

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}



/* Unit labels for draggable number controls. */


/* ============================================================
   INITIALIZE
============================================================ */

generateText();
initializing = false;
updateHistoryButtons();
renderChangeLog();


/* ============================================================
   RESIZABLE GENERATOR WINDOW
============================================================ */

const generatorWindow =
    document.getElementById("window");

const resizeHandle =
    document.querySelector(".resize-handle");


function setupWindowResize() {

    if (!generatorWindow || !resizeHandle) {
        return;
    }

    const MIN_HEIGHT = 150;

    let isResizing = false;
    let startY = 0;
    let startHeight = 0;


    /*
        Keep the resize handle positioned directly below
        the generator window.
    */
    function updateResizeHandle() {

        const rect =
            generatorWindow.getBoundingClientRect();

        resizeHandle.style.left =
            `${rect.left}px`;

        resizeHandle.style.top =
            `${rect.bottom - 4}px`;

        resizeHandle.style.width =
            `${rect.width}px`;
    }


    /*
        Start resizing.
    */
    resizeHandle.addEventListener(
        "pointerdown",
        event => {

            if (event.button !== 0) {
                return;
            }

            event.preventDefault();

            isResizing = true;

            startY =
                event.clientY;

            startHeight =
                generatorWindow.getBoundingClientRect().height;

            resizeHandle.classList.add(
                "is-resizing"
            );

            document.body.classList.add(
                "resizing-generator-window"
            );

            /*
                Pointer capture keeps the drag alive even if
                the pointer leaves the resize handle.
            */
            resizeHandle.setPointerCapture?.(
                event.pointerId
            );
        }
    );


    /*
        Resize while dragging.
    */
    document.addEventListener(
        "pointermove",
        event => {

            if (!isResizing) {
                return;
            }

            event.preventDefault();

            const distance =
                event.clientY - startY;

            let newHeight =
                startHeight + distance;


            /*
                Minimum height.
            */
            newHeight =
                Math.max(
                    MIN_HEIGHT,
                    newHeight
                );


            generatorWindow.style.height =
                `${newHeight}px`;

            updateResizeHandle();
        },
        {
            passive: false
        }
    );


    /*
        Stop resizing.
    */
    function stopResize() {

        if (!isResizing) {
            return;
        }

        isResizing = false;

        resizeHandle.classList.remove(
            "is-resizing"
        );

        document.body.classList.remove(
            "resizing-generator-window"
        );

        updateResizeHandle();
    }


    document.addEventListener(
        "pointerup",
        stopResize
    );

    document.addEventListener(
        "pointercancel",
        stopResize
    );


    /*
        Keep the handle aligned when the browser window
        is resized or the page is scrolled.
    */
    window.addEventListener(
        "resize",
        updateResizeHandle
    );

    window.addEventListener(
        "scroll",
        updateResizeHandle,
        true
    );


    /*
        Initial position.
    */
    updateResizeHandle();
}


setupWindowResize();