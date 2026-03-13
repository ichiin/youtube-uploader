/**
 * test-worker.js — Upload subprocess
 *
 * Spawned by test.js as a child process. Receives video config via
 * process.env.VIDEO (JSON), calls the upload() function, and sends
 * the YouTube URL back via IPC.
 *
 * This runs in its own process so that the module-level `page` and
 * `browser` variables in upload.ts don't collide between concurrent uploads.
 */

const { upload } = require('./dist/index.js')
const path = require('path')

// ── Parse video config from environment ────────────────────────────────

const video = JSON.parse(process.env.VIDEO)
const credentials = {
    email: process.env.YT_EMAIL,
    pass: process.env.YT_PASSWORD
}

const slotId = process.env.SLOT_ID || '?'

function log(msg) {
    console.log(`[worker-${slotId}] ${msg}`)
}

// ── Upload ─────────────────────────────────────────────────────────────

async function run() {
    try {
        log(`Uploading: ${video.title} [${video.path}]`)

        const response = await upload(credentials, [video], {
            headless: false,
            executablePath: process.env.CHROME_PATH || '/usr/bin/brave'
            // No userDataDir — we want cookie-based auth (upload.ts:63)
        })

        const youtubeUrl = response[0]
        log(`Upload returned URL: ${youtubeUrl}`)

        // Parse YouTube ID from URL
        const idMatch = youtubeUrl?.match(/(?:youtu\.be\/|youtube\.com\/(?:shorts\/|.*[?&]v=))([a-zA-Z0-9_-]{11})/)
        const youtubeId = idMatch ? idMatch[1] : null

        log(`YouTube ID: ${youtubeId || 'UNKNOWN'}`)
        console.log(`YOUTUBE_ID=${youtubeId}`)

        // Send result back to parent via IPC
        if (process.send) {
            process.send({ type: 'youtube_id', youtubeId, youtubeUrl }, () => process.exit(0))
            // Fallback: exit after 3s even if IPC callback never fires
            setTimeout(() => process.exit(0), 3000)
        } else {
            process.stdout.write('', () => process.exit(0))
        }
    } catch (error) {
        log(`ERROR: ${error.message || error}`)
        console.error(error)

        if (process.send) {
            process.send({ type: 'error', error: error.message || String(error) }, () => process.exit(1))
            setTimeout(() => process.exit(1), 3000)
        } else {
            process.exit(1)
        }
    }
}

run()
