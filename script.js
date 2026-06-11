"use strict";

const STORAGE_KEY = "passwordHistory";
const HISTORY_LIMIT = 5;

const CHARACTER_GROUPS = {
    lowercase: "abcdefghijklmnopqrstuvwxyz",
    uppercase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    numbers: "0123456789",
    symbols: "!@#$%&*()-_=+[]{}<>?/"
};

const elements = {
    form: document.getElementById("passwordForm"),
    passwordName: document.getElementById("passwordName"),
    nameField: document.querySelector(".field-card"),
    nameError: document.getElementById("nameError"),
    generatedPassword: document.getElementById("generatedPassword"),
    togglePassword: document.getElementById("togglePassword"),
    copyPassword: document.getElementById("copyPassword"),
    passwordLength: document.getElementById("passwordLength"),
    lengthValue: document.getElementById("lengthValue"),
    strengthBar: document.querySelector(".strength-bar"),
    strengthProgress: document.getElementById("strengthProgress"),
    strengthText: document.getElementById("strengthText"),
    includeLowercase: document.getElementById("includeLowercase"),
    includeUppercase: document.getElementById("includeUppercase"),
    includeNumbers: document.getElementById("includeNumbers"),
    includeSymbols: document.getElementById("includeSymbols"),
    optionsError: document.getElementById("optionsError"),
    historyList: document.getElementById("historyList"),
    historyEmpty: document.getElementById("historyEmpty"),
    deleteSelected: document.getElementById("deleteSelected"),
    selectionStatus: document.getElementById("selectionStatus"),
    toast: document.getElementById("toast"),
    toastIcon: document.getElementById("toastIcon"),
    toastMessage: document.getElementById("toastMessage"),
    lockIcon: document.getElementById("lockIcon")
};

let passwordHistory = [];
let selectedHistoryIds = new Set();
let toastTimer;

function createId() {
    if (typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }

    return `${Date.now()}-${randomIndex(1_000_000)}`;
}

function randomIndex(max) {
    if (max <= 0) {
        return 0;
    }

    if (crypto?.getRandomValues) {
        const values = new Uint32Array(1);
        const limit = Math.floor(0x100000000 / max) * max;
        let value;

        do {
            crypto.getRandomValues(values);
            value = values[0];
        } while (value >= limit);

        return value % max;
    }

    return Math.floor(Math.random() * max);
}

function randomCharacter(characters) {
    return characters[randomIndex(characters.length)];
}

function shufflePassword(password) {
    const characters = [...password];

    for (let index = characters.length - 1; index > 0; index -= 1) {
        const target = randomIndex(index + 1);
        [characters[index], characters[target]] = [
            characters[target],
            characters[index]
        ];
    }

    return characters.join("");
}

function getSelectedGroups() {
    const groups = [];

    if (elements.includeLowercase.checked) {
        groups.push(CHARACTER_GROUPS.lowercase);
    }

    if (elements.includeUppercase.checked) {
        groups.push(CHARACTER_GROUPS.uppercase);
    }

    if (elements.includeNumbers.checked) {
        groups.push(CHARACTER_GROUPS.numbers);
    }

    if (elements.includeSymbols.checked) {
        groups.push(CHARACTER_GROUPS.symbols);
    }

    return groups;
}

function buildPassword(length, groups) {
    const availableCharacters = groups.join("");
    let password = groups.map(randomCharacter).join("");

    while (password.length < length) {
        password += randomCharacter(availableCharacters);
    }

    return shufflePassword(password);
}

function validateForm() {
    const name = elements.passwordName.value.trim();
    const groups = getSelectedGroups();

    elements.nameField.classList.toggle("invalid", name.length === 0);
    elements.nameError.textContent =
        name.length === 0 ? "Informe onde esta senha será usada." : "";
    elements.optionsError.textContent =
        groups.length === 0 ? "Selecione pelo menos um tipo de caractere." : "";

    if (name.length === 0) {
        elements.passwordName.focus();
        return null;
    }

    if (groups.length === 0) {
        elements.includeLowercase.focus();
        return null;
    }

    return { name, groups };
}

