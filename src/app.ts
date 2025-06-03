import express, { Request, Response } from 'express'
import path from 'path'
import Parser from 'rss-parser'
import axios from 'axios'
import dotenv from 'dotenv'

dotenv.config()

const app = express()
const port = process.env.PORT || 3000
const parser = new Parser()

const HUGGINGFACE_API_TOKEN = process.env.HUGGINGFACE_API_TOKEN
const HF_SUMMARIZATION_MODEL =
  process.env.HF_SUMMARIZATION_MODEL || 'Falconsai/text_summarization'
const COQUI_API_TOKEN = process.env.COQUI_API_TOKEN
const COQUI_API_URL = process.env.COQUI_API_URL // e.g., https://app.coqui.ai/api/v2/samples

// Middleware to serve static files from 'public' directory
app.use(express.static(path.join(__dirname, '../public')))
app.use(express.json()) // To parse JSON request bodies

app.get('/api/hello', (req: Request, res: Response) => {
  res.json({ message: 'Hello from NewsBreeze API!' })
})

// API endpoint to fetch news from an RSS feed
app.get('/api/news', async (req: Request, res: Response) => {
  const feedUrl =
    (req.query.url as string) || 'http://feeds.bbci.co.uk/news/rss.xml'
  try {
    const feed = await parser.parseURL(feedUrl)
    // Return only a subset of fields to keep the response lean
    const items = feed.items.map((item) => ({
      title: item.title,
      link: item.link,
      pubDate: item.pubDate,
      contentSnippet:
        item.contentSnippet?.substring(0, 200) +
        (item.contentSnippet && item.contentSnippet.length > 200 ? '...' : ''), // Keep it brief
      content: item.content, // Full content for summarization
    }))
    res.json(items)
  } catch (error) {
    console.error('Failed to fetch or parse RSS feed:', error)
    res.status(500).json({ error: 'Failed to fetch news feed.' })
  }
})

// API endpoint for summarization
app.post('/api/summarize', async (req: Request, res: Response) => {
  const { textToSummarize } = req.body

  if (!textToSummarize) {
    return res
      .status(400)
      .json({ error: 'textToSummarize is required in the request body.' })
  }

  if (!HUGGINGFACE_API_TOKEN) {
    console.error('Hugging Face API token is not configured.')
    return res.status(500).json({
      error: 'Summarization service is not configured. Missing API token.',
    })
  }

  try {
    const response = await axios.post(
      `https://api-inference.huggingface.co/models/${HF_SUMMARIZATION_MODEL}`,
      {
        inputs: textToSummarize,
        parameters: {
          // Parameters can be adjusted based on the model
          min_length: 20,
          max_length: 150,
          do_sample: false,
        },
      },
      {
        headers: { Authorization: `Bearer ${HUGGINGFACE_API_TOKEN}` },
      }
    )

    if (
      response.data &&
      response.data.length > 0 &&
      response.data[0].summary_text
    ) {
      res.json({ summary: response.data[0].summary_text })
    } else if (response.data.error) {
      console.error('Hugging Face API error:', response.data.error)
      // Pass the specific error from Hugging Face if available
      res
        .status(500)
        .json({ error: `Summarization failed: ${response.data.error}` })
    } else {
      console.error(
        'Unexpected response structure from Hugging Face API:',
        response.data
      )
      res.status(500).json({
        error: 'Summarization failed due to an unexpected API response.',
      })
    }
  } catch (error: any) {
    console.error(
      'Error calling Hugging Face API:',
      error.response ? error.response.data : error.message
    )
    let errorMessage = 'Failed to summarize text.'
    if (error.response && error.response.data && error.response.data.error) {
      errorMessage = `Summarization failed: ${error.response.data.error}`
      if (error.response.data.error.includes('currently loading')) {
        errorMessage += ` The model ${HF_SUMMARIZATION_MODEL} might be loading, please try again in a moment.`
      }
    }
    res.status(error.response?.status || 500).json({ error: errorMessage })
  }
})

// API endpoint for Text-to-Speech (TTS)
app.post('/api/tts', async (req: Request, res: Response) => {
  const { text, speaker_id, language } = req.body // speaker_id for pre-defined, speaker_wav_url for cloning

  if (!text || !speaker_id || !language) {
    return res
      .status(400)
      .json({ error: 'text, speaker_id, and language are required.' })
  }

  if (!COQUI_API_TOKEN || !COQUI_API_URL) {
    console.error('Coqui API token or URL is not configured.')
    return res
      .status(500)
      .json({
        error: 'TTS service is not configured. Missing API token or URL.',
      })
  }

  const payload = {
    name: `newsbreeze_audio_${Date.now()}`,
    voice_id: speaker_id, // This will map to Coqui's voice IDs
    text: text,
    // Coqui specific parameters might be different, check their API docs
    // language: language, // Language might be part of voice_id or a separate param
    // emotion: "Neutral",
  }

  try {
    // IMPORTANT: The actual Coqui API endpoint and payload structure will likely differ.
    // This is a placeholder based on common API patterns. Consult Coqui API docs.
    const response = await axios.post(
      COQUI_API_URL, // This might need to be more specific, e.g., /api/v2/samples or /api/v2/tts
      payload,
      {
        headers: {
          Authorization: `Bearer ${COQUI_API_TOKEN}`,
          'Content-Type': 'application/json',
          Accept: 'application/json', // Or specific audio format if direct generation
        },
        // responseType: 'stream' or 'arraybuffer' if getting audio file directly
      }
    )

    // The response structure will depend heavily on Coqui API:
    // - It might return a URL to the generated audio.
    // - It might return the audio data directly.
    // - It might be a job ID that you need to poll.
    // This example assumes it returns a URL or data that includes a URL.

    if (response.data && response.data.url) {
      // Assuming Coqui returns a URL to the audio
      res.json({ audioUrl: response.data.url })
    } else if (response.data && response.data.audio_url) {
      // Another common naming
      res.json({ audioUrl: response.data.audio_url })
    } else if (
      response.data &&
      response.data.id &&
      COQUI_API_URL.includes('/samples')
    ) {
      // If it is a sample creation, we might need to fetch the sample details to get the audio URL
      // This is a common pattern for APIs that do background processing
      // For now, we'll assume the initial response has what we need or is simple.
      // A more robust solution would handle polling if necessary.
      res.json({
        message:
          'TTS job submitted, audio URL might be in response or require polling',
        data: response.data,
      })
    } else {
      console.error(
        'Unexpected response structure from Coqui TTS API:',
        response.data
      )
      res
        .status(500)
        .json({
          error: 'TTS generation failed due to an unexpected API response.',
          details: response.data,
        })
    }
  } catch (error: any) {
    console.error(
      'Error calling Coqui TTS API:',
      error.response ? error.response.data : error.message
    )
    const errorData = error.response?.data
    const errorMessage =
      errorData?.detail || errorData?.error || 'Failed to generate speech.'
    res
      .status(error.response?.status || 500)
      .json({ error: errorMessage, details: errorData })
  }
})

app.listen(port, () => {
  console.log(`NewsBreeze app listening at http://localhost:${port}`)
})
