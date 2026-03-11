import Upload from '../../src/upload.js'

const input = document.getElementById('fileInput')
const pauseBtn = document.getElementById('pause')
const unpauseBtn = document.getElementById('unpause')
const cancelBtn = document.getElementById('cancel')
const log = document.getElementById('log')

let upload = null

function appendLog (msg) {
  log.textContent += msg + '\n'
}

function setButtons (active) {
  pauseBtn.disabled = !active
  unpauseBtn.disabled = !active
  cancelBtn.disabled = !active
}

input.addEventListener('change', async () => {
  const file = input.files[0]
  if (!file) return

  // Replace this URL with a real GCS resumable session URI from your server
  const url = 'https://storage.googleapis.com/upload/storage/v1/b/your-bucket/o?uploadType=resumable&upload_id=REPLACE_ME'

  upload = new Upload({
    id: file.name,
    url,
    file,
    onChunkUpload: ({ uploadedBytes, totalBytes, chunkIndex }) => {
      const pct = ((uploadedBytes / totalBytes) * 100).toFixed(1)
      appendLog(`Chunk ${chunkIndex}: ${pct}% (${uploadedBytes}/${totalBytes})`)
    }
  })

  setButtons(true)
  appendLog(`Starting upload of ${file.name} (${file.size} bytes)`)

  try {
    const result = await upload.start()
    appendLog(`Upload complete! Status: ${result.status}`)
  } catch (e) {
    appendLog(`Upload failed: ${e.name} - ${e.message}`)
  } finally {
    upload = null
    setButtons(false)
  }
})

pauseBtn.addEventListener('click', () => {
  if (upload) {
    upload.pause()
    appendLog('Paused')
  }
})

unpauseBtn.addEventListener('click', () => {
  if (upload) {
    upload.unpause()
    appendLog('Resumed')
  }
})

cancelBtn.addEventListener('click', () => {
  if (upload) {
    upload.cancel()
    appendLog('Cancelled')
  }
})