function handleGenerate(event) {
    event.preventDefault();

    const validData = validateForm();

    if (!validData) {
        showToast("Revise os campos destacados.", "error");
        return;
    }

    const length = Number(elements.passwordLength.value);
    const password = buildPassword(length, validData.groups);

    elements.generatedPassword.value = password;
    elements.generatedPassword.type = "password";
    elements.togglePassword.disabled = false;
    elements.copyPassword.disabled = false;
    updateToggleButton(false);
    updateStrength(password);
    animateLock();
    addHistoryItem(validData.name, password);
    showToast("Senha gerada e adicionada ao histórico.");
}

function updateToggleButton(isVisible) {
    const label = isVisible ? "Ocultar senha" : "Mostrar senha";
    const iconClass = isVisible ? "fa-eye-slash" : "fa-eye";

    elements.togglePassword.title = label;
    elements.togglePassword.setAttribute("aria-label", label);
    elements.togglePassword.innerHTML =
        `<i class="fa-solid ${iconClass}" aria-hidden="true"></i>`;
}

function togglePasswordVisibility() {
    const isVisible = elements.generatedPassword.type === "text";
    elements.generatedPassword.type = isVisible ? "password" : "text";
    updateToggleButton(!isVisible);
}

async function copyGeneratedPassword() {
    const password = elements.generatedPassword.value;

    if (!password) {
        return;
    }

    try {
        await navigator.clipboard.writeText(password);
        showToast("Senha copiada para a área de transferência.");
    } catch {
        elements.generatedPassword.select();
        const copied = document.execCommand("copy");
        window.getSelection()?.removeAllRanges();

        showToast(
            copied
                ? "Senha copiada para a área de transferência."
                : "Não foi possível copiar a senha.",
            copied ? "success" : "error"
        );
    }
}

function getStrength(password) {
    let score = 0;

    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    if (/[a-z]/.test(password)) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^a-zA-Z0-9]/.test(password)) score += 1;

    if (score <= 2) {
        return { value: 20, label: "Muito fraca", color: "#ff4d4d" };
    }

    if (score === 3) {
        return { value: 40, label: "Fraca", color: "#ff7a4d" };
    }

    if (score === 4) {
        return { value: 60, label: "Média", color: "#ffb347" };
    }

    if (score === 5) {
        return { value: 80, label: "Forte", color: "#b8e75a" };
    }

    return { value: 100, label: "Muito forte", color: "#6cff92" };
}

function updateStrength(password) {
    const strength = getStrength(password);

    elements.strengthProgress.style.width = `${strength.value}%`;
    elements.strengthProgress.style.backgroundColor = strength.color;
    elements.strengthText.textContent = strength.label;
    elements.strengthBar.setAttribute("aria-valuenow", strength.value);
}

function animateLock() {
    elements.lockIcon.classList.remove("fa-lock");
    elements.lockIcon.classList.add("fa-lock-open", "animate");

    window.setTimeout(() => {
        elements.lockIcon.classList.remove("fa-lock-open", "animate");
        elements.lockIcon.classList.add("fa-lock");
    }, 500);
}

function showToast(message, type = "success") {
    window.clearTimeout(toastTimer);

    const isError = type === "error";
    elements.toastMessage.textContent = message;
    elements.toast.classList.toggle("error", isError);
    elements.toastIcon.className =
        `fa-solid ${isError ? "fa-circle-exclamation" : "fa-check"}`;
    elements.toast.classList.add("active");

    toastTimer = window.setTimeout(() => {
        elements.toast.classList.remove("active");
    }, 2400);
}

function normalizeHistoryItem(item) {
    if (typeof item === "string") {
        return {
            id: createId(),
            name: "Senha sem nome",
            password: item
        };
    }

    if (
        item &&
        typeof item.name === "string" &&
        typeof item.password === "string"
    ) {
        return {
            id: typeof item.id === "string" ? item.id : createId(),
            name: item.name.trim() || "Senha sem nome",
            password: item.password
        };
    }

    return null;
}

