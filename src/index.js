const fs = require('fs'),
  process = require('process'),
  Koa = require('koa'),
  Router = require('@koa/router'),
  axios = require('axios'),
  MiniSearch = require('minisearch')

let search = new MiniSearch({
  fields: ['question', 'answer'],
  storeFields: ['question', 'answer'],
  searchOptions: {
    boost: {
      question: 2,
    },
  }
})

function loadData() {
  return new Promise((resolve, reject) => {
    fs.readFile('./data/qna.txt', 'utf8', (err, data) => {
      if (err) {
        reject(err)
      }
    
      let id = 1
      let doc = {
        id: id++
      }
      data.split('\n').forEach((line) => {
        line = line.trim()
        console.log(`=> ${line}`)
        if (line.length === 0) {
          if ('question' in doc && 'answer in doc') {
            search.add(doc)
            doc = {
              id: id++
            }
          }
        } else if (!('question' in doc)) {
          console.log('Question')
          doc.question = line
        } else {
          console.log('Answer')
          doc.answer = line
        }
      })

      if ('answer' in doc) {
        search.add(doc)
      }

      resolve()
    })
  })
}

loadData().then(() => {
  console.log('Test search:')
  console.log(search.search('how to disable feature toggle'))
})

const app = new Koa()
app.use(require('koa-bodyparser')())
const router = new Router();

router.get('/slack/', (ctx, next) => {
  console.log('Incoming event')
  ctx.body = 'hello'
})

var HandledEventIds = {}

async function handleEvent(ctx) {
  if (ctx.request.body.event.type === 'message') {
    console.log(`Message: ${ctx.request.body.event.text}`)
    if ('subtype' in ctx.request.body.event || HandledEventIds[ctx.request.body.event_id]) {
      console.log('Ignoring event')
    } else {
      let results = search.search(ctx.request.body.event.text)
      console.log(results)
      console.log('Sending message')
      await axios.post('https://hooks.slack.com/services/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', {
        text: `I found a similar question:\n${results[0].question}\n\nAnswer: ${results[0].answer}\n\nNot the answer you're looking for? You can find other possible answers here: http://www.wayfair.com.`,
        thread_ts: ctx.request.body.event.ts,
      })
      HandledEventIds[ctx.request.body.event_id] = 1
    }
  } 
  // else
  ctx.body = 'ok'
}

function handleChallenge(ctx) {
  ctx.body = ctx.request.body.challenge
}

router.post('/slack/', async (ctx) => {
  console.log(ctx.request.body)
  if (ctx.request.body.token === '0IcJsSFo2ZwgRmdM3cWVISIG') {
    if ('challenge' in ctx.request.body) {
      handleChallenge(ctx)
    } else {
      await handleEvent(ctx)
    }
  } else {
    ctx.body = '?'
  }
})

app
  .use(router.routes())
  .use(router.allowedMethods())
app.listen(8000)