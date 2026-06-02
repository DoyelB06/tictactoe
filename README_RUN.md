**Run the full TicTacToe dev stack (backend + frontend + DB)**

Quick steps (cmd.exe)

1. Ensure MySQL server is running. If you installed MySQL as a Windows service named `MySQL` or `MySQL80`, start it if stopped.
   - Example (cmd.exe, as Administrator):
     ```cmd
     net start MySQL80
     ```

2. From the repository root run the helper (PowerShell):
   ```cmd
   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\run_all.ps1
   ```

   This will open two PowerShell windows:
   - One running `npm start` in the `backend` folder (listens on port 5000 by default)
   - One running `npm start` in the `frontend` folder (CRA dev server on port 3000)

3. Open your browser at `http://localhost:3000` to use the frontend. The frontend is configured to call the backend at `http://localhost:5000/api`.

Manual start (if you prefer single-window):

1. Start backend (from repository root):
   ```cmd
   cd C:\Users\User\Documents\tictactoe\backend
   npm install
   npm start
   ```

2. In a separate terminal start frontend:
   ```cmd
   cd C:\Users\User\Documents\tictactoe\frontend
   npm install
   npm start
   ```

Notes
- If CRA asks to use another port (3001 etc.), accept or kill the process using port 3000 and restart.
- If you want to run this on a server or inside a process manager, consider setting up `pm2` or creating proper service units.

Production deployment
1. Build the frontend:
   ```cmd
   cd frontend
   npm install
   npm run build
   ```
2. Configure backend environment variables in `backend/.env`:
   ```text
   PORT=5000
   JWT_SECRET=your-production-secret
   DB_HOST=your-db-host
   DB_USER=your-db-user
   DB_PASSWORD=your-db-password
   DB_NAME=your-db-name
   ```
3. Deploy the backend to a host such as Render, Railway, DigitalOcean App Platform, or Azure App Service.
4. The backend will serve the frontend build automatically in production, so a single deployed URL can host the full website.
5. If you deploy frontend separately, set `REACT_APP_API_URL` and `REACT_APP_WS_URL` in the frontend environment.

Example production env for frontend deployment:
```text
REACT_APP_API_URL=https://your-backend.example.com/api
REACT_APP_WS_URL=wss://your-backend.example.com
```

Render deployment
1. Push your repo to GitHub.
2. In Render, create a new Web Service and connect your GitHub repo.
3. Use the default branch (`main` or `master`).
4. Render will use `package.json` at the repository root.
5. Set:
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
6. Add environment variables on Render for `JWT_SECRET`, `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`.
7. The `render.yaml` file at the repo root will help Render keep the service settings.

Railway deployment
1. Push your repo to GitHub.
2. In Railway, create a new project and link the repo.
3. Set the root directory to the repository root.
4. Set the start command to `npm start`.
5. Add environment variables for `JWT_SECRET`, `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`.
6. Railway will run `npm install` and `npm run build` if you configure a build step or if the root package scripts are used.

For both Render and Railway, the backend must be able to reach your MySQL database. Use a hosted MySQL instance rather than `localhost`.