function loadHistory() {
    try {
        const savedHistory = JSON.parse(
            localStorage.getItem(STORAGE_KEY) || "[]"
        );

        passwordHistory = Array.isArray(savedHistory)
            ? savedHistory
                .map(normalizeHistoryItem)
                .filter(Boolean)
                .slice(0, HISTORY_LIMIT)
            : [];
    } catch {
        passwordHistory = [];
    }

    saveHistory();
    renderHistory();
}

function saveHistory() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(passwordHistory));
    } catch {
        showToast("Não foi possível salvar o histórico.", "error");
    }
}

function addHistoryItem(name, password) {
    passwordHistory.unshift({
        id: createId(),
        name,
        password
    });

    passwordHistory = passwordHistory.slice(0, HISTORY_LIMIT);
    selectedHistoryIds.clear();
    saveHistory();
    renderHistory();
}

function createHistoryElement(item) {
    const listItem = document.createElement("li");
    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    const content = document.createElement("div");
    const name = document.createElement("strong");
    const password = document.createElement("span");

    label.className = "history-option";
    content.className = "history-content";
    name.className = "history-name";
    password.className = "history-password";

    checkbox.type = "checkbox";
    checkbox.value = item.id;
    checkbox.checked = selectedHistoryIds.has(item.id);
    checkbox.setAttribute("aria-label", `Selecionar senha ${item.name}`);

    name.textContent = item.name;
    password.textContent = item.password;

    checkbox.addEventListener("change", () => {
        if (checkbox.checked) {
            selectedHistoryIds.add(item.id);
        } else {
            selectedHistoryIds.delete(item.id);
        }

        listItem.classList.toggle("selected", checkbox.checked);
        updateSelectionState();
    });

    content.append(name, password);
    label.append(checkbox, content);
    listItem.append(label);
    listItem.classList.toggle("selected", checkbox.checked);

    return listItem;
}

function renderHistory() {
    const fragment = document.createDocumentFragment();

    elements.historyList.replaceChildren();

    passwordHistory.forEach((item) => {
        fragment.append(createHistoryElement(item));
    });

    elements.historyList.append(fragment);
    elements.historyEmpty.hidden = passwordHistory.length > 0;
    updateSelectionState();
}

function updateSelectionState() {
    const selectedCount = selectedHistoryIds.size;

    elements.deleteSelected.disabled = selectedCount === 0;
    elements.selectionStatus.textContent =
        selectedCount === 0
            ? "Nenhuma selecionada"
            : `${selectedCount} ${selectedCount === 1 ? "selecionada" : "selecionadas"}`;
}

function deleteSelectedHistory() {
    const selectedCount = selectedHistoryIds.size;

    if (selectedCount === 0) {
        return;
    }

    passwordHistory = passwordHistory.filter(
        (item) => !selectedHistoryIds.has(item.id)
    );

    selectedHistoryIds.clear();
    saveHistory();
    renderHistory();
    showToast(
        `${selectedCount} ${selectedCount === 1 ? "senha excluída" : "senhas excluídas"}.`
    );
}

function clearNameError() {
    if (elements.passwordName.value.trim()) {
        elements.nameField.classList.remove("invalid");
        elements.nameError.textContent = "";
    }
}

function clearOptionsError() {
    if (getSelectedGroups().length > 0) {
        elements.optionsError.textContent = "";
    }
}

function initialize() {
    elements.lengthValue.value = elements.passwordLength.value;
    loadHistory();

    elements.form.addEventListener("submit", handleGenerate);
    elements.passwordLength.addEventListener("input", () => {
        elements.lengthValue.value = elements.passwordLength.value;
    });
    elements.togglePassword.addEventListener(
        "click",
        togglePasswordVisibility
    );
    elements.copyPassword.addEventListener(
        "click",
        copyGeneratedPassword
    );
    elements.deleteSelected.addEventListener(
        "click",
        deleteSelectedHistory
    );
    elements.passwordName.addEventListener("input", clearNameError);

    [
        elements.includeLowercase,
        elements.includeUppercase,
        elements.includeNumbers,
        elements.includeSymbols
    ].forEach((checkbox) => {
        checkbox.addEventListener("change", clearOptionsError);
    });
}

initialize();
