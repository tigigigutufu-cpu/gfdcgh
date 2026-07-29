# ToolSphere.online

27 free tools (YouTube SEO, Instagram, Finance, Utility, Design/Developer, Learning, AI photo tools) built with
plain HTML, CSS and JavaScript — no framework, no build step — plus three secure serverless functions for
AI image generation, enhancement and background removal. Ready to push to GitHub and deploy on Vercel.

## Folder structure

```
toolsphere/
  index.html            → Homepage
  tools.html            → All-tools directory (filterable)
  faq.html, about.html, contact.html, blog.html
  blog/                 → 2 blog posts
  legal/                → privacy, terms, disclaimer, cookies, refund
  tools/                → 27 individual tool pages
  api/generate-image.js → Serverless function: AI Image Generator (free, no key — Pollinations.ai)
  api/enhance-image.js  → Serverless function: AI Image Enhancer (needs GOOGLE_API_KEY)
  api/remove-bg.js      → Serverless function: Background Remover (needs GOOGLE_API_KEY)
  assets/css/style.css  → All styling
  assets/js/common.js   → Shared JS (nav, copy buttons)
  assets/js/safe-prompt.js → Content safety filter for the image generator
  robots.txt, sitemap.xml, 404.html, vercel.json
```

## GitHub par upload (step-by-step)

1. https://github.com par jaake naya repository banao (e.g. `toolsphere`), **public**, README add mat karo (yeh
   zip already README ke saath hai).
2. Apne computer par is folder ko unzip karo.
3. Terminal / Git Bash kholo, unzip ki hui folder ke andar jaao:
   ```
   cd toolsphere
   git init
   git add .
   git commit -m "Initial commit - ToolSphere website"
   git branch -M main
   git remote add origin https://github.com/<your-username>/toolsphere.git
   git push -u origin main
   ```
   (`<your-username>` apna GitHub username daalo)

## Vercel se deploy (step-by-step)

1. https://vercel.com par jaake GitHub account se sign in karo.
2. Dashboard me **"Add New" → "Project"** click karo.
3. Apni GitHub repo (`toolsphere`) select karo → **Import**.
4. Framework Preset: **"Other"** select karo — koi build command nahi chahiye. Root directory default rakho.
   Vercel apne aap `api/generate-image.js` ko ek serverless function ki tarah detect kar lega, alag se kuch
   configure karne ki zaroorat nahi.
5. **Deploy** click karo. 30-60 second me live ho jayega, e.g. `toolsphere.vercel.app`.

## Apna domain (toolsphere.online) connect karna

1. Vercel project ke andar **Settings → Domains** me jaao.
2. `toolsphere.online` add karo.
3. Vercel jo Nameservers ya A/CNAME record dikhaye, wahi apne domain registrar (jahan se domain kharida hai) ke
   DNS settings me daal do.
4. 10 minute se 24 hours ke andar domain live ho jayega (DNS propagation time lagta hai).

## Monetization (AdSense waghera) ke liye

- Sabhi ad slots `<div class="ad-slot">` already har page par lagi hui hain — bas apna AdSense (ya kisi bhi
  network ka) `<script>` tag `assets/js/common.js` se pehle `<head>` ya ad-slot div ke andar daal dena.
- Legal pages (Privacy, Terms, Disclaimer, Cookies, Refund) already ready hain — AdSense approval ke liye zaroori
  hain.
- Contact email: `toolsphereweb@gmail.com` sabhi pages par already set hai.

## AI Image Enhancer &amp; Background Remover — Google API key setup

Ye dono tools ek hi Google API key use karte hain (Gemini image model): `api/enhance-image.js` aur
`api/remove-bg.js`.

**Setup (ek baar karna hai, dono tools ke liye same key):**

1. https://aistudio.google.com/apikey par jaake (apne Google Cloud account se) ek API key generate karo.
2. Vercel dashboard → apna project → **Settings → Environment Variables**.
3. Naya variable add karo:
   - Name: `GOOGLE_API_KEY`
   - Value: (apni copied key paste karo)
4. **Save** karo, phir project **Redeploy** karo (Deployments tab → latest deployment → "..." → Redeploy).
5. Bas — dono tools (Image Enhancer + Background Remover) ab live ho jayenge.

Jab tak key set nahi hogi, dono tools ek clear error dikhayenge — koi crash nahi hoga.

**Note:** Background Remover result transparent PNG nahi deta (pixel-level cutout nahi hai) — ye AI se photo ko
clean solid-color background (white/black/gray/blue) ke saath re-render karta hai. Profile photos, ID-style
pictures aur simple product shots ke liye achha kaam karta hai.

## Watermark

Image Generator, Image Enhancer aur Background Remover — teeno tools jo bhi image deti/download karti hain,
uske bottom-right corner me automatically ek chota "TP" watermark lag jaata hai (browser ke Canvas se, koi extra
setup nahi chahiye).

## Image Generator — bilkul free, koi setup nahi chahiye

Image Generator `/api/generate-image.js` serverless function use karta hai, jo **Pollinations.ai** (free, public,
no-key text-to-image endpoint) ko call karta hai. Isliye:

- **Koi API key nahi chahiye**
- **Koi billing/account setup nahi chahiye**
- Deploy karte hi tool kaam karega

Content safety filter do jagah lagi hui hai (double protection):
- Browser me: `assets/js/safe-prompt.js`
- Server me (asli protection, bypass nahi ho sakta): `api/generate-image.js` ke andar `BLOCKLIST`

Dono jagah explicit/NSFW/violent keywords block karte hain aur har prompt me "modest, respectful, fully covered"
style automatically add hoti hai.

### Better quality chahiye? (optional, paid upgrade)

Agar future me better/consistent image quality chahiye to paid provider switch kar sakte ho:

| Provider | Approx cost | Setup |
|---|---|---|
| Stability AI | ~$0.01-0.04 per image | API key + billing |
| Replicate | ~$0.003-0.01 per image (pay-per-use) | API key + billing |
| OpenAI (gpt-image) | ~$0.02-0.08 per image | API key + billing |

Kisi bhi provider ke liye: `api/generate-image.js` ke andar `fetch(url)` wala call us provider ke API endpoint se
replace karo, key ko Vercel → Settings → Environment Variables me daalo (kabhi bhi frontend code me key mat
likhna), aur response ko `{ image: "data:image/png;base64,..." }` format me hi return karo — baaki frontend
already usi format ke liye ready hai.

## Local testing

Koi build step nahi chahiye. Bas `index.html` ko browser me kholo, ya:
```
cd toolsphere
python3 -m http.server 8000
```
phir `http://localhost:8000` kholo.
