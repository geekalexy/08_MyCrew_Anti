import fs from 'fs';
import fetch from 'node-fetch';
import path from 'path';

(async () => {
  const tokenPath = path.resolve(process.cwd(), 'token.json');
  const data = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
  const token = data.access_token;
  
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
