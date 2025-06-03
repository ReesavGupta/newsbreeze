import express, { type Request, type Response } from 'express'
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
app.post(
  '/api/summarize',
  async (req: Request, res: Response): Promise<void> => {
    const { textToSummarize } = req.body

    if (!textToSummarize) {
      res
        .status(400)
        .json({ error: 'textToSummarize is required in the request body.' })
      return
    }

    if (!HUGGINGFACE_API_TOKEN) {
      console.error('Hugging Face API token is not configured.')
      res.status(500).json({
        error: 'Summarization service is not configured. Missing API token.',
      })
      return
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
  }
)

// API endpoint for Text-to-Speech (TTS) - LOCAL FLASK SERVER VERSION
app.post('/api/tts', async (req: Request, res: Response): Promise<void> => {
  const { text } = req.body

  if (!text) {
    res.status(400).json({ error: 'text is required in the request body.' })
    return
  }

  try {
    const response = await axios.post(
      'http://localhost:5002/tts',
      { text },
      { responseType: 'arraybuffer' } // Get binary audio file
    )

    res.set('Content-Type', 'audio/wav')
    res.send(response.data)
  } catch (error: any) {
    console.error(
      'Error calling local TTS server:',
      error.response ? error.response.data : error.message
    )
    let errorMessage = 'Failed to generate speech.'
    if (error.code === 'ECONNREFUSED') {
      errorMessage =
        'Failed to connect to local TTS server. Is it running on port 5002?'
    } else if (error.response && error.response.data) {
      // Try to parse error from Flask server if it sent a JSON error
      try {
        const responseData = JSON.parse(
          Buffer.from(error.response.data).toString()
        )
        if (responseData && responseData.error) {
          errorMessage = `TTS Error: ${responseData.error}`
        }
      } catch (parseError) {
        // If data is not JSON or not parsable, use a generic message
        errorMessage = `Failed to generate speech. Local TTS server responded with status ${error.response.status}.`
      }
    }
    res.status(500).json({ error: errorMessage })
  }
})

app.listen(port, () => {
  console.log(`NewsBreeze app listening at http://localhost:${port}`)
})
