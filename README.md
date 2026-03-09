# Gathyr

Gathyr is a real-time co-experience platform for social interactions, gaming, and media sharing.

## Project Structure

- **Backend/**: FastAPI server handling room logic, signaling, and game state.
- **Frontend/**: Vite + React application for the user interface.
- **deploy/**: Production deployment scripts and configurations.
- **dev/**: Local development environment setup.

## Features

- **Low Latency Media**: Powered by LiveKit for high-quality video and audio.
- **Floating Video Grid**: Custom UI for repositioning and resizing participant tiles.
- **Document Picture-in-Picture**: Persistent video overlay for multitasking across tabs.
- **Synchronized Games**: Real-time multiplayer game coordination via WebSockets.

## Running Locally

1. Install dependencies:
   - Backend: `pip install -r Backend/requirements.txt`
   - Frontend: `npm install`
2. Start dev environment:
   ```bash
   ./dev/start-dev.sh
   ```

## Deployment

Refer to `deploy/DEPLOY.md` (coming soon) or run the start script:
```bash
./deploy/start.sh
```
