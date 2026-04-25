import { getGoogleOAuthToken } from './server.js';
import fetch from 'node-fetch';

(async () => {
  const token = await getGoogleOAuthToken();
  if (!token) {
    console.log("No token");
    process.exit(1);
  }
  
  const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
  const body = { contents: [{ role: 'user', parts: [{ text: "Hello" }] }] };
  
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  
  console.log("Status:", res.status);
  const text = await res.text();
  console.log("Body:", text);
})();
