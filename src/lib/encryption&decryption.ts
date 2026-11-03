import CryptoJS from "crypto-js";

const ENCRYPTION_KEY = import.meta.env.VITE_REACT_APP_ENCRYPTION_KEY;
if (!ENCRYPTION_KEY) {
  throw new Error("ENCRYPTION_KEY is not defined in the environment");
}

// Convert key to WordArray
const AES_KEY = CryptoJS.enc.Utf8.parse(ENCRYPTION_KEY);

export const aesEncrypt = (text: string): string => {
  // 1️⃣ Convert plaintext to WordArray
  const textWA = CryptoJS.enc.Utf8.parse(text);

  // 2️⃣ Encrypt using AES-ECB with PKCS7 padding, no IV (matches Python)
  const encrypted = CryptoJS.AES.encrypt(textWA, AES_KEY, {
    mode: CryptoJS.mode.ECB,
    padding: CryptoJS.pad.Pkcs7,
    iv: undefined, // ECB does not use IV
  });

  // 3️⃣ Return Base64 string (like Python's base64.b64encode)
  return CryptoJS.enc.Base64.stringify(encrypted.ciphertext);
};

export const aesDecrypt = (encryptedText: string): string => {
  const cipherParams = CryptoJS.lib.CipherParams.create({
    ciphertext: CryptoJS.enc.Base64.parse(encryptedText),
  });

  const decrypted = CryptoJS.AES.decrypt(cipherParams, AES_KEY, {
    mode: CryptoJS.mode.ECB,
    padding: CryptoJS.pad.Pkcs7,
  });

  const result = CryptoJS.enc.Utf8.stringify(decrypted);

  return result;
};