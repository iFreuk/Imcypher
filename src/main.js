// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function () {
    const fileInput = document.getElementById('fileInput');
    const imagePreview = document.getElementById('imagePreview');
    const statusElement = document.getElementById('status');
    const downloadBtn = document.getElementById('downloadBtn');
    const applyBtn = document.getElementById('applyBtn');
    const messageTextBoxContainer = document.querySelector(".text-input-container");
    const messageTextBoxValue = document.getElementById("userText");
    const leftCharsLabel = document.getElementById("leftChars");
    const stegSelect = document.getElementById('stegSelect');

    // Modal
    // Modal
    const helpBtn = document.getElementById("helpBtn");
    const modal = document.getElementById("helpModal");
    const span = document.getElementsByClassName("close-modal")[0];

    // Language
    let currentLang = 'en';
    let translations = {};

    // Elements to translate (id -> translation key)
    const translatableIds = {
        'mainTitle': 'title',
        'uploadDesc': 'description',
        'selectImageBtn': 'selectKey',
        'status': 'status',
        'methodLabel': 'methodLabel',
        'opt-lsb': 'methodLsb',
        'opt-append': 'methodAppend',
        'hiddenMessageLabel': 'hiddenMessageLabel',
        'userText': 'placeholder', // specialized handling for placeholder
        'downloadBtn': 'downloadBtn',
        'applyBtn': 'applyBtn',
        'helpTitle': 'helpTitle',
        'helpDesc': 'helpDesc',
        'helpInstrTitle': 'helpInstructionsTitle',
        'helpInstrText': 'helpInstructionsText',
        'helpAndroid': 'helpAndroid',
        'helpIOS': 'helpIOS',
        'helpDesktop': 'helpDesktop',
        'helpSummary': 'helpSummary'
    };

    // Load Translations
    fetch('locales/translations.json')
        .then(response => response.json())
        .then(data => {
            translations = data;
            detectLanguage();
        })
        .catch(err => {
            console.error("Could not load translations:", err);
            // Fallback: Do nothing, keep English HTML defaults
        });

    function detectLanguage() {
        const userLang = navigator.language || navigator.userLanguage;
        if (userLang.startsWith('es')) {
            currentLang = 'es';
        } else {
            currentLang = 'en';
        }
        updateLanguage(currentLang);
    }

    function updateLanguage(lang) {
        if (!translations[lang]) return;
        const t = translations[lang];

        // Update static elements
        for (const [id, key] of Object.entries(translatableIds)) {
            const element = document.getElementById(id);
            if (element) {
                if (id === 'userText') {
                    element.placeholder = t[key];
                } else if (id === 'selectImageBtn') {
                    // Start of complex buttons or HTML content
                    element.textContent = t[key];
                } else {
                    element.innerHTML = t[key];
                }
            }
        }

        // Update methods check to refresh description
        checkMethods();
    }

    function getText(key) {
        if (translations[currentLang] && translations[currentLang][key]) {
            return translations[currentLang][key];
        }
        // Fallback to English if loaded, otherwise raw key/empty
        if (translations['en'] && translations['en'][key]) {
            return translations['en'][key];
        }
        return key;
    }

    helpBtn.onclick = function () {
        modal.style.display = "block";
    }
    span.onclick = function () {
        modal.style.display = "none";
    }
    window.onclick = function (event) {
        if (event.target == modal) {
            modal.style.display = "none";
        }
    }

    let canvasContext;
    let originalImageData; // For LSB: Pixel data
    let originalFileBuffer; // For Append: Raw file bytes
    let originalFileName = "image.png";
    let originalFileType = "image/png";

    // Signature for Append Method
    const APPEND_SIGNATURE = "IMCYPHER_EOF";

    fileInput.addEventListener('change', function (event) {
        const file = event.target.files[0];

        if (file && file.type.match('image.*')) {
            statusElement.textContent = getText("processing");
            originalFileName = file.name;
            originalFileType = file.type;

            // Read as DataURL for preview
            const readerURL = new FileReader();
            readerURL.onload = function (e) {
                imagePreview.src = e.target.result;
                imagePreview.style.display = 'block';
            };
            readerURL.readAsDataURL(file);

            // Read as ArrayBuffer for Append method
            const readerBuffer = new FileReader();
            readerBuffer.onload = function (e) {
                originalFileBuffer = e.target.result;
                // We'll analyze after image loads (which triggers LSB analysis)
                // or we can analyze Append immediately, but let's wait for UI consistency.
                checkMethods();
            };
            readerBuffer.readAsArrayBuffer(file);

        } else {
            alert('Please select a valid image file.');
            imagePreview.style.display = 'none';
            statusElement.textContent = getText("status");
        }
    });

    // When image loads, LSB analysis is possible
    imagePreview.addEventListener('load', function () {
        if (!originalImageData && !originalFileBuffer) return; // Initial load or error
        analyzeLSB(imagePreview);
        checkMethods();
    });

    stegSelect.addEventListener('change', function () {
        checkMethods();
    });

    const methodDescription = document.getElementById('methodDescription');

    function checkMethods() {
        const method = stegSelect.value;
        if (method === 'lsb') {
            analyzeLSB(imagePreview);
            // Dynamic text from JSON
            if (Object.keys(translations).length > 0) {
                methodDescription.innerHTML = getText("methodLsbDesc");
            } else {
                methodDescription.innerHTML = "Hides message inside pixels (PNG only). <br><span class='warning-text' style='color:#ffab40; font-size:0.9em; cursor:pointer;'>⚠️ Breaks on WhatsApp/Socials. Click ? for help.</span>";
            }
        } else {
            analyzeAppend();
            if (Object.keys(translations).length > 0) {
                methodDescription.innerHTML = getText("methodAppendDesc");
            } else {
                methodDescription.innerHTML = "Appends message to file (Keeps JPG size). <br><span class='warning-text' style='color:#ffab40; font-size:0.9em; cursor:pointer;'>⚠️ Breaks on WhatsApp/Socials. Click ? for help.</span>";
            }
        }
    }

    // Delegate click for dynamic warning text
    methodDescription.addEventListener('click', function (e) {
        if (e.target.classList.contains('warning-text')) {
            modal.style.display = "block";
        }
    });

    downloadBtn.addEventListener('click', function (event) {
        if (!imagePreview.src || imagePreview.style.display === 'none') {
            alert("Please select an image first.");
            return;
        }

        const method = stegSelect.value;
        const textToHide = messageTextBoxValue.value;

        if (method === 'lsb') {
            const dataUrl = encodeLSB(textToHide);
            if (dataUrl) {
                downloadLink(dataUrl, 'secret-image.png');
            }
        } else {
            const blob = encodeAppend(textToHide);
            if (blob) {
                const url = URL.createObjectURL(blob);
                // Keep original extension if possible, or default to jpg/original
                let ext = originalFileName.split('.').pop();
                downloadLink(url, `secret-image.${ext}`);
            }
        }
    });

    applyBtn.addEventListener('click', function (event) {
        if (!imagePreview.src || imagePreview.style.display === 'none') {
            alert("Please select an image first.");
            return;
        }

        const method = stegSelect.value;
        const textToHide = messageTextBoxValue.value;

        if (method === 'lsb') {
            const dataUrl = encodeLSB(textToHide);
            if (dataUrl) {
                imagePreview.src = dataUrl;
                statusElement.textContent = "Preview updated (LSB)!";
            }
        } else {
            const blob = encodeAppend(textToHide);
            if (blob) {
                const url = URL.createObjectURL(blob);
                imagePreview.src = url;
                // Update our buffer to reflect the change so subsequent saves include it!
                // We need to read the blob back into array buffer
                const reader = new FileReader();
                reader.onload = function (e) {
                    originalFileBuffer = e.target.result;
                    statusElement.textContent = "Preview updated (Append)!";
                    // Re-analyze just to be sure
                    analyzeAppend();
                };
                reader.readAsArrayBuffer(blob);
            }
        }
    });

    function downloadLink(url, filename) {
        const link = document.createElement('a');
        link.download = filename;
        link.href = url;
        link.click();
        statusElement.textContent = "Image downloaded!";
    }

    // --- LSB Logic ---

    function analyzeLSB(img) {
        if (stegSelect.value !== 'lsb') return;

        statusElement.textContent = "Analyzing pixels (LSB)...";

        const canvas = document.createElement('canvas');
        canvasContext = canvas.getContext('2d');
        const width = img.naturalWidth;
        const height = img.naturalHeight;

        canvas.width = width;
        canvas.height = height;

        // Draw image to canvas
        canvasContext.drawImage(img, 0, 0, width, height);
        messageTextBoxContainer.classList.add("active");

        // Get pixel data
        originalImageData = canvasContext.getImageData(0, 0, width, height);
        const subpixels = originalImageData.data;
        const pixelCount = width * height;

        const maxMessageBytes = Math.floor((pixelCount * 3) / 8);
        statusElement.textContent = `LSB Max capacity: ${maxMessageBytes} characters.`;

        const hiddenMessage = decodeLSB(subpixels);

        // Only update text if it looks like a message and we aren't typing
        if (hiddenMessage && document.activeElement !== messageTextBoxValue) {
            messageTextBoxValue.value = hiddenMessage;
            console.log("Found LSB message!");
        } else if (document.activeElement !== messageTextBoxValue) {
            messageTextBoxValue.value = "";
        }

    }

    function decodeLSB(subpixels) {
        let decodedText = "";
        let charCode = 0;
        let charMask = 128;

        for (let i = 0; i < subpixels.length; i++) {
            if ((i + 1) % 4 === 0) continue; // Skip Alpha

            const bit = subpixels[i] & 1;
            if (bit === 1) charCode |= charMask;
            charMask >>= 1;

            if (charMask === 0) {
                if (charCode === 0) return decodedText;
                decodedText += String.fromCharCode(charCode);
                charCode = 0;
                charMask = 128;
                if (decodedText.length > 50000) return ""; // Junk
            }
        }
        return "";
    }

    function encodeLSB(text) {
        if (!originalImageData) return null;

        const width = originalImageData.width;
        const height = originalImageData.height;
        const newImageData = canvasContext.createImageData(width, height);
        const subpixels = newImageData.data;

        // Copy original
        for (let i = 0; i < originalImageData.data.length; i++) {
            subpixels[i] = originalImageData.data[i];
        }

        const textToEncode = text + String.fromCharCode(0);
        let charIndex = 0;
        let charMask = 128;
        let currentByte = textToEncode.charCodeAt(charIndex);

        for (let i = 0; i < subpixels.length; i++) {
            if ((i + 1) % 4 === 0) continue;

            if (charIndex >= textToEncode.length) break;

            const bitToHide = (currentByte & charMask) ? 1 : 0;
            if (bitToHide === 1) subpixels[i] |= 1;
            else subpixels[i] &= 254;

            charMask >>= 1;
            if (charMask === 0) {
                charIndex++;
                if (charIndex < textToEncode.length) {
                    currentByte = textToEncode.charCodeAt(charIndex);
                    charMask = 128;
                }
            }
        }

        canvasContext.putImageData(newImageData, 0, 0);
        return canvasContext.canvas.toDataURL();
    }


    // --- Append Logic ---

    function analyzeAppend() {
        if (stegSelect.value !== 'append') return;
        if (!originalFileBuffer) {
            statusElement.textContent = "Waiting for file...";
            return;
        }

        statusElement.textContent = "Checking for appended data...";
        messageTextBoxContainer.classList.add("active");

        // Check capacity? Unlimited basically (filesize limit)
        statusElement.textContent = "Append Mode: Unlimited capacity (increases file size).";

        const message = decodeAppend(originalFileBuffer);
        if (message && document.activeElement !== messageTextBoxValue) {
            messageTextBoxValue.value = message;
        } else if (document.activeElement !== messageTextBoxValue) {
            // Check if we just switched methods, maybe preserve text?
            // If empty, clear it.
            messageTextBoxValue.value = "";
        }
    }

    function decodeAppend(buffer) {
        const view = new DataView(buffer);
        const totalLen = buffer.byteLength;
        const sigLen = APPEND_SIGNATURE.length;

        if (totalLen < sigLen + 4) return ""; // Too small

        // Check for signature at end
        let sigFound = true;
        for (let i = 0; i < sigLen; i++) {
            // Read backwards match? Or forward at (total - sigLen + i)
            const charCode = view.getUint8(totalLen - sigLen + i);
            if (String.fromCharCode(charCode) !== APPEND_SIGNATURE[i]) {
                sigFound = false;
                break;
            }
        }

        if (!sigFound) return "";

        // Read Length (4 bytes before signature)
        // Ensure we have enough bytes
        if (totalLen < sigLen + 4) return "";
        const msgLen = view.getUint32(totalLen - sigLen - 4);

        if (msgLen > totalLen - sigLen - 4) return ""; // Invalid length

        // Read Message
        let msg = "";
        const startPos = totalLen - sigLen - 4 - msgLen;
        for (let i = 0; i < msgLen; i++) {
            msg += String.fromCharCode(view.getUint8(startPos + i));
        }

        return msg;
    }

    function encodeAppend(text) {
        if (!originalFileBuffer) return null;

        // Structure: [Original Data] [Message Bytes] [Length (4 bytes)] [Signature]
        // Note: We need to be careful not to append multiple times if we are re-encoding an already encoded file!
        // For simplicity, we can strip existing data if signature found, then append.

        let baseBuffer = originalFileBuffer;

        // Check if already has data, strip it if so?
        // Actually, let's just strip it to be safe 
        // (Assume originalFileBuffer might be the "Clean" one if we loaded it, but if we "Applied" it might be dirty)
        // decodeAppend returns msg on dirty buffer.
        // Let's implement strip.

        const existingMsg = decodeAppend(originalFileBuffer);
        if (existingMsg !== "") {
            // Strip it
            const view = new DataView(originalFileBuffer);
            const totalLen = originalFileBuffer.byteLength;
            const sigLen = APPEND_SIGNATURE.length;
            const msgLen = view.getUint32(totalLen - sigLen - 4);
            const extraBytes = sigLen + 4 + msgLen;
            baseBuffer = originalFileBuffer.slice(0, totalLen - extraBytes);
        }

        // Create new buffer
        const textLen = text.length;
        const sigLen = APPEND_SIGNATURE.length;
        const newTotalLen = baseBuffer.byteLength + textLen + 4 + sigLen;

        const newBuffer = new ArrayBuffer(newTotalLen);
        const newView = new Uint8Array(newBuffer);
        const baseView = new Uint8Array(baseBuffer);

        // Copy base
        newView.set(baseView, 0);

        // Append Text
        let offset = baseBuffer.byteLength;
        for (let i = 0; i < textLen; i++) {
            newView[offset++] = text.charCodeAt(i);
        }

        // Append Length (4 bytes)
        const dateView = new DataView(newBuffer);
        dateView.setUint32(offset, textLen);
        offset += 4;

        // Append Signature
        for (let i = 0; i < sigLen; i++) {
            newView[offset++] = APPEND_SIGNATURE.charCodeAt(i);
        }

        return new Blob([newBuffer], { type: originalFileType });
    }

});