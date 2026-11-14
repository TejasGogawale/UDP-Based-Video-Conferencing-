# End-to-end tests (real browsers, fake camera/microphone)

These drive the installed Chrome with Chromium's fake media devices, one browser
context per user, against a locally running stack.

1. Start the backend with a throwaway database and email disabled:

   ```bash
   DATABASE_URL=sqlite:///e2e.db SMTP_USER= SMTP_PASSWORD= BREVO_API_KEY= RESEND_API_KEY= python app.py
   ```

2. Start the frontend: `npm run dev`
3. Create the three test users (`hosta@example.test`, `guestb@example.test`,
   `guestc@example.test`, password `testpass1`) with `POST /api/auth/register`.
4. In a separate folder: `npm install playwright-core socket.io-client`, copy
   these scripts there, and run `node run.mjs`.

`restart.mjs` writes `restart.ready` once two users are in a call; stop and
restart the backend at that point, and the script reports whether both
clients reconnected and rejoined with video.

Environment: `APP_URL`, `API_URL`, `CHROME_PATH`.
