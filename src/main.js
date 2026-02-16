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

    let canvasContext;
    let originalImageData; // Store original image data to enable re-encoding without reloading

    fileInput.addEventListener('change', function (event) {
        const file = event.target.files[0];

        if (file && file.type.match('image.*')) {
            statusElement.textContent = "Processing image...";

            const reader = new FileReader();

            reader.onload = function (e) {
                imagePreview.src = e.target.result;
                imagePreview.style.display = 'block';

                // Wait for image to load to analyze it
                imagePreview.onload = function () {
                    analyzeImagePixels(imagePreview);
                };
            }

            reader.readAsDataURL(file);
        } else {
            alert('Please select a valid image file.');
            imagePreview.style.display = 'none';
            statusElement.textContent = "No image selected";
        }
    });

    downloadBtn.addEventListener('click', function (event) {
        if (!originalImageData) {
            alert("Please select an image first.");
            return;
        }

        const textToHide = messageTextBoxValue.value;
        const dataUrl = encodeImage(textToHide);
        if (dataUrl) {
            downloadImage(dataUrl);
        }
    });

    applyBtn.addEventListener('click', function (event) {
        if (!originalImageData) {
            alert("Please select an image first.");
            return;
        }

        const textToHide = messageTextBoxValue.value;
        const dataUrl = encodeImage(textToHide);
        if (dataUrl) {
            imagePreview.src = dataUrl;
            statusElement.textContent = "Preview updated! Right-click to copy/save.";
            // Note: changing src triggers onload, which triggers analyze, which reads the message back!
            // This confirms consistency.
        }
    });

    // Optional: Update char count as user types
    messageTextBoxValue.addEventListener('input', function () {
        if (originalImageData) {
            // We can calculate remaining space if needed, but for now just let them type
        }
    });


    function analyzeImagePixels(img) {
        statusElement.textContent = "Analyzing pixels...";

        // Create canvas to read pixel data
        const canvas = document.createElement('canvas');
        canvasContext = canvas.getContext('2d');
        const width = img.naturalWidth;
        const height = img.naturalHeight;

        // Set canvas dimensions
        canvas.width = width;
        canvas.height = height;

        // Draw image to canvas
        canvasContext.drawImage(img, 0, 0, width, height);
        messageTextBoxContainer.classList.add("active");
        // messageTextBoxContainer.style.display = "block"; // Start using class for flex control

        // Get pixel data
        originalImageData = canvasContext.getImageData(0, 0, width, height);
        const subpixels = originalImageData.data;
        const pixelCount = width * height;

        // Capacity: 3 bits per pixel (RGB, skipping Alpha). 8 bits per char.
        // Formula: (TotalPixels * 3) / 8 = Maximum Bytes (Characters)
        const maxMessageBytes = Math.floor((pixelCount * 3) / 8);
        statusElement.textContent = `Max capacity: ${maxMessageBytes} characters.`;

        // Attempt to read message
        const hiddenMessage = decodeMessage(subpixels, width, height);

        if (hiddenMessage) {
            messageTextBoxValue.value = hiddenMessage;
            console.log("Found hidden message!");
        } else {
            // Only clear if we didn't just type it? 
            // Actually, analyze is called on LOAD. If we just applied changes, 
            // messageTextBoxValue ALREADY has the text. 
            // But let's let the decoder confirm it.
            if (document.activeElement !== messageTextBoxValue) {
                messageTextBoxValue.value = "";
            }
            console.log("No valid hidden message found.");
        }
    }

    // Decodes message from the image data (subpixels)
    // Returns the string if found, or empty string if not found/invalid.
    function decodeMessage(subpixels, width, height) {
        let binaryString = "";
        let decodedText = "";

        // We only check a reasonable amount of bytes to avoid freezing if it's just noise
        // But for a true steganography tool, we should read until null terminator.
        // Let's read byte by byte.

        let bitIndex = 0;
        let charCode = 0;
        let charMask = 128; // 10000000

        // Iterate over all pixel data
        for (let i = 0; i < subpixels.length; i++) {
            // Skip Alpha channel (every 4th byte: 3, 7, 11...)
            if ((i + 1) % 4 === 0) continue;

            const bit = subpixels[i] & 1; // Get LSB

            // Reconstruct the byte
            if (bit === 1) {
                charCode |= charMask;
            }
            charMask >>= 1;

            // If we completed a byte
            if (charMask === 0) {
                // If it's the null terminator, stop
                if (charCode === 0) {
                    return decodedText;
                }

                // If it's a printable character or valid control char?
                // For simplicity, just add it. Mumbo jumbo will look like mumbo jumbo.
                decodedText += String.fromCharCode(charCode);

                // Reset for next byte
                charCode = 0;
                charMask = 128;

                // Safety break for very large images checking random noise
                // If text gets too long without a null terminator, assume it's noise
                if (decodedText.length > 10000) {
                    // This is a heuristic. In a robust app, we might use a header signature.
                    // For this simple app, we'll return what we found or maybe empty if it looks garbage?
                    // Let's just return nothing if it's too long, likely it's raw image.
                    return "";
                }
            }
        }

        return ""; // Hit end of image without null terminator
    }

    function encodeImage(text) {
        // Create a working copy of image data
        const width = originalImageData.width;
        const height = originalImageData.height;
        const newImageData = canvasContext.createImageData(width, height);
        const subpixels = newImageData.data;

        // Copy original data first
        for (let i = 0; i < originalImageData.data.length; i++) {
            subpixels[i] = originalImageData.data[i];
        }

        // Prepare text: Add null terminator
        const textToEncode = text + String.fromCharCode(0);

        let charIndex = 0;
        let charMask = 128; // 10000000
        let currentByte = textToEncode.charCodeAt(charIndex);

        let bitsEncoded = 0;
        const totalBits = textToEncode.length * 8;

        // Iterate subpixels to hide data
        for (let i = 0; i < subpixels.length && bitsEncoded < totalBits; i++) {
            // Skip Alpha
            if ((i + 1) % 4 === 0) continue;

            // Get current bit to hide
            const bitToHide = (currentByte & charMask) ? 1 : 0;

            // Modify LSB
            if (bitToHide === 1) {
                subpixels[i] |= 1; // Set LSB to 1
            } else {
                subpixels[i] &= 254; // Set LSB to 0 (11111110)
            }

            // Move to next bit
            charMask >>= 1;
            bitsEncoded++;

            if (charMask === 0) {
                // Determine next byte
                charIndex++;
                if (charIndex < textToEncode.length) {
                    currentByte = textToEncode.charCodeAt(charIndex);
                    charMask = 128;
                } else {
                    break; // Done encoding
                }
            }
        }

        // Put new data into a temporary canvas to save
        // We reuse the canvasContext but we need the size to be correct
        canvasContext.putImageData(newImageData, 0, 0);

        return canvasContext.canvas.toDataURL();
    }

    function downloadImage(dataUrl) {
        // Create download link
        const link = document.createElement('a');
        link.download = 'secret-image.png'; // PNG is lossless, critical for steganography!
        link.href = dataUrl;
        link.click();

        alert("Image downloaded!");
    }

});