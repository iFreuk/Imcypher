# Imcypher - Image Steganography Tool

**Imcypher** is a simple yet powerful web application that allows you to hide secret text messages inside images using Least Significant Bit (LSB) steganography. It runs entirely in your browser, ensuring your data remains private.

## Features

*   **Secure & Private**: All processing happens locally in your browser. No images are uploaded to any server.
*   **Hide & Seek**: Embed text messages into PNG images and retrieve them later.
*   **Visual Preview**: Apply your hidden message to the image preview instantly.
*   **Responsive Design**: Works on desktop and mobile devices.
*   **Modern UI**: Sleek dark theme with neon accents.

## How to Use

### Hiding a Message
1.  Click **Select Image** and choose a PNG or JPG file.
2.  Type your secret message in the "Hidden message" text box.
3.  Click **Apply to Preview** to embed the message in the displayed image (you can then right-click and copy it).
4.  Click **Download Image** to save the encoded image as a PNG file.

### Reading a Message
1.  Refresh the page or clear the current image.
2.  Click **Select Image** and upload an image that was previously encoded with Imcypher.
3.  The hidden message will automatically appear in the text box.

## How it Works

Imcypher uses the **Least Significant Bit (LSB)** technique. It takes the binary representation of your text and replaces the last bit of the Red, Green, and Blue color channels of the image pixels. This change is so subtle that it is invisible to the human eye but can be read by the computer.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---
Created by Gustavo.

